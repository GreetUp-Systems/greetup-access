export interface VerifiedPrivyPrincipal {
  privyUserId: string;
  sessionId: string;
}

export interface PrivyIdentity {
  privyUserId: string;
  verifiedEmail: string;
}

export interface PrivyStellarWallet {
  id: string;
  address: string;
  chainType: "stellar";
  ownerPrivyUserId: string;
}

export interface PrivyGateway {
  verifyAccessToken(token: string): Promise<VerifiedPrivyPrincipal>;
  getIdentity(privyUserId: string): Promise<PrivyIdentity>;
  findStellarWallet(privyUserId: string): Promise<PrivyStellarWallet | null>;
  createStellarWallet(privyUserId: string, idempotencyKey: string): Promise<PrivyStellarWallet>;
}

export class PrivyProviderUnavailableError extends Error {
  constructor(readonly operation: string) {
    super(`Privy operation failed: ${operation}`);
    this.name = "PrivyProviderUnavailableError";
  }
}

export const PRIVY_GATEWAY = Symbol("PRIVY_GATEWAY");
