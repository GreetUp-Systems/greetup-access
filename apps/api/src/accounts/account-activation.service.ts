import { type ApiConfig } from "@access/config";
import {
  BadGatewayException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from "@nestjs/common";

import { type AuthenticatedPrincipal } from "../auth/auth.types";
import {
  PRIVY_GATEWAY,
  type PrivyGateway,
  PrivyProviderUnavailableError,
} from "../common/privy/privy.types";
import { isStellarHashSignature } from "../common/stellar/stellar-signature";
import {
  PROVISIONING_TRANSACTION_TIMEOUT_SECONDS,
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

// A prepared transaction is handed out for signing only while it still has time on the network.
const preparedWindowMs = (PROVISIONING_TRANSACTION_TIMEOUT_SECONDS - 30) * 1_000;
const submittedLeaseMs = 4 * 60 * 1_000;
// The network refused the prepared transaction itself: it has to be prepared again.
const staleSubmissionCodes = new Set(["tx_bad_seq", "tx_too_late"]);

export type AccountActivationView =
  | { status: "signing"; hashToSign: string }
  | { status: "submitted" | "active"; transactionHash: string | null };

interface ActivationSignature {
  hash: string;
  signature: string;
}

/**
 * Activates the user's own Stellar account with sponsored reserves (D-23): created on the
 * ledger only, without trustlines. The user signs in the browser (D-28): `activate` prepares the
 * transaction and `submitSignature` sends it with the sponsor's signature (SPEC-005 §12).
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
    if (activation.status === "SIGNING" && this.isFresh(activation.updatedAt)) {
      return this.toView(activation);
    }

    const claimed = await this.repository.claimSigning(
      user.id,
      activation.id,
      new Date(Date.now() - preparedWindowMs),
    );
    if (claimed === null) {
      const winner = await this.repository.find(user.id);
      if (winner === null) {
        throw this.unavailable();
      }
      return this.toView(winner);
    }

    try {
      const prepared = await this.stellar.buildProvisioningTransaction(wallet.stellarAddress, {
        accountExists: false,
        missingTrustlines: [],
      });
      return this.toView(
        await this.repository.savePrepared(
          user.id,
          claimed.id,
          prepared.transactionHash,
          prepared.transactionXdr,
        ),
      );
    } catch (error) {
      await this.repository.markFailed(user.id, claimed.id, this.failureCode(error));
      throw this.mapError(error);
    }
  }

  /** The browser's signature of the prepared hash: verified, joined by the sponsor, submitted. */
  async submitSignature(
    principal: AuthenticatedPrincipal,
    body: unknown,
  ): Promise<AccountActivationView> {
    const input = this.parseSignature(body);
    const user = await this.requireUser(principal);
    const address = user.wallet.stellarAddress;

    const activation = await this.repository.find(user.id);
    if (activation === null) {
      throw this.stale();
    }
    if (
      (activation.status === "SUBMITTED" || activation.status === "ACTIVE") &&
      activation.transactionHash === input.hash
    ) {
      return this.toView(activation);
    }
    if (
      activation.status !== "SIGNING" ||
      activation.transactionHash !== input.hash ||
      activation.preparedEnvelopeXdr === null ||
      !this.isFresh(activation.updatedAt)
    ) {
      throw this.stale();
    }
    if (!isStellarHashSignature(input.hash, address, input.signature)) {
      throw this.invalidSignature();
    }

    const submitted = await this.repository.claimSubmission(user.id, activation.id, input.hash);
    if (submitted === null) {
      const current = await this.repository.find(user.id);
      if (current === null || current.transactionHash !== input.hash) {
        throw this.stale();
      }
      return this.toView(current);
    }

    try {
      await this.stellar.submitProvisioningTransaction(
        { transactionXdr: activation.preparedEnvelopeXdr, transactionHash: input.hash },
        address,
        input.signature,
      );
    } catch (error) {
      if (error instanceof StellarProviderError && error.retryable) {
        // The outcome is unknown: the next activation call reconciles by hash.
        return this.toView(submitted);
      }
      await this.repository.markFailed(user.id, submitted.id, this.failureCode(error));
      if (
        error instanceof StellarProviderError &&
        staleSubmissionCodes.has(error.providerCode ?? "")
      ) {
        throw this.stale();
      }
      throw this.mapError(error);
    }

    if (await this.accountExists(address)) {
      return this.toView(await this.repository.markActive(user.id, submitted.id));
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
    if (status === "failed" || activation.updatedAt.getTime() < Date.now() - submittedLeaseMs) {
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

  // Exactly { hash, signature }: the hex hash handed out and the hex signature signRawHash gives.
  private parseSignature(body: unknown): ActivationSignature {
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      throw this.invalidSignature();
    }
    const fields = body as Record<string, unknown>;
    const { hash, signature } = fields;
    if (
      Object.keys(fields).some((key) => key !== "hash" && key !== "signature") ||
      typeof hash !== "string" ||
      typeof signature !== "string"
    ) {
      throw this.invalidSignature();
    }
    return { hash, signature };
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

  private stale(): ConflictException {
    return new ConflictException({
      code: "activation_signature_stale",
      message: "The prepared activation is no longer valid; prepare it again.",
    });
  }

  private invalidSignature(): UnprocessableEntityException {
    return new UnprocessableEntityException({
      code: "invalid_activation_signature",
      message: "The signature does not match the prepared activation.",
    });
  }

  private unavailable(): ServiceUnavailableException {
    return new ServiceUnavailableException({
      code: "account_activation_unavailable",
      message: "Account activation is temporarily unavailable.",
    });
  }

  private isFresh(updatedAt: Date): boolean {
    return updatedAt.getTime() >= Date.now() - preparedWindowMs;
  }

  // SIGNING without a prepared transaction is another request still building it.
  private toView(activation: WalletActivationRecord): AccountActivationView {
    switch (activation.status) {
      case "SIGNING":
        if (activation.transactionHash === null || activation.preparedEnvelopeXdr === null) {
          throw this.unavailable();
        }
        return { status: "signing", hashToSign: activation.transactionHash };
      case "SUBMITTED":
        return { status: "submitted", transactionHash: activation.transactionHash };
      case "ACTIVE":
        return { status: "active", transactionHash: activation.transactionHash };
      default:
        throw this.unavailable();
    }
  }
}
