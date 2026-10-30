import { Prisma, TenantContextService } from "@access/database";
import { Injectable } from "@nestjs/common";

export type BlindPayCustomerRecord = Prisma.BlindPayCustomerGetPayload<Record<string, never>>;
type StoredKycStatus =
  "VERIFYING" | "APPROVED" | "REJECTED" | "COMPLIANCE_REQUEST" | "APPROVED_RFI";

const operationalKycStatuses = new Set<StoredKycStatus>(["APPROVED", "APPROVED_RFI"]);

/**
 * A PENDING attempt stops blocking a new submission this long after it was last sent (SPEC-003
 * v1.8): its last request (two BlindPay calls, each bounded by the API timeout) has long ended, and
 * a customer it may have created was adopted from the customer.new webhook meanwhile. Sending the
 * same submission again counts as a new send.
 */
export const STALE_CUSTOMER_ATTEMPT_MS = 10 * 60 * 1000;

export class CustomerAttemptAlreadyActiveError extends Error {
  constructor() {
    super("customer_attempt_already_active");
    this.name = "CustomerAttemptAlreadyActiveError";
  }
}

@Injectable()
export class ProducerOnboardingRepository {
  constructor(private readonly tenantContext: TenantContextService) {}

  findCurrent(userId: string): Promise<BlindPayCustomerRecord | null> {
    return this.tenantContext.withProducerContext(userId, (transaction, producerId) =>
      transaction.blindPayCustomer.findFirst({
        where: { producerId, isCurrent: true },
      }),
    );
  }

  findByProviderIdempotencyKey(
    userId: string,
    providerIdempotencyKey: string,
  ): Promise<BlindPayCustomerRecord | null> {
    return this.tenantContext.withProducerContext(userId, (transaction) =>
      transaction.blindPayCustomer.findUnique({ where: { providerIdempotencyKey } }),
    );
  }

  prepareCustomerAttempt(
    userId: string,
    customerType: "INDIVIDUAL" | "BUSINESS",
    providerIdempotencyKey: string,
  ): Promise<BlindPayCustomerRecord> {
    return this.tenantContext.withProducerContext(userId, async (transaction, producerId) => {
      const repeated = await transaction.blindPayCustomer.findUnique({
        where: { providerIdempotencyKey },
      });
      if (repeated !== null) {
        if (repeated.creationStatus !== "PENDING") {
          return repeated;
        }
        // Sending it again restarts its deadline, so a newer submission cannot close it meanwhile.
        await transaction.blindPayCustomer.updateMany({
          where: { id: repeated.id, creationStatus: "PENDING", isCurrent: true },
          data: { updatedAt: new Date() },
        });
        return transaction.blindPayCustomer.findUniqueOrThrow({ where: { id: repeated.id } });
      }

      const staleBefore = new Date(Date.now() - STALE_CUSTOMER_ATTEMPT_MS);
      const current = await transaction.blindPayCustomer.findFirst({
        where: { producerId, isCurrent: true },
      });
      if (current?.creationStatus === "PENDING") {
        if (current.updatedAt >= staleBefore) {
          throw new CustomerAttemptAlreadyActiveError();
        }
        // A stale PENDING attempt is closed; another request that closed or resent it first wins.
        const closed = await transaction.blindPayCustomer.updateMany({
          where: {
            id: current.id,
            producerId,
            creationStatus: "PENDING",
            isCurrent: true,
            updatedAt: { lt: staleBefore },
          },
          data: { creationStatus: "FAILED", isCurrent: false, failureCode: "attempt_abandoned" },
        });
        if (closed.count !== 1) {
          throw new CustomerAttemptAlreadyActiveError();
        }
      } else if (current !== null) {
        if (current.kycStatus !== "REJECTED" && current.creationStatus !== "FAILED") {
          throw new CustomerAttemptAlreadyActiveError();
        }
        await transaction.blindPayCustomer.update({
          where: { id: current.id },
          data: { isCurrent: false },
        });
      }

      return transaction.blindPayCustomer.create({
        data: {
          producerId,
          providerIdempotencyKey,
          customerType,
        },
      });
    });
  }

  /**
   * PENDING → CREATED, with the status and the BlindPay version it was read at. When the
   * customer.new webhook already adopted this attempt for the same customer, the stored attempt is
   * returned as it is (SPEC-003 v1.8).
   */
  markCreated(
    userId: string,
    attemptId: string,
    externalCustomerId: string,
    kycStatus: StoredKycStatus,
    providerUpdatedAt: Date | null,
  ): Promise<BlindPayCustomerRecord> {
    return this.tenantContext.withProducerContext(userId, async (transaction, producerId) => {
      const updated = await transaction.blindPayCustomer.updateMany({
        where: { id: attemptId, producerId, isCurrent: true, creationStatus: "PENDING" },
        data: {
          externalCustomerId,
          creationStatus: "CREATED",
          kycStatus,
          providerUpdatedAt,
          failureCode: null,
        },
      });

      if (updated.count !== 1) {
        const stored = await transaction.blindPayCustomer.findFirst({
          where: { id: attemptId, producerId, isCurrent: true },
        });
        if (
          stored?.creationStatus !== "CREATED" ||
          stored.externalCustomerId !== externalCustomerId
        ) {
          throw new Error("blindpay_customer_state_conflict");
        }
        return stored;
      }

      if (operationalKycStatuses.has(kycStatus)) {
        await transaction.outboxEvent.createMany({
          data: [
            {
              deduplicationKey: `producer:${producerId}:kyc_approved:v1`,
              aggregateType: "producer",
              aggregateId: producerId,
              eventType: "producer.kyc_approved",
              payload: {
                producerId,
                blindPayCustomerRecordId: attemptId,
              },
            },
          ],
          skipDuplicates: true,
        });
      }

      return transaction.blindPayCustomer.findFirstOrThrow({
        where: { id: attemptId, producerId, isCurrent: true },
      });
    });
  }

  /**
   * A creation the provider refused ends the attempt. The attempt it replaced, the last one that was
   * created (a rejected one), becomes current again, so its reason and draft stay visible
   * (SPEC-003 v1.7).
   */
  markFailed(userId: string, attemptId: string, failureCode: string): Promise<void> {
    return this.tenantContext.withProducerContext(userId, async (transaction, producerId) => {
      const failed = await transaction.blindPayCustomer.updateMany({
        where: { id: attemptId, producerId, creationStatus: "PENDING" },
        data: {
          creationStatus: "FAILED",
          isCurrent: false,
          failureCode: failureCode.slice(0, 100),
        },
      });
      if (failed.count !== 1) {
        return;
      }

      const current = await transaction.blindPayCustomer.findFirst({
        where: { producerId, isCurrent: true },
      });
      if (current !== null) {
        return;
      }
      const replaced = await transaction.blindPayCustomer.findFirst({
        where: { producerId, creationStatus: "CREATED" },
        orderBy: { createdAt: "desc" },
      });
      if (replaced !== null) {
        await transaction.blindPayCustomer.update({
          where: { id: replaced.id },
          data: { isCurrent: true },
        });
      }
    });
  }
}
