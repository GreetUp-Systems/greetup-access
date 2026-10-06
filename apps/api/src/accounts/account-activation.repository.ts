import { Prisma, TenantContextService } from "@access/database";
import { Injectable } from "@nestjs/common";

export type WalletActivationRecord = Prisma.WalletActivationGetPayload<Record<string, never>>;

/** Every access runs in the user's own context: wallet_activations is isolated by user_id. */
@Injectable()
export class AccountActivationRepository {
  constructor(private readonly tenantContext: TenantContextService) {}

  ensure(
    userId: string,
    walletAccountId: string,
    network: string,
  ): Promise<WalletActivationRecord> {
    return this.tenantContext.withUserContext(userId, (transaction) =>
      transaction.walletActivation.upsert({
        where: { userId },
        create: { userId, walletAccountId, network },
        update: {},
      }),
    );
  }

  /** A paid purchase makes a checkout-only buyer eligible (D-23). */
  hasPaidPurchase(userId: string): Promise<boolean> {
    return this.tenantContext
      .withUserContext(userId, (transaction) =>
        transaction.purchase.count({
          where: { buyerUserId: userId, status: { in: ["PAYMENT_CONFIRMED", "TICKET_ISSUED"] } },
        }),
      )
      .then((count) => count > 0);
  }

  // ACTIVE is claimable only because the ledger showed no account for it.
  claimSigning(
    userId: string,
    activationId: string,
    staleBefore: Date,
  ): Promise<WalletActivationRecord | null> {
    return this.tenantContext.withUserContext(userId, async (transaction) => {
      const claimed = await transaction.walletActivation.updateMany({
        where: {
          id: activationId,
          userId,
          OR: [
            { status: { in: ["PENDING", "FAILED", "ACTIVE"] } },
            { status: "SIGNING", updatedAt: { lt: staleBefore } },
          ],
        },
        data: {
          status: "SIGNING",
          transactionHash: null,
          preparedEnvelopeXdr: null,
          failureCode: null,
        },
      });
      if (claimed.count === 0) {
        return null;
      }
      return transaction.walletActivation.findUniqueOrThrow({ where: { id: activationId } });
    });
  }

  /** Keeps the prepared transaction, without signatures, for the browser to sign (D-28). */
  savePrepared(
    userId: string,
    activationId: string,
    transactionHash: string,
    preparedEnvelopeXdr: string,
  ): Promise<WalletActivationRecord> {
    return this.update(userId, activationId, { transactionHash, preparedEnvelopeXdr });
  }

  /**
   * SIGNING → SUBMITTED for the prepared hash only, so two signatures never submit twice. Null
   * when another request already moved it.
   */
  claimSubmission(
    userId: string,
    activationId: string,
    transactionHash: string,
  ): Promise<WalletActivationRecord | null> {
    return this.tenantContext.withUserContext(userId, async (transaction) => {
      const claimed = await transaction.walletActivation.updateMany({
        where: { id: activationId, userId, status: "SIGNING", transactionHash },
        data: { status: "SUBMITTED", preparedEnvelopeXdr: null },
      });
      if (claimed.count === 0) {
        return null;
      }
      return transaction.walletActivation.findUniqueOrThrow({ where: { id: activationId } });
    });
  }

  find(userId: string): Promise<WalletActivationRecord | null> {
    return this.tenantContext.withUserContext(userId, (transaction) =>
      transaction.walletActivation.findUnique({ where: { userId } }),
    );
  }

  markActive(userId: string, activationId: string): Promise<WalletActivationRecord> {
    return this.update(userId, activationId, {
      status: "ACTIVE",
      activatedAt: new Date(),
      preparedEnvelopeXdr: null,
      failureCode: null,
    });
  }

  markFailed(
    userId: string,
    activationId: string,
    failureCode: string,
  ): Promise<WalletActivationRecord> {
    return this.update(userId, activationId, {
      status: "FAILED",
      preparedEnvelopeXdr: null,
      failureCode: failureCode.slice(0, 80),
    });
  }

  private update(
    userId: string,
    activationId: string,
    data: Prisma.WalletActivationUpdateManyMutationInput,
  ): Promise<WalletActivationRecord> {
    return this.tenantContext.withUserContext(userId, async (transaction) => {
      await transaction.walletActivation.updateMany({ where: { id: activationId, userId }, data });
      return transaction.walletActivation.findUniqueOrThrow({ where: { id: activationId } });
    });
  }
}
