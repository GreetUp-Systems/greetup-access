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
  BLINDPAY_GATEWAY,
  type BlindPayGateway,
  BlindPayProviderError,
} from "../common/blindpay/blindpay.types";
import {
  PRIVY_GATEWAY,
  type PrivyGateway,
  PrivyProviderUnavailableError,
} from "../common/privy/privy.types";
import {
  STELLAR_GATEWAY,
  STELLAR_ACTIVATION_CONFIG,
  type PreparedStellarProvisioning,
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
import { ProducersRepository } from "./producers.repository";

const signingLeaseMs = 4 * 60 * 1_000;
const operationalKycStatuses = new Set(["APPROVED", "APPROVED_RFI"]);

export interface StellarActivationView {
  status: "signing" | "submitted" | "active";
  transactionHash: string | null;
}

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
    private readonly config: Pick<
      ApiConfig,
      "stellarNetwork" | "stellarAssetCode" | "stellarAssetIssuer"
    >,
  ) {}

  async activate(principal: AuthenticatedPrincipal): Promise<StellarActivationView> {
    const { user, wallet, customer } = await this.requireContext(principal);
    await this.assertWalletOwnership(principal, wallet);

    let provisioning = await this.repository.ensure(
      user.id,
      wallet.id,
      this.config.stellarNetwork,
      this.config.stellarAssetCode,
      this.config.stellarAssetIssuer,
    );

    const initialState = await this.getAccountState(wallet.stellarAddress);
    if (initialState.accountExists && initialState.trustlineExists) {
      return this.completeActivation(user.id, provisioning, customer, wallet.stellarAddress);
    }

    provisioning = await this.reconcileSubmitted(user.id, provisioning, wallet.stellarAddress);
    if (provisioning.status === "ACTIVE") {
      return this.completeActivation(user.id, provisioning, customer, wallet.stellarAddress);
    }
    if (provisioning.status === "SUBMITTED") {
      return this.toView(provisioning);
    }
    if (provisioning.status === "SIGNING" && !this.isStale(provisioning.updatedAt)) {
      return this.toView(provisioning);
    }

    const claimed = await this.repository.claimSigning(
      user.id,
      provisioning.id,
      new Date(Date.now() - signingLeaseMs),
    );
    if (claimed === null) {
      const winner = await this.repository.find(user.id);
      if (winner === null) {
        throw new ServiceUnavailableException({
          code: "stellar_activation_unavailable",
          message: "Stellar activation is temporarily unavailable.",
        });
      }
      return this.toView(winner);
    }

    let prepared: PreparedStellarProvisioning;
    try {
      prepared = await this.stellar.buildProvisioningTransaction(
        wallet.stellarAddress,
        initialState.accountExists,
      );
      const signature = await this.privy.rawSignStellarHash(
        wallet.privyWalletId,
        prepared.transactionHash,
        principal.accessToken,
        this.hashKey(`privy:${prepared.transactionHash}`),
      );
      provisioning = await this.repository.markSubmitted(user.id, claimed.id, prepared.transactionHash);

      try {
        await this.stellar.submitProvisioningTransaction(
          prepared,
          wallet.stellarAddress,
          signature,
        );
      } catch (error) {
        if (error instanceof StellarProviderError && error.retryable) {
          return this.toView(provisioning);
        }
        await this.repository.markFailed(user.id, claimed.id, this.failureCode(error));
        throw error;
      }
    } catch (error) {
      if (provisioning.status !== "SUBMITTED") {
        await this.repository.markFailed(user.id, claimed.id, this.failureCode(error));
      }
      throw this.mapActivationError(error);
    }

    const confirmed = await this.getAccountState(wallet.stellarAddress);
    if (!confirmed.accountExists || !confirmed.trustlineExists) {
      return this.toView(provisioning);
    }

    return this.completeActivation(user.id, provisioning, customer, wallet.stellarAddress);
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
      if (state.accountExists && state.trustlineExists) {
        return this.repository.markActive(userId, provisioning.id);
      }
      await this.repository.markFailed(userId, provisioning.id, "onchain_state_mismatch");
      return { ...provisioning, status: "FAILED", failureCode: "onchain_state_mismatch" };
    }

    if (status === "failed" || this.isStale(provisioning.updatedAt)) {
      const failureCode = status === "failed" ? "transaction_failed" : "transaction_expired";
      await this.repository.markFailed(userId, provisioning.id, failureCode);
      return { ...provisioning, status: "FAILED", failureCode };
    }

    return provisioning;
  }

  private async completeActivation(
    userId: string,
    provisioning: StellarProvisioningRecord,
    customer: {
      id: string;
      externalCustomerId: string | null;
      externalBlockchainWalletId: string | null;
    },
    address: string,
  ): Promise<StellarActivationView> {
    const active =
      provisioning.status === "ACTIVE"
        ? provisioning
        : await this.repository.markActive(userId, provisioning.id);

    if (customer.externalBlockchainWalletId !== null) {
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
    const customer = producer.blindPayCustomers[0];
    if (
      customer === undefined ||
      customer.creationStatus !== "CREATED" ||
      !operationalKycStatuses.has(customer.kycStatus ?? "")
    ) {
      throw new ConflictException({
        code: "blindpay_customer_not_operational",
        message: "KYC approval is required before Stellar activation.",
      });
    }
    return { user, wallet: user.wallet, customer };
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

  private isStale(updatedAt: Date): boolean {
    return updatedAt.getTime() < Date.now() - signingLeaseMs;
  }

  private toView(provisioning: StellarProvisioningRecord): StellarActivationView {
    const status = provisioning.status.toLowerCase();
    if (status !== "signing" && status !== "submitted" && status !== "active") {
      throw new ServiceUnavailableException({
        code: "stellar_activation_unavailable",
        message: "Stellar activation is temporarily unavailable.",
      });
    }
    return { status, transactionHash: provisioning.transactionHash };
  }
}
