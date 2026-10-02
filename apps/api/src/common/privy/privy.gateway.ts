import {
  type PrivyGateway,
  type PrivyIdentity,
  PrivyProviderUnavailableError,
  type PrivyStellarWallet,
  type VerifiedPrivyPrincipal,
} from "./privy.types";

const STELLAR_ADDRESS_PATTERN = /^G[A-Z2-7]{55}$/;

interface PrivyUserResponse {
  id: string;
  is_guest: boolean;
  linked_accounts: Array<{
    type: string;
    address?: string;
    verified_at?: number;
    latest_verified_at?: number | null;
  }>;
}

interface PrivyEmailAccount {
  type: "email";
  address: string;
  verified_at: number;
  latest_verified_at?: number | null;
}

interface PrivyWalletResponse {
  id: string;
  address: string;
  chain_type: string;
  owner_id: string | null;
  entity?: { id: string; type: string } | null;
}

interface PrivyClientLike {
  utils(): {
    auth(): {
      verifyAccessToken(token: string): Promise<{ user_id: string; session_id: string }>;
    };
  };
  users(): {
    _get(privyUserId: string): Promise<PrivyUserResponse>;
  };
  wallets(): {
    list(query: { chain_type: "stellar"; user_id: string }): AsyncIterable<PrivyWalletResponse>;
    create(input: {
      chain_type: "stellar";
      owner: { user_id: string };
      entity: { id: string; type: "user" };
      idempotency_key: string;
    }): Promise<PrivyWalletResponse>;
    rawSign(
      walletId: string,
      input: {
        params: { hash: string };
        authorization_context: { user_jwts: string[] };
        idempotency_key: string;
      },
    ): Promise<{ signature: string; encoding: "hex" }>;
  };
}

export interface PrivySdkGatewayOptions {
  appId: string;
  appSecret: string;
  jwtVerificationKey: string;
  timeoutMs: number;
}

export class PrivySdkGateway implements PrivyGateway {
  private clientPromise: Promise<PrivyClientLike> | undefined;
  private readonly timeoutMs: number;

  constructor(private readonly options: PrivySdkGatewayOptions) {
    this.timeoutMs = options.timeoutMs;
  }

  async verifyAccessToken(token: string): Promise<VerifiedPrivyPrincipal> {
    const result = await this.execute("verify_access_token", async () => {
      const client = await this.getClient();
      return client.utils().auth().verifyAccessToken(token);
    });

    return {
      privyUserId: result.user_id,
      sessionId: result.session_id,
    };
  }

  async getIdentity(privyUserId: string): Promise<PrivyIdentity> {
    const user = await this.execute("get_identity", async () => {
      const client = await this.getClient();
      return client.users()._get(privyUserId);
    });
    const verifiedEmail = this.getVerifiedEmail(user);

    if (user.id !== privyUserId || user.is_guest || verifiedEmail === null) {
      throw new PrivyProviderUnavailableError("get_identity_invalid_response");
    }

    return { privyUserId: user.id, verifiedEmail };
  }

  async findStellarWallet(privyUserId: string): Promise<PrivyStellarWallet | null> {
    return this.execute("find_stellar_wallet", async () => {
      const client = await this.getClient();
      for await (const wallet of client.wallets().list({
        chain_type: "stellar",
        user_id: privyUserId,
      })) {
        return this.toStellarWallet(wallet, privyUserId, false);
      }

      return null;
    });
  }

  async createStellarWallet(
    privyUserId: string,
    idempotencyKey: string,
  ): Promise<PrivyStellarWallet> {
    const wallet = await this.execute("create_stellar_wallet", async () => {
      const client = await this.getClient();
      return client.wallets().create({
        chain_type: "stellar",
        owner: { user_id: privyUserId },
        entity: { id: privyUserId, type: "user" },
        idempotency_key: idempotencyKey,
      });
    });

    return this.toStellarWallet(wallet, privyUserId, true);
  }

  async rawSignStellarHash(
    walletId: string,
    hash: string,
    userJwt: string,
    idempotencyKey: string,
  ): Promise<string> {
    if (!/^[0-9a-f]{64}$/.test(hash) || userJwt.length === 0 || idempotencyKey.length === 0) {
      throw new PrivyProviderUnavailableError("raw_sign_invalid_input");
    }

    const result = await this.execute("raw_sign_stellar", async () => {
      const client = await this.getClient();
      return client.wallets().rawSign(walletId, {
        params: { hash: `0x${hash}` },
        authorization_context: { user_jwts: [userJwt] },
        idempotency_key: idempotencyKey,
      });
    });

    if (result.encoding !== "hex" || !/^0x[0-9a-fA-F]{128}$/.test(result.signature)) {
      throw new PrivyProviderUnavailableError("raw_sign_stellar_invalid_response");
    }

    return result.signature;
  }

  private getVerifiedEmail(user: PrivyUserResponse): string | null {
    const emails = user.linked_accounts
      .filter(
        (account): account is PrivyEmailAccount =>
          account.type === "email" &&
          typeof account.address === "string" &&
          typeof account.verified_at === "number" &&
          account.verified_at > 0,
      )
      .sort(
        (left, right) =>
          (right.latest_verified_at ?? right.verified_at) -
          (left.latest_verified_at ?? left.verified_at),
      );
    const email = emails[0]?.address.trim().toLowerCase();

    return email && email.length <= 320 ? email : null;
  }

  private toStellarWallet(
    wallet: PrivyWalletResponse,
    privyUserId: string,
    requireEntity: boolean,
  ): PrivyStellarWallet {
    // Privy resolves the user's DID to its canonical entity ID in the response.
    // Ownership is proven by the user-scoped lookup/create request; the response
    // must still identify the assigned entity as a user.
    const hasUserEntity = wallet.entity?.type === "user";

    if (
      wallet.chain_type !== "stellar" ||
      !wallet.id ||
      !STELLAR_ADDRESS_PATTERN.test(wallet.address) ||
      !wallet.owner_id ||
      (requireEntity && !hasUserEntity)
    ) {
      throw new PrivyProviderUnavailableError("stellar_wallet_invalid_response");
    }

    return {
      id: wallet.id,
      address: wallet.address,
      chainType: "stellar",
      ownerPrivyUserId: privyUserId,
    };
  }

  private async execute<T>(operation: string, action: () => Promise<T>): Promise<T> {
    let timeout: ReturnType<typeof setTimeout> | undefined;

    try {
      const timeoutPromise = new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new PrivyProviderUnavailableError(`${operation}_timeout`)),
          this.timeoutMs,
        );
      });

      return await Promise.race([action(), timeoutPromise]);
    } catch (error) {
      if (error instanceof PrivyProviderUnavailableError) {
        throw error;
      }

      throw new PrivyProviderUnavailableError(operation);
    } finally {
      if (timeout !== undefined) {
        clearTimeout(timeout);
      }
    }
  }

  private getClient(): Promise<PrivyClientLike> {
    if (this.clientPromise === undefined) {
      this.clientPromise = import("@privy-io/node").then(
        ({ PrivyClient: Client }) =>
          new Client({
            appId: this.options.appId,
            appSecret: this.options.appSecret,
            jwtVerificationKey: this.options.jwtVerificationKey,
            timeout: this.options.timeoutMs,
            maxRetries: 0,
          }),
      );
    }

    return this.clientPromise;
  }
}
