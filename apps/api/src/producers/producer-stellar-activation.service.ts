import { createHash } from "node:crypto";

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
  BLINDPAY_GATEWAY,
  type BlindPayGateway,
  BlindPayProviderError,
} from "../common/blindpay/blindpay.types";
import {
  PRIVY_GATEWAY,
  type PrivyGateway,
  PrivyProviderUnavailableError,
} from "../common/privy/privy.types";
import { isStellarHashSignature } from "../common/stellar/stellar-signature";
import {
  isStellarAccountProvisioned,
  PROVISIONING_TRANSACTION_TIMEOUT_SECONDS,
  STELLAR_GATEWAY,
  STELLAR_ACTIVATION_CONFIG,
  type StellarAccountState,
  type StellarGateway,
  StellarProviderError,
  type StellarTransactionStatus,
} from "../common/stellar/stellar.types";
import { UsersRepository } from "../users/users.repository";
import {
  ProducerStellarRepository,
  type StellarProvisioningRecord,
} from "./producer-stellar.repository";
import { type ProducerProfileRecord, ProducersRepository } from "./producers.repository";

// A prepared transaction is handed out for signing only while it still has time on the network.
const preparedWindowMs = (PROVISIONING_TRANSACTION_TIMEOUT_SECONDS - 30) * 1_000;
const submittedLeaseMs = 4 * 60 * 1_000;
// The network refused the prepared transaction itself: it has to be prepared again.
const staleSubmissionCodes = new Set(["tx_bad_seq", "tx_too_late"]);
const operationalKycStatuses = new Set(["APPROVED", "APPROVED_RFI"]);

type CurrentBlindPayCustomer = ProducerProfileRecord["blindPayCustomers"][number];

export type StellarActivationView =
  | { status: "signing"; hashToSign: string }
  | { status: "submitted" | "active"; transactionHash: string | null };

interface ActivationSignature {
  hash: string;
  signature: string;
}

/**
 * The producer's Stellar setup — account and trustlines with sponsored reserves — and the
 * BlindPay wallet registration (SPEC-003 §10). The producer signs in the browser (D-28):
 * `activate` prepares the transaction and `submitSignature` sends it with the sponsor's.
 */
@Injectable()
export class ProducerStellarActivationService {
  constructor(
    private readonly users: UsersRepository,
    private readonly producers: ProducersRepository,
    private readonly repository: ProducerStellarRepository,
    @Inject(PRIVY_GATEWAY) private readonly privy: PrivyGateway,
    @Inject(STELLAR_GATEWAY) private readonly stellar: StellarGateway,
    @Inject(BLINDPAY_GATEWAY) private readonly blindPay: BlindPayGateway,
    @Inject(STELLAR_ACTIVATION_CONFIG)
    private readonly config: Pick<ApiConfig, "stellarNetwork">,
  ) {}

  async activate(principal: AuthenticatedPrincipal): Promise<StellarActivationView> {
    const { user, wallet, customer } = await this.requireContext(principal);
    await this.assertWalletOwnership(principal, wallet);

    let provisioning = await this.repository.ensure(user.id, wallet.id, this.config.stellarNetwork);

    const initialState = await this.getAccountState(wallet.stellarAddress);
    if (isStellarAccountProvisioned(initialState)) {
      return this.completeActivation(user.id, provisioning, customer, wallet.stellarAddress);
    }

    if (provisioning.status === "SUBMITTED") {
      provisioning = await this.reconcileSubmitted(user.id, provisioning, wallet.stellarAddress);
      if (provisioning.status === "ACTIVE") {
        return this.completeActivation(user.id, provisioning, customer, wallet.stellarAddress);
      }
      if (provisioning.status === "SUBMITTED") {
        return this.toView(provisioning);
      }
    }
    if (provisioning.status === "SIGNING" && this.isFresh(provisioning.updatedAt)) {
      return this.toView(provisioning);
    }

    const claimed = await this.repository.claimSigning(
      user.id,
      provisioning.id,
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
      const prepared = await this.stellar.buildProvisioningTransaction(
        wallet.stellarAddress,
        initialState,
      );
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
      throw this.mapActivationError(error);
    }
  }

  /** The browser's signature of the prepared hash: verified, joined by the sponsor, submitted. */
  async submitSignature(
    principal: AuthenticatedPrincipal,
    body: unknown,
  ): Promise<StellarActivationView> {
    const input = this.parseSignature(body);
    const { user, wallet, customer } = await this.requireContext(principal);
    const address = wallet.stellarAddress;

    const provisioning = await this.repository.find(user.id);
    if (provisioning === null) {
      throw this.stale();
    }
    if (
      (provisioning.status === "SUBMITTED" || provisioning.status === "ACTIVE") &&
      provisioning.transactionHash === input.hash
    ) {
      return this.toView(provisioning);
    }
    if (
      provisioning.status !== "SIGNING" ||
      provisioning.transactionHash !== input.hash ||
      provisioning.preparedEnvelopeXdr === null ||
      !this.isFresh(provisioning.updatedAt)
    ) {
      throw this.stale();
    }
    if (!isStellarHashSignature(input.hash, address, input.signature)) {
      throw this.invalidSignature();
    }

    const submitted = await this.repository.claimSubmission(user.id, provisioning.id, input.hash);
    if (submitted === null) {
      const current = await this.repository.find(user.id);
      if (current === null || current.transactionHash !== input.hash) {
        throw this.stale();
      }
      return this.toView(current);
    }

    try {
      await this.stellar.submitProvisioningTransaction(
        { transactionXdr: provisioning.preparedEnvelopeXdr, transactionHash: input.hash },
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
      throw this.mapActivationError(error);
    }

    const confirmed = await this.getAccountState(address);
    if (!isStellarAccountProvisioned(confirmed)) {
      return this.toView(submitted);
    }

    return this.completeActivation(user.id, submitted, customer, address);
  }

  private async reconcileSubmitted(
    userId: string,
    provisioning: StellarProvisioningRecord,
    address: string,
  ): Promise<StellarProvisioningRecord> {
    if (provisioning.status !== "SUBMITTED" || provisioning.transactionHash === null) {
      return provisioning;
    }

    const status = await this.getTransactionStatus(provisioning.transactionHash);
    if (status === "success") {
      const state = await this.getAccountState(address);
      if (isStellarAccountProvisioned(state)) {
        return this.repository.markActive(userId, provisioning.id);
      }
      await this.repository.markFailed(userId, provisioning.id, "onchain_state_mismatch");
      return { ...provisioning, status: "FAILED", failureCode: "onchain_state_mismatch" };
    }

    if (status === "failed" || provisioning.updatedAt.getTime() < Date.now() - submittedLeaseMs) {
      const failureCode = status === "failed" ? "transaction_failed" : "transaction_expired";
      await this.repository.markFailed(userId, provisioning.id, failureCode);
      return { ...provisioning, status: "FAILED", failureCode };
    }

    return provisioning;
  }

  private async completeActivation(
    userId: string,
    provisioning: StellarProvisioningRecord,
    customer: CurrentBlindPayCustomer | undefined,
    address: string,
  ): Promise<StellarActivationView> {
    const active =
      provisioning.status === "ACTIVE"
        ? provisioning
        : await this.repository.markActive(userId, provisioning.id);

    // Stellar setup does not depend on KYC; only receiving (the bw_ wallet) does (D-23).
    if (
      customer === undefined ||
      !this.isOperational(customer) ||
      customer.externalBlockchainWalletId !== null
    ) {
      return this.toView(active);
    }
    if (customer.externalCustomerId === null) {
      throw new ConflictException({
        code: "blindpay_customer_not_operational",
        message: "The BlindPay customer is not ready for wallet registration.",
      });
    }

    try {
      const wallet = await this.blindPay.registerExternalStellarWallet(
        {
          customerId: customer.externalCustomerId,
          address,
          name: "Access Stellar wallet",
        },
        this.hashKey(`blindpay-wallet:${customer.id}:${address}`),
      );
      await this.repository.markWalletRegistered(userId, customer.id, wallet.id);
      return this.toView(active);
    } catch (error) {
      if (error instanceof BlindPayProviderError) {
        if (error.retryable) {
          throw new ServiceUnavailableException({
            code: "blindpay_wallet_registration_failed",
            message: "The external wallet could not be registered.",
          });
        }
        throw new BadGatewayException({
          code: "blindpay_wallet_registration_failed",
          message: "The external wallet could not be registered.",
        });
      }
      throw error;
    }
  }

  private async requireContext(principal: AuthenticatedPrincipal) {
    const user = await this.users.findByPrivyUserId(principal.privyUserId);
    if (user === null || user.wallet === null) {
      throw new NotFoundException({
        code: "account_not_bootstrapped",
        message: "The authenticated account has not been bootstrapped.",
      });
    }
    const producer = await this.producers.findByUserId(user.id);
    if (producer === null) {
      throw new NotFoundException({
        code: "producer_not_found",
        message: "The authenticated account does not have a producer profile.",
      });
    }
    return { user, wallet: user.wallet, customer: producer.blindPayCustomers[0] };
  }

  private isOperational(customer: CurrentBlindPayCustomer): boolean {
    return (
      customer.creationStatus === "CREATED" && operationalKycStatuses.has(customer.kycStatus ?? "")
    );
  }

  private async assertWalletOwnership(
    principal: AuthenticatedPrincipal,
    wallet: { privyWalletId: string; stellarAddress: string },
  ): Promise<void> {
    try {
      const current = await this.privy.findStellarWallet(principal.privyUserId);
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
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      throw this.mapActivationError(error);
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

  private mapActivationError(error: unknown): Error {
    if (error instanceof PrivyProviderUnavailableError) {
      return new ServiceUnavailableException({
        code: "wallet_signature_unavailable",
        message: "The wallet signature is temporarily unavailable.",
      });
    }
    if (error instanceof StellarProviderError) {
      return error.retryable
        ? new ServiceUnavailableException({
            code: "stellar_activation_failed",
            message: "The Stellar account could not be activated.",
          })
        : new BadGatewayException({
            code: "stellar_activation_failed",
            message: "The Stellar account could not be activated.",
          });
    }
    return error instanceof Error ? error : new Error("stellar_activation_failed");
  }

  private async getAccountState(address: string): Promise<StellarAccountState> {
    try {
      return await this.stellar.getAccountState(address);
    } catch (error) {
      throw this.mapActivationError(error);
    }
  }

  private async getTransactionStatus(transactionHash: string): Promise<StellarTransactionStatus> {
    try {
      return await this.stellar.getTransactionStatus(transactionHash);
    } catch (error) {
      throw this.mapActivationError(error);
    }
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

  private hashKey(value: string): string {
    return createHash("sha256").update(value).digest("hex");
  }

  private isFresh(updatedAt: Date): boolean {
    return updatedAt.getTime() >= Date.now() - preparedWindowMs;
  }

  // SIGNING without a prepared transaction is another request still building it.
  private toView(provisioning: StellarProvisioningRecord): StellarActivationView {
    switch (provisioning.status) {
      case "SIGNING":
        if (provisioning.transactionHash === null || provisioning.preparedEnvelopeXdr === null) {
          throw this.unavailable();
        }
        return { status: "signing", hashToSign: provisioning.transactionHash };
      case "SUBMITTED":
        return { status: "submitted", transactionHash: provisioning.transactionHash };
      case "ACTIVE":
        return { status: "active", transactionHash: provisioning.transactionHash };
      default:
        throw this.unavailable();
    }
  }

  private unavailable(): ServiceUnavailableException {
    return new ServiceUnavailableException({
      code: "stellar_activation_unavailable",
      message: "Stellar activation is temporarily unavailable.",
    });
  }
}
