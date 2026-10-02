import { Prisma, TenantContextService } from "@access/database";
import { Injectable } from "@nestjs/common";

export type BlindPayCustomerRecord = Prisma.BlindPayCustomerGetPayload<Record<string, never>>;

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
        return repeated;
      }

      const current = await transaction.blindPayCustomer.findFirst({
        where: { producerId, isCurrent: true },
      });
      if (
        current !== null &&
        current.kycStatus !== "REJECTED" &&
        current.creationStatus !== "FAILED"
      ) {
        throw new CustomerAttemptAlreadyActiveError();
      }

      if (current !== null) {
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

  markCreated(
    userId: string,
    attemptId: string,
    externalCustomerId: string,
  ): Promise<BlindPayCustomerRecord> {
    return this.tenantContext.withProducerContext(userId, async (transaction, producerId) => {
      await transaction.blindPayCustomer.updateMany({
        where: { id: attemptId, producerId, isCurrent: true },
        data: {
          externalCustomerId,
          creationStatus: "CREATED",
          kycStatus: "VERIFYING",
          failureCode: null,
        },
      });

      return transaction.blindPayCustomer.findFirstOrThrow({
        where: { id: attemptId, producerId, isCurrent: true },
      });
    });
  }

  markFailed(userId: string, attemptId: string, failureCode: string): Promise<void> {
    return this.tenantContext.withProducerContext(userId, async (transaction, producerId) => {
      await transaction.blindPayCustomer.updateMany({
        where: { id: attemptId, producerId, creationStatus: "PENDING" },
        data: {
          creationStatus: "FAILED",
          isCurrent: false,
          failureCode: failureCode.slice(0, 100),
        },
      });
    });
  }
}
