import { ConflictException } from "@nestjs/common";

import { type PrivyGateway } from "../common/privy/privy.types";
import { type StellarGateway, StellarProviderError } from "../common/stellar/stellar.types";
import { type UserWithWallet, UsersRepository } from "../users/users.repository";
import {
  AccountActivationRepository,
  type WalletActivationRecord,
} from "./account-activation.repository";
import { AccountActivationService } from "./account-activation.service";

const now = new Date();
const principal = { privyUserId: "did:privy:buyer", sessionId: "session", accessToken: "user-jwt" };
const wallet = {
  id: "00000000-0000-4000-8000-000000000002",
  userId: "00000000-0000-4000-8000-000000000001",
  privyWalletId: "wallet-id",
  stellarAddress: `G${"B".repeat(55)}`,
  createdAt: now,
  updatedAt: now,
};
const baseUser: UserWithWallet = {
  id: wallet.userId,
  privyUserId: principal.privyUserId,
  email: "buyer@example.com",
  spontaneousLoginAt: null,
  createdAt: now,
  updatedAt: now,
  wallet,
};
const activation: WalletActivationRecord = {
  id: "00000000-0000-4000-8000-000000000009",
  userId: wallet.userId,
  walletAccountId: wallet.id,
  network: "testnet",
  status: "PENDING",
  transactionHash: null,
  failureCode: null,
  activatedAt: null,
  createdAt: now,
  updatedAt: now,
};
const unfunded = { accountExists: false, missingTrustlines: [] };
const funded = { accountExists: true, missingTrustlines: [] };

describe("AccountActivationService", () => {
  let users: jest.Mocked<Pick<UsersRepository, "findByPrivyUserId">>;
  let repository: jest.Mocked<
    Pick<
      AccountActivationRepository,
      | "ensure"
      | "hasPaidPurchase"
      | "claimSigning"
      | "find"
      | "markSubmitted"
      | "markActive"
      | "markFailed"
    >
  >;
  let privy: jest.Mocked<Pick<PrivyGateway, "findStellarWallet" | "rawSignStellarHash">>;
  let stellar: jest.Mocked<StellarGateway>;
  let service: AccountActivationService;

  beforeEach(() => {
    users = {
      findByPrivyUserId: jest.fn().mockResolvedValue({ ...baseUser, spontaneousLoginAt: now }),
    };
    repository = {
      ensure: jest.fn().mockResolvedValue(activation),
      hasPaidPurchase: jest.fn().mockResolvedValue(false),
      claimSigning: jest.fn().mockResolvedValue({ ...activation, status: "SIGNING" }),
      find: jest.fn().mockResolvedValue(activation),
      markSubmitted: jest
        .fn()
        .mockImplementation((_userId, _id, transactionHash: string) =>
          Promise.resolve({ ...activation, status: "SUBMITTED", transactionHash }),
        ),
      markActive: jest
        .fn()
        .mockImplementation(() =>
          Promise.resolve({ ...activation, status: "ACTIVE", transactionHash: "a".repeat(64) }),
        ),
      markFailed: jest.fn().mockResolvedValue({ ...activation, status: "FAILED" }),
    };
    privy = {
      findStellarWallet: jest.fn().mockResolvedValue({
        id: wallet.privyWalletId,
        address: wallet.stellarAddress,
        chainType: "stellar",
        ownerPrivyUserId: principal.privyUserId,
      }),
      rawSignStellarHash: jest.fn().mockResolvedValue(`0x${"01".repeat(64)}`),
    };
    stellar = {
      getAccountState: jest.fn().mockResolvedValueOnce(unfunded).mockResolvedValueOnce(funded),
      buildProvisioningTransaction: jest
        .fn()
        .mockResolvedValue({ transactionXdr: "xdr", transactionHash: "a".repeat(64) }),
      submitProvisioningTransaction: jest
        .fn()
        .mockResolvedValue({ transactionHash: "a".repeat(64) }),
      getTransactionStatus: jest.fn().mockResolvedValue("not_found"),
    };
    service = new AccountActivationService(
      users as unknown as UsersRepository,
      repository as unknown as AccountActivationRepository,
      privy as unknown as PrivyGateway,
      stellar,
      { stellarNetwork: "testnet" },
    );
  });

  it("creates only the account, signed by the user's wallet with their own JWT", async () => {
    await expect(service.activate(principal)).resolves.toEqual({
      status: "active",
      transactionHash: "a".repeat(64),
    });

    expect(stellar.buildProvisioningTransaction).toHaveBeenCalledWith(wallet.stellarAddress, {
      accountExists: false,
      missingTrustlines: [],
    });
    expect(privy.rawSignStellarHash).toHaveBeenCalledWith(
      wallet.privyWalletId,
      "a".repeat(64),
      principal.accessToken,
      expect.stringMatching(/^[0-9a-f]{64}$/),
    );
  });

  it("refuses a checkout-only account without a paid purchase", async () => {
    users.findByPrivyUserId.mockResolvedValue(baseUser);

    await expect(service.activate(principal)).rejects.toMatchObject({
      response: { code: "account_activation_not_allowed" },
    });
    expect(repository.ensure).not.toHaveBeenCalled();
    expect(stellar.buildProvisioningTransaction).not.toHaveBeenCalled();
  });

  it("accepts a checkout-only account once it has a paid purchase", async () => {
    users.findByPrivyUserId.mockResolvedValue(baseUser);
    repository.hasPaidPurchase.mockResolvedValue(true);

    await expect(service.activate(principal)).resolves.toMatchObject({ status: "active" });
  });

  it("only records an account that already exists on the ledger", async () => {
    stellar.getAccountState.mockReset().mockResolvedValue(funded);

    await expect(service.activate(principal)).resolves.toMatchObject({ status: "active" });
    expect(stellar.buildProvisioningTransaction).not.toHaveBeenCalled();
    expect(privy.rawSignStellarHash).not.toHaveBeenCalled();
  });

  it("does not build a second transaction while a recent one is pending", async () => {
    repository.ensure.mockResolvedValue({
      ...activation,
      status: "SUBMITTED",
      transactionHash: "c".repeat(64),
      updatedAt: new Date(),
    });
    stellar.getAccountState.mockReset().mockResolvedValue(unfunded);

    await expect(service.activate(principal)).resolves.toEqual({
      status: "submitted",
      transactionHash: "c".repeat(64),
    });
    expect(repository.claimSigning).not.toHaveBeenCalled();
  });

  it("keeps an uncertain submission pending and fails a rejected one", async () => {
    stellar.getAccountState.mockReset().mockResolvedValue(unfunded);
    stellar.submitProvisioningTransaction.mockRejectedValueOnce(
      new StellarProviderError("submit_provisioning", true),
    );
    await expect(service.activate(principal)).resolves.toMatchObject({ status: "submitted" });
    expect(repository.markFailed).not.toHaveBeenCalled();

    stellar.submitProvisioningTransaction.mockRejectedValueOnce(
      new StellarProviderError("submit_provisioning", false, "tx_bad_auth"),
    );
    await expect(service.activate(principal)).rejects.toMatchObject({
      response: { code: "account_activation_failed" },
    });
    expect(repository.markFailed).toHaveBeenCalledWith(baseUser.id, activation.id, "tx_bad_auth");
  });

  it("rejects a Privy wallet that is not the stored one", async () => {
    privy.findStellarWallet.mockResolvedValue({
      id: "another",
      address: wallet.stellarAddress,
      chainType: "stellar",
      ownerPrivyUserId: principal.privyUserId,
    });

    await expect(service.activate(principal)).rejects.toBeInstanceOf(ConflictException);
    expect(repository.ensure).not.toHaveBeenCalled();
  });
});
