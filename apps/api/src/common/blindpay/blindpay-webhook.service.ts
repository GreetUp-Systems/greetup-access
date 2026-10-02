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
