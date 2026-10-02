import { Prisma, TenantContextService } from "@access/database";
import { Injectable } from "@nestjs/common";

export type ProducerProfileRecord = Prisma.ProducerProfileGetPayload<{
  include: { blindPayCustomers: true; stellarProvisioning: true };
}>;

export const producerContext = {
  blindPayCustomers: {
    where: { isCurrent: true },
    take: 1,
  },
  stellarProvisioning: true,
} satisfies Prisma.ProducerProfileInclude;

@Injectable()
export class ProducersRepository {
  constructor(private readonly tenantContext: TenantContextService) {}

  findByUserId(userId: string): Promise<ProducerProfileRecord | null> {
    return this.tenantContext.withOptionalProducerContext(userId, (transaction, producerId) => {
      if (producerId === null) {
        return Promise.resolve(null);
      }

      return transaction.producerProfile.findUnique({
        where: { userId },
        include: producerContext,
      });
    });
  }

  create(userId: string, displayName: string): Promise<ProducerProfileRecord> {
    return this.tenantContext.withUserContext(userId, (transaction) =>
      transaction.producerProfile.create({
        data: { userId, displayName },
        include: producerContext,
      }),
    );
  }
}
