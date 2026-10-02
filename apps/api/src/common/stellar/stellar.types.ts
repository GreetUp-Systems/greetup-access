export interface StellarAccountState {
  accountExists: boolean;
  trustlineExists: boolean;
}

export interface PreparedStellarProvisioning {
  transactionXdr: string;
  transactionHash: string;
}

export type StellarTransactionStatus = "not_found" | "success" | "failed";

export interface StellarGateway {
  getAccountState(address: string): Promise<StellarAccountState>;
  buildProvisioningTransaction(
    producerAddress: string,
    accountExists: boolean,
  ): Promise<PreparedStellarProvisioning>;
  submitProvisioningTransaction(
    prepared: PreparedStellarProvisioning,
    producerAddress: string,
    producerSignature: string,
  ): Promise<{ transactionHash: string }>;
  getTransactionStatus(transactionHash: string): Promise<StellarTransactionStatus>;
}

export class StellarProviderError extends Error {
  constructor(
    readonly operation: string,
    readonly retryable: boolean,
    readonly providerCode?: string,
  ) {
    super(`Stellar operation failed: ${operation}`);
    this.name = "StellarProviderError";
  }
}

export const STELLAR_GATEWAY = Symbol("STELLAR_GATEWAY");
export const STELLAR_ACTIVATION_CONFIG = Symbol("STELLAR_ACTIVATION_CONFIG");
