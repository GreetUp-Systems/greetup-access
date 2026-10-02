import { Injectable } from "@nestjs/common";
import { type Prisma } from "@prisma/client";

import { PrismaService } from "./prisma.service";

export class ProducerContextNotFoundError extends Error {
  constructor() {
    super("producer_context_not_found");
    this.name = "ProducerContextNotFoundError";
  }
}

export type TransactionOperation<T> = (transaction: Prisma.TransactionClient) => Promise<T>;
export type ProducerTransactionOperation<T> = (
  transaction: Prisma.TransactionClient,
  producerId: string,
) => Promise<T>;
export type OptionalProducerTransactionOperation<T> = (
  transaction: Prisma.TransactionClient,
  producerId: string | null,
) => Promise<T>;

@Injectable()
export class TenantContextService {
  constructor(private readonly prisma: PrismaService) {}

  withUserContext<T>(userId: string, operation: TransactionOperation<T>): Promise<T> {
    return this.prisma.$transaction(async (transaction) => {
      await this.setContext(transaction, "app.current_user_id", userId);
      return operation(transaction);
    });
  }

  withProducerContext<T>(userId: string, operation: ProducerTransactionOperation<T>): Promise<T> {
    return this.withOptionalProducerContext(userId, (transaction, producerId) => {
      if (producerId === null) {
        throw new ProducerContextNotFoundError();
      }

      return operation(transaction, producerId);
    });
  }

  withOptionalProducerContext<T>(
    userId: string,
    operation: OptionalProducerTransactionOperation<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (transaction) => {
      await this.setContext(transaction, "app.current_user_id", userId);
      const producer = await transaction.producerProfile.findUnique({
        where: { userId },
        select: { id: true },
      });

      if (producer !== null) {
        await this.setContext(transaction, "app.current_producer_id", producer.id);
      }

      return operation(transaction, producer?.id ?? null);
    });
  }

  private async setContext(
    transaction: Prisma.TransactionClient,
    setting: "app.current_user_id" | "app.current_producer_id",
    value: string,
  ): Promise<void> {
    await transaction.$queryRaw`
      SELECT set_config(${setting}, ${value}, true)
    `;
  }
}
