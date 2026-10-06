import {
  Account,
  Asset,
  BASE_FEE,
  Horizon,
  Keypair,
  Networks,
  NotFoundError,
  Operation,
  Transaction,
  TransactionBuilder,
} from "@stellar/stellar-sdk";

import { isStellarHashSignature } from "./stellar-signature";
import {
  PROVISIONING_TRANSACTION_TIMEOUT_SECONDS,
  type PreparedStellarProvisioning,
  type StellarAccountState,
  type StellarGateway,
  StellarProviderError,
  type StellarTransactionStatus,
  type StellarTrustline,
} from "./stellar.types";

const stellarAddressPattern = /^G[A-Z2-7]{55}$/;

export interface StellarHorizonGatewayOptions {
  horizonUrl: string;
  trustlines: StellarTrustline[];
  sponsorPublicKey: string;
  sponsorSecretKey: string;
}

export function buildSponsoredProvisioningTransaction(input: {
  sponsorAccount: Account;
  producerAddress: string;
  assets: Asset[];
  accountExists: boolean;
}): Transaction {
  if (input.accountExists && input.assets.length === 0) {
    throw new StellarProviderError("provisioning_not_required", false);
  }

  let builder = new TransactionBuilder(input.sponsorAccount, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  }).addOperation(
    Operation.beginSponsoringFutureReserves({
      sponsoredId: input.producerAddress,
      source: input.sponsorAccount.accountId(),
    }),
  );

  if (!input.accountExists) {
    builder = builder.addOperation(
      Operation.createAccount({
        destination: input.producerAddress,
        startingBalance: "0",
        source: input.sponsorAccount.accountId(),
      }),
    );
  }

  for (const asset of input.assets) {
    builder = builder.addOperation(
      Operation.changeTrust({
        asset,
        source: input.producerAddress,
      }),
    );
  }

  return builder
    .addOperation(Operation.endSponsoringFutureReserves({ source: input.producerAddress }))
    .setTimeout(PROVISIONING_TRANSACTION_TIMEOUT_SECONDS)
    .build();
}

export class StellarHorizonGateway implements StellarGateway {
  private readonly server: Horizon.Server;
  private readonly sponsor: Keypair;

  constructor(private readonly options: StellarHorizonGatewayOptions) {
    if (options.trustlines.length === 0) {
      throw new Error("At least one Stellar trustline must be configured.");
    }
    this.sponsor = this.readSponsor(options.sponsorPublicKey, options.sponsorSecretKey);
    this.server = new Horizon.Server(options.horizonUrl);
  }

  async getAccountState(address: string): Promise<StellarAccountState> {
    this.assertAddress(address, "inspect_account");

    try {
      const account = await this.server.loadAccount(address);
      const missingTrustlines = this.options.trustlines.filter(
        (trustline) =>
          !account.balances.some(
            (balance) =>
              balance.asset_type !== "native" &&
              balance.asset_type !== "liquidity_pool_shares" &&
              balance.asset_code === trustline.code &&
              balance.asset_issuer === trustline.issuer,
          ),
      );

      return { accountExists: true, missingTrustlines };
    } catch (error) {
      if (error instanceof NotFoundError) {
        return { accountExists: false, missingTrustlines: [...this.options.trustlines] };
      }
      throw this.mapError("inspect_account", error);
    }
  }

  async buildProvisioningTransaction(
    producerAddress: string,
    state: StellarAccountState,
  ): Promise<PreparedStellarProvisioning> {
    this.assertAddress(producerAddress, "build_provisioning");
    const assets = state.missingTrustlines.map((trustline) => {
      if (!this.isConfiguredTrustline(trustline)) {
        throw new StellarProviderError("build_provisioning_unknown_asset", false);
      }
      return new Asset(trustline.code, trustline.issuer);
    });

    try {
      const loadedSponsor = await this.server.loadAccount(this.options.sponsorPublicKey);
      const sponsorAccount = new Account(loadedSponsor.accountId(), loadedSponsor.sequenceNumber());
      const transaction = buildSponsoredProvisioningTransaction({
        sponsorAccount,
        producerAddress,
        assets,
        accountExists: state.accountExists,
      });

      return {
        transactionXdr: transaction.toXDR(),
        transactionHash: transaction.hash().toString("hex"),
      };
    } catch (error) {
      throw this.mapError("build_provisioning", error);
    }
  }

  async submitProvisioningTransaction(
    prepared: PreparedStellarProvisioning,
    producerAddress: string,
    producerSignature: string,
  ): Promise<{ transactionHash: string }> {
    this.assertAddress(producerAddress, "submit_provisioning");

    try {
      const parsed = TransactionBuilder.fromXDR(prepared.transactionXdr, Networks.TESTNET);
      if (!(parsed instanceof Transaction)) {
        throw new StellarProviderError("provisioning_envelope_invalid", false);
      }

      const actualHash = parsed.hash().toString("hex");
      if (actualHash !== prepared.transactionHash) {
        throw new StellarProviderError("provisioning_hash_mismatch", false);
      }

      if (!isStellarHashSignature(actualHash, producerAddress, producerSignature)) {
        throw new StellarProviderError("producer_signature_invalid", false);
      }
      parsed.addSignature(
        producerAddress,
        Buffer.from(producerSignature.slice(2), "hex").toString("base64"),
      );
      parsed.sign(this.sponsor);

      const submitted = await this.server.submitTransaction(parsed);
      if (submitted.hash !== prepared.transactionHash) {
        throw new StellarProviderError("submitted_hash_mismatch", false);
      }

      return { transactionHash: submitted.hash };
    } catch (error) {
      throw this.mapError("submit_provisioning", error);
    }
  }

  async getTransactionStatus(transactionHash: string): Promise<StellarTransactionStatus> {
    if (!/^[0-9a-f]{64}$/.test(transactionHash)) {
      throw new StellarProviderError("transaction_hash_invalid", false);
    }

    try {
      const transaction = await this.server.transactions().transaction(transactionHash).call();
      return transaction.successful ? "success" : "failed";
    } catch (error) {
      if (error instanceof NotFoundError) {
        return "not_found";
      }
      throw this.mapError("get_transaction", error);
    }
  }

  private isConfiguredTrustline(trustline: StellarTrustline): boolean {
    return this.options.trustlines.some(
      (configured) => configured.code === trustline.code && configured.issuer === trustline.issuer,
    );
  }

  private readSponsor(publicKey: string, secretKey: string): Keypair {
    try {
      const sponsor = Keypair.fromSecret(secretKey);
      if (sponsor.publicKey() !== publicKey) {
        throw new Error("sponsor mismatch");
      }
      return sponsor;
    } catch {
      throw new Error("STELLAR_SPONSOR_PUBLIC_KEY does not match the configured secret.");
    }
  }

  private assertAddress(address: string, operation: string): void {
    if (!stellarAddressPattern.test(address)) {
      throw new StellarProviderError(`${operation}_invalid_address`, false);
    }
  }

  private mapError(operation: string, error: unknown): StellarProviderError {
    if (error instanceof StellarProviderError) {
      return error;
    }

    const response = this.responseFrom(error);
    const status = response?.status;
    const providerCode = this.resultCodeFrom(response?.data);
    const retryable = status === undefined || status === 408 || status === 429 || status >= 500;
    return new StellarProviderError(operation, retryable, providerCode);
  }

  private responseFrom(error: unknown): { status?: number; data?: unknown } | undefined {
    if (typeof error !== "object" || error === null || !("response" in error)) {
      return undefined;
    }
    const response = (error as { response?: unknown }).response;
    return typeof response === "object" && response !== null
      ? (response as { status?: number; data?: unknown })
      : undefined;
  }

  private resultCodeFrom(value: unknown): string | undefined {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return undefined;
    }
    const extras = (value as Record<string, unknown>).extras;
    if (typeof extras !== "object" || extras === null || Array.isArray(extras)) {
      return undefined;
    }
    const codes = (extras as Record<string, unknown>).result_codes;
    if (typeof codes !== "object" || codes === null || Array.isArray(codes)) {
      return undefined;
    }
    const transaction = (codes as Record<string, unknown>).transaction;
    return typeof transaction === "string" ? transaction.slice(0, 80) : undefined;
  }
}
