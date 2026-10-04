import { createHash } from "node:crypto";

import { type ApiConfig } from "@access/config";
import {
  BadGatewayException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";

import { type AuthenticatedPrincipal } from "../auth/auth.types";
import {
  PRIVY_GATEWAY,
  type PrivyGateway,
  PrivyProviderUnavailableError,
} from "../common/privy/privy.types";
import {
  STELLAR_ACTIVATION_CONFIG,
  STELLAR_GATEWAY,
  type StellarGateway,
  StellarProviderError,
} from "../common/stellar/stellar.types";
import { UsersRepository, type UserWithWallet } from "../users/users.repository";
import {
  AccountActivationRepository,
  type WalletActivationRecord,
} from "./account-activation.repository";

const signingLeaseMs = 4 * 60 * 1_000;

export interface AccountActivationView {
  status: "signing" | "submitted" | "active";
  transactionHash: string | null;
}

/**
 * Activates the user's own Stellar account with sponsored reserves (D-23): created on the
 * ledger only, without trustlines. It needs the user's Privy signature, so it runs on an
 * authenticated request and never in a worker (SPEC-005 §12).
 */
@Injectable()
export class AccountActivationService {
  constructor(
    private readonly users: UsersRepository,
    private readonly repository: AccountActivationRepository,
    @Inject(PRIVY_GATEWAY) private readonly privy: PrivyGateway,
    @Inject(STELLAR_GATEWAY) private readonly stellar: StellarGateway,
    @Inject(STELLAR_ACTIVATION_CONFIG)
    private readonly config: Pick<ApiConfig, "stellarNetwork">,
  ) {}

  async activate(principal: AuthenticatedPrincipal): Promise<AccountActivationView> {
    const user = await this.requireUser(principal);
    const wallet = user.wallet;
    await this.assertWalletOwnership(principal, wallet);
    if (!(await this.isEligible(user))) {
      throw new ConflictException({
        code: "account_activation_not_allowed",
        message: "The account becomes eligible after a login or a paid purchase.",
      });
    }

    let activation = await this.repository.ensure(user.id, wallet.id, this.config.stellarNetwork);
    if (await this.accountExists(wallet.stellarAddress)) {
      return this.toView(
        activation.status === "ACTIVE"
          ? activation
          : await this.repository.markActive(user.id, activation.id),
      );
    }

    if (activation.status === "SUBMITTED" && activation.transactionHash !== null) {
      activation = await this.reconcileSubmitted(user.id, activation);
      if (activation.status === "SUBMITTED") {
        return this.toView(activation);
      }
    }
    if (activation.status === "SIGNING" && !this.isStale(activation.updatedAt)) {
      return this.toView(activation);
    }

    const claimed = await this.repository.claimSigning(
      user.id,
      activation.id,
      new Date(Date.now() - signingLeaseMs),
    );
    if (claimed === null) {
      const winner = await this.repository.find(user.id);
      if (winner === null) {
        throw this.unavailable();
      }
      return this.toView(winner);
    }

    let submitted: WalletActivationRecord | undefined;
    try {
      const prepared = await this.stellar.buildProvisioningTransaction(wallet.stellarAddress, {
        accountExists: false,
        missingTrustlines: [],
      });
      const signature = await this.privy.rawSignStellarHash(
        wallet.privyWalletId,
        prepared.transactionHash,
        principal.accessToken,
        this.hashKey(`privy:${prepared.transactionHash}`),
      );
      submitted = await this.repository.markSubmitted(
        user.id,
        claimed.id,
        prepared.transactionHash,
      );
      await this.stellar.submitProvisioningTransaction(prepared, wallet.stellarAddress, signature);
    } catch (error) {
      if (submitted !== undefined && error instanceof StellarProviderError && error.retryable) {
        // The outcome is unknown: the next call reconciles by hash before building again.
        return this.toView(submitted);
      }
      await this.repository.markFailed(user.id, claimed.id, this.failureCode(error));
      throw this.mapError(error);
    }

    if (await this.accountExists(wallet.stellarAddress)) {
      return this.toView(await this.repository.markActive(user.id, claimed.id));
    }
    return this.toView(submitted);
  }

  private async isEligible(user: UserWithWallet): Promise<boolean> {
    return user.spontaneousLoginAt !== null || this.repository.hasPaidPurchase(user.id);
  }

  private async reconcileSubmitted(
    userId: string,
    activation: WalletActivationRecord,
  ): Promise<WalletActivationRecord> {
    const status = await this.call(() =>
      this.stellar.getTransactionStatus(activation.transactionHash!),
    );
    if (status === "success") {
      // The ledger was checked just before and holds no account for this address.
      return this.repository.markFailed(userId, activation.id, "onchain_state_mismatch");
    }
    if (status === "failed" || this.isStale(activation.updatedAt)) {
      return this.repository.markFailed(
        userId,
        activation.id,
        status === "failed" ? "transaction_failed" : "transaction_expired",
      );
    }
    return activation;
  }

  private async accountExists(address: string): Promise<boolean> {
    const state = await this.call(() => this.stellar.getAccountState(address));
    return state.accountExists;
  }

  private async requireUser(
    principal: AuthenticatedPrincipal,
  ): Promise<UserWithWallet & { wallet: NonNullable<UserWithWallet["wallet"]> }> {
    const user = await this.users.findByPrivyUserId(principal.privyUserId);
    if (user === null || user.wallet === null) {
      throw new NotFoundException({
        code: "account_not_bootstrapped",
        message: "The authenticated account has not been bootstrapped.",
      });
    }
    return { ...user, wallet: user.wallet };
  }

  private async assertWalletOwnership(
    principal: AuthenticatedPrincipal,
    wallet: { privyWalletId: string; stellarAddress: string },
  ): Promise<void> {
    const current = await this.call(() => this.privy.findStellarWallet(principal.privyUserId));
    if (
      current === null ||
      current.ownerPrivyUserId !== principal.privyUserId ||
      current.id !== wallet.privyWalletId ||
      current.address !== wallet.stellarAddress
    ) {
      throw new ConflictException({
        code: "stellar_wallet_owner_mismatch",
        message: "The Stellar wallet does not belong to the authenticated user.",
      });
    }
  }

  private async call<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      throw this.mapError(error);
    }
  }

  private mapError(error: unknown): Error {
    if (error instanceof PrivyProviderUnavailableError) {
      return new ServiceUnavailableException({
        code: "wallet_signature_unavailable",
        message: "The wallet signature is temporarily unavailable.",
      });
    }
    if (error instanceof StellarProviderError) {
      const body = {
        code: "account_activation_failed",
        message: "The Stellar account could not be activated.",
      };
      return error.retryable
        ? new ServiceUnavailableException(body)
        : new BadGatewayException(body);
    }
    return error instanceof Error ? error : new Error("account_activation_failed");
  }

  private failureCode(error: unknown): string {
    if (error instanceof StellarProviderError) {
      return error.providerCode ?? error.operation;
    }
    if (error instanceof PrivyProviderUnavailableError) {
      return error.operation;
    }
    return "activation_failed";
  }

  private unavailable(): ServiceUnavailableException {
    return new ServiceUnavailableException({
      code: "account_activation_unavailable",
      message: "Account activation is temporarily unavailable.",
    });
  }

  private hashKey(value: string): string {
    return createHash("sha256").update(value).digest("hex");
  }

  private isStale(updatedAt: Date): boolean {
    return updatedAt.getTime() < Date.now() - signingLeaseMs;
  }

  private toView(activation: WalletActivationRecord): AccountActivationView {
    const status = activation.status.toLowerCase();
    if (status !== "signing" && status !== "submitted" && status !== "active") {
      throw this.unavailable();
    }
    return { status, transactionHash: activation.transactionHash };
  }
}
