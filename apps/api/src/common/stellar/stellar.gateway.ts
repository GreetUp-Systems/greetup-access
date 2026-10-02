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

import {
  type PreparedStellarProvisioning,
  type StellarAccountState,
  type StellarGateway,
  StellarProviderError,
  type StellarTransactionStatus,
} from "./stellar.types";

const transactionTimeoutSeconds = 180;
const stellarAddressPattern = /^G[A-Z2-7]{55}$/;
const signaturePattern = /^0x[0-9a-fA-F]{128}$/;

export interface StellarHorizonGatewayOptions {
  horizonUrl: string;
  assetCode: "USDB";
  assetIssuer: string;
  sponsorPublicKey: string;
  sponsorSecretKey: string;
}

export function buildSponsoredProvisioningTransaction(input: {
  sponsorAccount: Account;
  producerAddress: string;
  asset: Asset;
  accountExists: boolean;
}): Transaction {
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

  return builder
    .addOperation(
      Operation.changeTrust({
        asset: input.asset,
        source: input.producerAddress,
      }),
    )
    .addOperation(Operation.endSponsoringFutureReserves({ source: input.producerAddress }))
    .setTimeout(transactionTimeoutSeconds)
    .build();
}

export class StellarHorizonGateway implements StellarGateway {
  private readonly server: Horizon.Server;
  private readonly sponsor: Keypair;
  private readonly asset: Asset;

  constructor(private readonly options: StellarHorizonGatewayOptions) {
    this.sponsor = this.readSponsor(options.sponsorPublicKey, options.sponsorSecretKey);
    this.asset = new Asset(options.assetCode, options.assetIssuer);
    this.server = new Horizon.Server(options.horizonUrl);
  }

  async getAccountState(address: string): Promise<StellarAccountState> {
    this.assertAddress(address, "inspect_account");

    try {
      const account = await this.server.loadAccount(address);
      const trustlineExists = account.balances.some(
        (balance) =>
          balance.asset_type !== "native" &&
          balance.asset_type !== "liquidity_pool_shares" &&
          balance.asset_code === this.asset.getCode() &&
          balance.asset_issuer === this.asset.getIssuer(),
      );

      return { accountExists: true, trustlineExists };
    } catch (error) {
      if (error instanceof NotFoundError) {
        return { accountExists: false, trustlineExists: false };
      }
      throw this.mapError("inspect_account", error);
    }
  }

  async buildProvisioningTransaction(
    producerAddress: string,
    accountExists: boolean,
  ): Promise<PreparedStellarProvisioning> {
    this.assertAddress(producerAddress, "build_provisioning");

    try {
      const loadedSponsor = await this.server.loadAccount(this.options.sponsorPublicKey);
      const sponsorAccount = new Account(
        loadedSponsor.accountId(),
        loadedSponsor.sequenceNumber(),
      );
      const transaction = buildSponsoredProvisioningTransaction({
        sponsorAccount,
        producerAddress,
        asset: this.asset,
        accountExists,
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
    if (!signaturePattern.test(producerSignature)) {
      throw new StellarProviderError("producer_signature_invalid", false);
    }

    try {
      const parsed = TransactionBuilder.fromXDR(prepared.transactionXdr, Networks.TESTNET);
      if (!(parsed instanceof Transaction)) {
        throw new StellarProviderError("provisioning_envelope_invalid", false);
      }

      const actualHash = parsed.hash().toString("hex");
      if (actualHash !== prepared.transactionHash) {
        throw new StellarProviderError("provisioning_hash_mismatch", false);
      }

      const rawSignature = Buffer.from(producerSignature.slice(2), "hex");
      if (!Keypair.fromPublicKey(producerAddress).verify(parsed.hash(), rawSignature)) {
        throw new StellarProviderError("producer_signature_invalid", false);
      }
      parsed.addSignature(producerAddress, rawSignature.toString("base64"));
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
