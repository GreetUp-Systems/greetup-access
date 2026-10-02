import { Prisma, TenantContextService } from "@access/database";
import { Injectable } from "@nestjs/common";

export type StellarProvisioningRecord = Prisma.StellarAccountProvisioningGetPayload<
  Record<string, never>
>;

export class StellarProvisioningConfigurationError extends Error {
  constructor() {
    super("stellar_provisioning_configuration_mismatch");
    this.name = "StellarProvisioningConfigurationError";
  }
}
@Injectable()
export class ProducerStellarRepository {
  constructor(private readonly tenantContext: TenantContextService) {}

  ensure(
    userId: string,
    walletAccountId: string,
    network: string,
  ): Promise<StellarProvisioningRecord> {
    return this.tenantContext.withProducerContext(userId, async (transaction, producerId) => {
      const provisioning = await transaction.stellarAccountProvisioning.upsert({
        where: { producerId },
        create: { producerId, walletAccountId, network },
        update: {},
      });

      if (provisioning.walletAccountId !== walletAccountId || provisioning.network !== network) {
        throw new StellarProvisioningConfigurationError();
      }

      return provisioning;
    });
  }

  find(userId: string): Promise<StellarProvisioningRecord | null> {
    return this.tenantContext.withProducerContext(userId, (transaction, producerId) =>
      transaction.stellarAccountProvisioning.findUnique({ where: { producerId } }),
    );
  }

  claimSigning(
    userId: string,
    provisioningId: string,
    staleBefore: Date,
  ): Promise<StellarProvisioningRecord | null> {
    return this.tenantContext.withProducerContext(userId, async (transaction, producerId) => {
      const claimed = await transaction.stellarAccountProvisioning.updateMany({
        where: {
          id: provisioningId,
          producerId,
          OR: [
            // ACTIVE is only claimed when the ledger is missing a configured trustline.
            { status: { in: ["PENDING", "FAILED", "ACTIVE"] } },
            { status: "SIGNING", updatedAt: { lt: staleBefore } },
          ],
        },
        data: { status: "SIGNING", transactionHash: null, failureCode: null },
      });

      if (claimed.count === 0) {
        return null;
      }

      return transaction.stellarAccountProvisioning.findUniqueOrThrow({
        where: { id: provisioningId },
      });
    });
  }

  markSubmitted(
    userId: string,
    provisioningId: string,
    transactionHash: string,
  ): Promise<StellarProvisioningRecord> {
    return this.tenantContext.withProducerContext(userId, async (transaction, producerId) => {
      const updated = await transaction.stellarAccountProvisioning.updateMany({
        where: { id: provisioningId, producerId, status: "SIGNING" },
        data: { status: "SUBMITTED", transactionHash, failureCode: null },
      });
      if (updated.count !== 1) {
        throw new Error("stellar_provisioning_state_conflict");
      }
      return transaction.stellarAccountProvisioning.findUniqueOrThrow({
        where: { id: provisioningId },
      });
    });
  }

  markActive(userId: string, provisioningId: string): Promise<StellarProvisioningRecord> {
    return this.tenantContext.withProducerContext(userId, async (transaction, producerId) => {
      await transaction.stellarAccountProvisioning.updateMany({
        where: { id: provisioningId, producerId },
        data: { status: "ACTIVE", activatedAt: new Date(), failureCode: null },
      });
      return transaction.stellarAccountProvisioning.findUniqueOrThrow({
        where: { id: provisioningId },
      });
    });
  }

  markFailed(userId: string, provisioningId: string, failureCode: string): Promise<void> {
    return this.tenantContext.withProducerContext(userId, async (transaction, producerId) => {
      await transaction.stellarAccountProvisioning.updateMany({
        where: { id: provisioningId, producerId },
        data: { status: "FAILED", failureCode: failureCode.slice(0, 80) },
      });
    });
  }

  markWalletRegistered(
    userId: string,
    customerRecordId: string,
    externalBlockchainWalletId: string,
  ): Promise<void> {
    return this.tenantContext.withProducerContext(userId, async (transaction, producerId) => {
      const customer = await transaction.blindPayCustomer.findFirst({
        where: { id: customerRecordId, producerId, isCurrent: true },
      });
      if (customer === null) {
        throw new Error("blindpay_customer_state_conflict");
      }
      if (
        customer.externalBlockchainWalletId !== null &&
        customer.externalBlockchainWalletId !== externalBlockchainWalletId
      ) {
        throw new Error("blindpay_wallet_state_conflict");
      }
      if (customer.externalBlockchainWalletId === null) {
        await transaction.blindPayCustomer.update({
          where: { id: customer.id },
          data: { externalBlockchainWalletId },
        });
      }
    });
  }
}
