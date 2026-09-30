import { createHash } from "node:crypto";

import { Prisma } from "@access/database";
import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";

import {
  PRIVY_GATEWAY,
  type PrivyGateway,
  PrivyProviderUnavailableError,
  type PrivyStellarWallet,
} from "../common/privy/privy.types";
import { type AccountView } from "../users/users.types";
import { UsersRepository, type UserWithWallet } from "../users/users.repository";
import { type AuthenticatedPrincipal } from "./auth.types";

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UsersRepository,
    @Inject(PRIVY_GATEWAY) private readonly privy: PrivyGateway,
  ) {}

  async bootstrap(principal: AuthenticatedPrincipal): Promise<AccountView> {
    try {
      const identity = await this.privy.getIdentity(principal.privyUserId);
      if (identity.privyUserId !== principal.privyUserId) {
        throw new PrivyProviderUnavailableError("identity_owner_mismatch");
      }

      const user = await this.users.upsertIdentity(principal.privyUserId, identity.verifiedEmail);

      if (user.wallet !== null) {
        return this.toView(user);
      }

      const wallet =
        (await this.privy.findStellarWallet(principal.privyUserId)) ??
        (await this.privy.createStellarWallet(
          principal.privyUserId,
          this.walletIdempotencyKey(principal.privyUserId),
        ));
      this.assertWalletOwner(wallet, principal.privyUserId);

      try {
        return this.toView(await this.users.attachWallet(user.id, wallet.id, wallet.address));
      } catch (error) {
        if (!this.isUniqueConstraintError(error)) {
          throw error;
        }

        const winner = await this.users.findByPrivyUserId(principal.privyUserId);
        if (winner?.wallet !== null && winner?.wallet !== undefined) {
          return this.toView(winner);
        }

        throw this.identityConflict();
      }
    } catch (error) {
      if (error instanceof PrivyProviderUnavailableError) {
        this.logger.warn("Privy operation failed during bootstrap.");
        throw new ServiceUnavailableException({
          code: "identity_provider_unavailable",
          message: "The identity provider is temporarily unavailable.",
        });
      }

      if (this.isUniqueConstraintError(error)) {
        throw this.identityConflict();
      }

      throw error;
    }
  }

  async me(principal: AuthenticatedPrincipal): Promise<AccountView> {
    const account = await this.users.findByPrivyUserId(principal.privyUserId);

    if (account === null || account.wallet === null) {
      throw new NotFoundException({
        code: "account_not_bootstrapped",
        message: "The authenticated account has not been bootstrapped.",
      });
    }

    return this.toView(account);
  }

  private assertWalletOwner(wallet: PrivyStellarWallet, privyUserId: string): void {
    if (wallet.chainType !== "stellar" || wallet.ownerPrivyUserId !== privyUserId) {
      throw new PrivyProviderUnavailableError("stellar_wallet_owner_mismatch");
    }
  }

  private walletIdempotencyKey(privyUserId: string): string {
    const digest = createHash("sha256").update(privyUserId).digest("hex").slice(0, 40);
    return `access-stellar-${digest}`;
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
  }

  private identityConflict(): ConflictException {
    return new ConflictException({
      code: "identity_conflict",
      message: "The identity could not be linked to this account.",
    });
  }

  private toView(account: UserWithWallet): AccountView {
    if (account.wallet === null) {
      throw new Error("Wallet is required for an account response.");
    }

    return {
      user: { id: account.id, email: account.email },
      wallet: { address: account.wallet.stellarAddress, chainType: "stellar" },
    };
  }
}
