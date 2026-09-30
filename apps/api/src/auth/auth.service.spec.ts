import { type PrivyGateway, PrivyProviderUnavailableError } from "../common/privy/privy.types";
import { UsersRepository, type UserWithWallet } from "../users/users.repository";
import { AuthService } from "./auth.service";

const principal = { privyUserId: "did:privy:user-1", sessionId: "session-1" };
const now = new Date("2026-09-29T00:00:00.000Z");
const stellarAddress = `G${"A".repeat(55)}`;
type WalletAccount = NonNullable<UserWithWallet["wallet"]>;

function user(wallet: WalletAccount | null): UserWithWallet {
  return {
    id: "3a7cd71d-5104-4697-8729-b5c977864209",
    privyUserId: principal.privyUserId,
    email: "verified@example.com",
    createdAt: now,
    updatedAt: now,
    wallet,
  };
}

function wallet(): WalletAccount {
  return {
    id: "0da9c592-0499-442d-b0d4-8dc4095e68ad",
    userId: user(null).id,
    privyWalletId: "wallet-1",
    stellarAddress,
    createdAt: now,
    updatedAt: now,
  };
}

describe("AuthService", () => {
  let users: jest.Mocked<
    Pick<UsersRepository, "upsertIdentity" | "findByPrivyUserId" | "attachWallet">
  >;
  let privy: jest.Mocked<PrivyGateway>;
  let service: AuthService;

  beforeEach(() => {
    users = {
      upsertIdentity: jest.fn(),
      findByPrivyUserId: jest.fn(),
      attachWallet: jest.fn(),
    };
    privy = {
      verifyAccessToken: jest.fn(),
      getIdentity: jest.fn(),
      findStellarWallet: jest.fn(),
      createStellarWallet: jest.fn(),
    };
    service = new AuthService(users as unknown as UsersRepository, privy);
  });

  it("uses only the verified Privy identity and creates a stable user-owned wallet", async () => {
    privy.getIdentity.mockResolvedValue({
      privyUserId: principal.privyUserId,
      verifiedEmail: "verified@example.com",
    });
    users.upsertIdentity.mockResolvedValue(user(null));
    privy.findStellarWallet.mockResolvedValue(null);
    privy.createStellarWallet.mockResolvedValue({
      id: "wallet-1",
      address: stellarAddress,
      chainType: "stellar",
      ownerPrivyUserId: principal.privyUserId,
    });
    users.attachWallet.mockResolvedValue(user(wallet()));

    await expect(service.bootstrap(principal)).resolves.toEqual({
      user: { id: user(null).id, email: "verified@example.com" },
      wallet: { address: stellarAddress, chainType: "stellar" },
    });

    expect(users.upsertIdentity).toHaveBeenCalledWith(
      principal.privyUserId,
      "verified@example.com",
    );
    expect(privy.createStellarWallet).toHaveBeenCalledWith(
      principal.privyUserId,
      expect.stringMatching(/^access-stellar-[a-f0-9]{40}$/),
    );
  });

  it("reuses the persisted wallet without another Privy wallet lookup", async () => {
    privy.getIdentity.mockResolvedValue({
      privyUserId: principal.privyUserId,
      verifiedEmail: "verified@example.com",
    });
    users.upsertIdentity.mockResolvedValue(user(wallet()));

    await service.bootstrap(principal);

    expect(privy.findStellarWallet).not.toHaveBeenCalled();
    expect(privy.createStellarWallet).not.toHaveBeenCalled();
  });

  it("persists an existing Stellar wallet found at Privy", async () => {
    privy.getIdentity.mockResolvedValue({
      privyUserId: principal.privyUserId,
      verifiedEmail: "verified@example.com",
    });
    users.upsertIdentity.mockResolvedValue(user(null));
    privy.findStellarWallet.mockResolvedValue({
      id: "wallet-1",
      address: stellarAddress,
      chainType: "stellar",
      ownerPrivyUserId: principal.privyUserId,
    });
    users.attachWallet.mockResolvedValue(user(wallet()));

    await service.bootstrap(principal);

    expect(users.attachWallet).toHaveBeenCalledWith(user(null).id, "wallet-1", stellarAddress);
    expect(privy.createStellarWallet).not.toHaveBeenCalled();
  });

  it("fails closed when the wallet owner differs", async () => {
    privy.getIdentity.mockResolvedValue({
      privyUserId: principal.privyUserId,
      verifiedEmail: "verified@example.com",
    });
    users.upsertIdentity.mockResolvedValue(user(null));
    privy.findStellarWallet.mockResolvedValue({
      id: "wallet-1",
      address: stellarAddress,
      chainType: "stellar",
      ownerPrivyUserId: "did:privy:another-user",
    });

    await expect(service.bootstrap(principal)).rejects.toMatchObject({
      response: { code: "identity_provider_unavailable" },
    });
  });

  it("fails closed when Privy returns a wallet from another chain", async () => {
    privy.getIdentity.mockResolvedValue({
      privyUserId: principal.privyUserId,
      verifiedEmail: "verified@example.com",
    });
    users.upsertIdentity.mockResolvedValue(user(null));
    privy.findStellarWallet.mockResolvedValue({
      id: "wallet-1",
      address: stellarAddress,
      chainType: "ethereum",
      ownerPrivyUserId: principal.privyUserId,
    } as unknown as Awaited<ReturnType<PrivyGateway["findStellarWallet"]>>);

    await expect(service.bootstrap(principal)).rejects.toMatchObject({
      response: { code: "identity_provider_unavailable" },
    });
  });

  it("does not expose provider error details", async () => {
    privy.getIdentity.mockRejectedValue(new PrivyProviderUnavailableError("secret-token-was-here"));

    await expect(service.bootstrap(principal)).rejects.toMatchObject({
      response: {
        code: "identity_provider_unavailable",
        message: "The identity provider is temporarily unavailable.",
      },
    });
  });
});
