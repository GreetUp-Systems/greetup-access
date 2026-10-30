import { randomUUID } from "node:crypto";

import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { type Prisma } from "@access/database";

import { BlindPayWebhookPrismaService } from "./blindpay-webhook-prisma.service";
import { type BlindPayWebhookHeaders, BlindPayWebhookVerifier } from "./blindpay-webhook.verifier";
import { BLINDPAY_WEBHOOK_SECRET, type BlindPayKycStatusValue } from "./blindpay.types";

const kycStatusMap = {
  verifying: "VERIFYING",
  approved: "APPROVED",
  rejected: "REJECTED",
  compliance_request: "COMPLIANCE_REQUEST",
  approved_rfi: "APPROVED_RFI",
} as const;
const operationalStatuses = new Set(["APPROVED", "APPROVED_RFI"]);
const customerLifecycleEvents = new Set(["customer.new", "customer.update"]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Tolerance between BlindPay's clock and the database's when matching a customer to an attempt.
const clockSkewMs = 2 * 60 * 1000;
const payinEvents = new Set(["payin.new", "payin.update", "payin.complete"]);
const openPayinStatuses = new Set(["processing", "on_hold"]);
// payin.complete also fires for failed and refunded payins: the status decides (SPEC-005 §10).
const terminalPayinStatuses = new Set(["completed", "failed", "refunded"]);

interface WebhookResult {
  received: true;
}

@Injectable()
export class BlindPayWebhookService {
  private readonly logger = new Logger(BlindPayWebhookService.name);

  constructor(
    private readonly prisma: BlindPayWebhookPrismaService,
    private readonly verifier: BlindPayWebhookVerifier,
    @Inject(BLINDPAY_WEBHOOK_SECRET) private readonly webhookSecret: string,
  ) {}

  async handle(rawBody: Buffer, headers: BlindPayWebhookHeaders): Promise<WebhookResult> {
    const verified = this.verifier.verify(this.webhookSecret, rawBody, headers);
    const payload = this.parsePayload(rawBody);
    const eventType = this.requiredString(payload, "webhook_event");
    const resourceId = this.optionalString(payload, "id");

    await this.prisma.$transaction(async (transaction) => {
      const existing = await transaction.blindPayWebhookDelivery.findUnique({
        where: { providerMessageId: verified.messageId },
      });
      if (existing !== null) {
        if (existing.payloadHash !== verified.payloadHash) {
          throw new BadRequestException({
            code: "webhook_replay_mismatch",
            message: "The webhook message ID was reused with another payload.",
          });
        }
        if (existing.processedAt !== null) {
          return;
        }
      } else {
        await transaction.blindPayWebhookDelivery.create({
          data: {
            providerMessageId: verified.messageId,
            eventType,
            ...(resourceId === undefined ? {} : { resourceId }),
            payloadHash: verified.payloadHash,
          },
        });
      }

      if (payinEvents.has(eventType)) {
        await this.applyPayin(transaction, payload, verified.messageId);
        await this.markProcessed(transaction, verified.messageId);
        return;
      }

      if (!customerLifecycleEvents.has(eventType)) {
        await this.markProcessed(transaction, verified.messageId);
        return;
      }

      const externalCustomerId = this.requiredString(payload, "id");
      const providerStatus = this.requiredString(payload, "kyc_status");
      const kycStatus = kycStatusMap[providerStatus as BlindPayKycStatusValue];
      if (kycStatus === undefined) {
        this.logger.warn(
          `Unknown BlindPay KYC status for event ${verified.messageId} and resource ${externalCustomerId}.`,
        );
      }

      let customer = await transaction.blindPayCustomer.findUnique({
        where: { externalCustomerId },
      });
      if (customer === null) {
        // An unknown status still links the customer, failing closed as verifying, as the
        // creation itself does when the status read fails (SPEC-003 v1.8).
        if (
          await this.adoptPendingAttempt(
            transaction,
            payload,
            externalCustomerId,
            kycStatus ?? "VERIFYING",
          )
        ) {
          await this.markProcessed(transaction, verified.messageId);
          return;
        }
        // The creation request, or a concurrent event, may have linked it in the meantime: a new
        // statement sees what they committed.
        customer = await transaction.blindPayCustomer.findUnique({
          where: { externalCustomerId },
        });
        if (customer === null) {
          this.logger.warn(
            `Orphan BlindPay customer ${externalCustomerId} from event ${verified.messageId}.`,
          );
          await this.markProcessed(transaction, verified.messageId);
          return;
        }
      }
      if (kycStatus === undefined) {
        await this.markProcessed(transaction, verified.messageId);
        return;
      }

      const wasOperational = operationalStatuses.has(customer.kycStatus ?? "");
      const isOperational = operationalStatuses.has(kycStatus);
      await transaction.blindPayCustomer.update({
        where: { id: customer.id },
        data: { kycStatus },
      });

      if (customer.isCurrent && !wasOperational && isOperational) {
        await this.publishKycApproved(transaction, customer.producerId, customer.id);
      }

      await this.markProcessed(transaction, verified.messageId);
    });

    return { received: true };
  }

  /**
   * A customer the Access does not know is the outcome of a creation whose response never came
   * (SPEC-003 v1.8): its external_id is the producer, whose current attempt is still PENDING. A
   * customer created before that attempt began belongs to an earlier one and is not adopted.
   */
  private async adoptPendingAttempt(
    transaction: Prisma.TransactionClient,
    payload: Record<string, unknown>,
    externalCustomerId: string,
    kycStatus: (typeof kycStatusMap)[keyof typeof kycStatusMap],
  ): Promise<boolean> {
    const producerId = this.optionalString(payload, "external_id");
    const createdAt = new Date(this.optionalString(payload, "created_at") ?? "");
    if (
      producerId === undefined ||
      !uuidPattern.test(producerId) ||
      Number.isNaN(createdAt.getTime())
    ) {
      return false;
    }

    const attempt = await transaction.blindPayCustomer.findFirst({
      where: { producerId, isCurrent: true, creationStatus: "PENDING" },
    });
    if (attempt === null || createdAt.getTime() < attempt.createdAt.getTime() - clockSkewMs) {
      return false;
    }

    const adopted = await transaction.blindPayCustomer.updateMany({
      where: { id: attempt.id, isCurrent: true, creationStatus: "PENDING" },
      data: { externalCustomerId, creationStatus: "CREATED", kycStatus, failureCode: null },
    });
    if (adopted.count !== 1) {
      return false;
    }
    if (operationalStatuses.has(kycStatus)) {
      await this.publishKycApproved(transaction, attempt.producerId, attempt.id);
    }
    this.logger.log(`Adopted BlindPay customer ${externalCustomerId} for attempt ${attempt.id}.`);
    return true;
  }

  private async publishKycApproved(
    transaction: Prisma.TransactionClient,
    producerId: string,
    customerRecordId: string,
  ): Promise<void> {
    await transaction.outboxEvent.createMany({
      data: [
        {
          deduplicationKey: `producer:${producerId}:kyc_approved:v1`,
          aggregateType: "producer",
          aggregateId: producerId,
          eventType: "producer.kyc_approved",
          payload: { producerId, blindPayCustomerRecordId: customerRecordId },
        },
      ],
      skipDuplicates: true,
    });
  }

  private async applyPayin(
    transaction: Prisma.TransactionClient,
    payload: Record<string, unknown>,
    messageId: string,
  ): Promise<void> {
    const payinId = this.requiredString(payload, "id");
    const status = this.requiredString(payload, "status");
    if (!terminalPayinStatuses.has(status)) {
      if (!openPayinStatuses.has(status)) {
        this.logger.warn(`Unknown BlindPay payin status for event ${messageId} and ${payinId}.`);
      }
      return;
    }

    const purchase = await transaction.purchase.findUnique({
      where: { externalPayinId: payinId },
    });
    if (purchase === null) {
      // The payin id is stored right after its creation; a retry finds it.
      throw new ServiceUnavailableException({
        code: "webhook_resource_not_ready",
        message: "The webhook resource is not available yet.",
      });
    }

    if (purchase.status !== "AWAITING_PAYMENT") {
      const repeated =
        (status === "completed" &&
          (purchase.status === "PAYMENT_CONFIRMED" || purchase.status === "TICKET_ISSUED")) ||
        (status === "failed" && purchase.status === "PAYMENT_FAILED") ||
        (status === "refunded" && purchase.status === "PAYMENT_REFUNDED");
      if (!repeated) {
        this.logger.warn(
          `Ignored payin ${payinId} ${status} for purchase ${purchase.id} in ${purchase.status}.`,
        );
      }
      return;
    }

    if (status === "completed") {
      await this.confirmPayment(transaction, purchase);
      return;
    }

    await transaction.purchase.updateMany({
      where: { id: purchase.id, status: "AWAITING_PAYMENT" },
      data:
        status === "failed"
          ? { status: "PAYMENT_FAILED", failureCode: "payin_failed" }
          : { status: "PAYMENT_REFUNDED", failureCode: "payin_refunded" },
    });
  }

  // The purchase, its tickets and payment.confirmed are written in one transaction (D-14).
  private async confirmPayment(
    transaction: Prisma.TransactionClient,
    purchase: Prisma.PurchaseGetPayload<Record<string, never>>,
  ): Promise<void> {
    const updated = await transaction.purchase.updateMany({
      where: { id: purchase.id, status: "AWAITING_PAYMENT" },
      data: { status: "PAYMENT_CONFIRMED", paymentConfirmedAt: new Date() },
    });
    if (updated.count !== 1) {
      return;
    }

    await transaction.ticket.createMany({
      data: Array.from({ length: purchase.quantity }, () => ({
        id: randomUUID(),
        purchaseId: purchase.id,
        producerId: purchase.producerId,
        eventId: purchase.eventId,
        ticketTypeId: purchase.ticketTypeId,
        ownerUserId: purchase.buyerUserId,
      })),
    });
    await transaction.outboxEvent.createMany({
      data: [
        {
          deduplicationKey: `purchase:${purchase.id}:payment_confirmed:v1`,
          aggregateType: "purchase",
          aggregateId: purchase.id,
          eventType: "payment.confirmed",
          payload: { purchaseId: purchase.id },
        },
      ],
      skipDuplicates: true,
    });
  }

  private parsePayload(rawBody: Buffer): Record<string, unknown> {
    try {
      const value = JSON.parse(rawBody.toString("utf8")) as unknown;
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new Error("invalid payload");
      }
      return value as Record<string, unknown>;
    } catch {
      throw new BadRequestException({
        code: "invalid_webhook_payload",
        message: "The webhook payload is invalid.",
      });
    }
  }

  private requiredString(object: Record<string, unknown>, key: string): string {
    const value = this.optionalString(object, key);
    if (value === undefined) {
      throw new BadRequestException({
        code: "invalid_webhook_payload",
        message: "The webhook payload is invalid.",
      });
    }
    return value;
  }

  private optionalString(object: Record<string, unknown>, key: string): string | undefined {
    const value = object[key];
    return typeof value === "string" && value.length > 0 && value.length <= 255 ? value : undefined;
  }

  private async markProcessed(
    transaction: Prisma.TransactionClient,
    providerMessageId: string,
  ): Promise<void> {
    await transaction.blindPayWebhookDelivery.update({
      where: { providerMessageId },
      data: { processedAt: new Date() },
    });
  }
}
