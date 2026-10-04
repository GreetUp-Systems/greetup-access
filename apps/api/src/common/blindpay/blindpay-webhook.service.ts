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
        await this.markProcessed(transaction, verified.messageId);
        return;
      }

      const customer = await transaction.blindPayCustomer.findUnique({
        where: { externalCustomerId },
      });
      if (customer === null) {
        throw new ServiceUnavailableException({
          code: "webhook_resource_not_ready",
          message: "The webhook resource is not available yet.",
        });
      }

      const wasOperational = operationalStatuses.has(customer.kycStatus ?? "");
      const isOperational = operationalStatuses.has(kycStatus);
      await transaction.blindPayCustomer.update({
        where: { id: customer.id },
        data: { kycStatus },
      });

      if (customer.isCurrent && !wasOperational && isOperational) {
        await transaction.outboxEvent.createMany({
          data: [
            {
              deduplicationKey: `producer:${customer.producerId}:kyc_approved:v1`,
              aggregateType: "producer",
              aggregateId: customer.producerId,
              eventType: "producer.kyc_approved",
              payload: {
                producerId: customer.producerId,
                blindPayCustomerRecordId: customer.id,
              },
            },
          ],
          skipDuplicates: true,
        });
      }

      await this.markProcessed(transaction, verified.messageId);
    });

    return { received: true };
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
