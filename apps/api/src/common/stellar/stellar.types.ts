export interface StellarTrustline {
  code: string;
  issuer: string;
}

export interface StellarAccountState {
  accountExists: boolean;
  missingTrustlines: StellarTrustline[];
}

export function isStellarAccountProvisioned(state: StellarAccountState): boolean {
  return state.accountExists && state.missingTrustlines.length === 0;
}

/**
 * How long a prepared provisioning transaction stays valid on the network. The browser signs it
 * within this window (D-28); after it, the transaction is prepared again.
 */
export const PROVISIONING_TRANSACTION_TIMEOUT_SECONDS = 180;

export interface PreparedStellarProvisioning {
  transactionXdr: string;
  transactionHash: string;
}

export type StellarTransactionStatus = "not_found" | "success" | "failed";

export interface StellarGateway {
  getAccountState(address: string): Promise<StellarAccountState>;
  buildProvisioningTransaction(
    producerAddress: string,
    state: StellarAccountState,
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
