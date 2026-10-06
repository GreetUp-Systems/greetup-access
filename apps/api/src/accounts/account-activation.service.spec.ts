import { ConflictException } from "@nestjs/common";
import { Keypair } from "@stellar/stellar-sdk";

import { type PrivyGateway } from "../common/privy/privy.types";
import { type StellarGateway, StellarProviderError } from "../common/stellar/stellar.types";
import { type UserWithWallet, UsersRepository } from "../users/users.repository";
import {
  AccountActivationRepository,
  type WalletActivationRecord,
} from "./account-activation.repository";
import { AccountActivationService } from "./account-activation.service";

// The user's wallet, generated at runtime: it signs hashes the way signRawHash does (D-28).
const userKey = Keypair.random();
const otherKey = Keypair.random();
const sign = (key: Keypair, hash: string): string =>
  `0x${key.sign(Buffer.from(hash, "hex")).toString("hex")}`;

const hash = "a".repeat(64);
const now = new Date();
const principal = { privyUserId: "did:privy:buyer", sessionId: "session", accessToken: "user-jwt" };
const wallet = {
  id: "00000000-0000-4000-8000-000000000002",
  userId: "00000000-0000-4000-8000-000000000001",
  privyWalletId: "wallet-id",
  stellarAddress: userKey.publicKey(),
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
  preparedEnvelopeXdr: null,
  failureCode: null,
  activatedAt: null,
  createdAt: now,
  updatedAt: now,
};
const prepared: WalletActivationRecord = {
  ...activation,
  status: "SIGNING",
  transactionHash: hash,
  preparedEnvelopeXdr: "prepared-xdr",
  updatedAt: new Date(),
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
      | "savePrepared"
      | "claimSubmission"
      | "find"
      | "markActive"
      | "markFailed"
    >
  >;
  let privy: jest.Mocked<Pick<PrivyGateway, "findStellarWallet">>;
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
      savePrepared: jest
        .fn()
        .mockImplementation((_userId, _id, transactionHash: string, preparedEnvelopeXdr: string) =>
          Promise.resolve({ ...prepared, transactionHash, preparedEnvelopeXdr }),
        ),
      claimSubmission: jest.fn().mockResolvedValue({
        ...prepared,
        status: "SUBMITTED",
        preparedEnvelopeXdr: null,
      }),
      find: jest.fn().mockResolvedValue(prepared),
      markActive: jest
        .fn()
        .mockImplementation(() =>
          Promise.resolve({ ...activation, status: "ACTIVE", transactionHash: hash }),
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
    };
    stellar = {
      getAccountState: jest.fn().mockResolvedValue(unfunded),
      buildProvisioningTransaction: jest
        .fn()
        .mockResolvedValue({ transactionXdr: "prepared-xdr", transactionHash: hash }),
      submitProvisioningTransaction: jest.fn().mockResolvedValue({ transactionHash: hash }),
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

  describe("prepare", () => {
    it("prepares only the account and hands out the hash for the browser to sign", async () => {
      await expect(service.activate(principal)).resolves.toEqual({
        status: "signing",
        hashToSign: hash,
      });

      expect(stellar.buildProvisioningTransaction).toHaveBeenCalledWith(wallet.stellarAddress, {
        accountExists: false,
        missingTrustlines: [],
      });
      expect(repository.savePrepared).toHaveBeenCalledWith(
        baseUser.id,
        activation.id,
        hash,
        "prepared-xdr",
      );
      expect(stellar.submitProvisioningTransaction).not.toHaveBeenCalled();
    });

    it("hands out the same prepared transaction again while it is still valid", async () => {
      repository.ensure.mockResolvedValue(prepared);

      await expect(service.activate(principal)).resolves.toEqual({
        status: "signing",
        hashToSign: hash,
      });
      expect(repository.claimSigning).not.toHaveBeenCalled();
      expect(stellar.buildProvisioningTransaction).not.toHaveBeenCalled();
    });

    it("prepares again once the prepared transaction is too old to sign", async () => {
      repository.ensure.mockResolvedValue({
        ...prepared,
        updatedAt: new Date(Date.now() - 600_000),
      });

      await expect(service.activate(principal)).resolves.toMatchObject({ status: "signing" });
      expect(repository.claimSigning).toHaveBeenCalled();
      expect(stellar.buildProvisioningTransaction).toHaveBeenCalledTimes(1);
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

      await expect(service.activate(principal)).resolves.toMatchObject({ status: "signing" });
    });

    it("only records an account that already exists on the ledger", async () => {
      stellar.getAccountState.mockResolvedValue(funded);

      await expect(service.activate(principal)).resolves.toMatchObject({ status: "active" });
      expect(stellar.buildProvisioningTransaction).not.toHaveBeenCalled();
    });

    it("does not prepare a second transaction while a recent one is pending", async () => {
      repository.ensure.mockResolvedValue({
        ...activation,
        status: "SUBMITTED",
        transactionHash: "c".repeat(64),
        updatedAt: new Date(),
      });

      await expect(service.activate(principal)).resolves.toEqual({
        status: "submitted",
        transactionHash: "c".repeat(64),
      });
      expect(repository.claimSigning).not.toHaveBeenCalled();
    });

    it("records a failed preparation", async () => {
      stellar.buildProvisioningTransaction.mockRejectedValue(
        new StellarProviderError("build_provisioning", true),
      );

      await expect(service.activate(principal)).rejects.toMatchObject({
        response: { code: "account_activation_failed" },
      });
      expect(repository.markFailed).toHaveBeenCalledWith(
        baseUser.id,
        activation.id,
        "build_provisioning",
      );
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

  describe("signature", () => {
    const body = () => ({ hash, signature: sign(userKey, hash) });

    it("submits the prepared transaction with the user's signature", async () => {
      stellar.getAccountState.mockResolvedValue(funded);
      const input = body();

      await expect(service.submitSignature(principal, input)).resolves.toEqual({
        status: "active",
        transactionHash: hash,
      });
      expect(repository.claimSubmission).toHaveBeenCalledWith(baseUser.id, activation.id, hash);
      expect(stellar.submitProvisioningTransaction).toHaveBeenCalledWith(
        { transactionXdr: "prepared-xdr", transactionHash: hash },
        wallet.stellarAddress,
        input.signature,
      );
    });

    it("refuses a signature by another key without submitting", async () => {
      await expect(
        service.submitSignature(principal, { hash, signature: sign(otherKey, hash) }),
      ).rejects.toMatchObject({ response: { code: "invalid_activation_signature" } });
      expect(repository.claimSubmission).not.toHaveBeenCalled();
      expect(stellar.submitProvisioningTransaction).not.toHaveBeenCalled();
    });

    it("refuses a malformed body", async () => {
      for (const malformed of [
        null,
        [],
        { hash },
        { ...body(), extra: true },
        { hash, signature: 1 },
      ]) {
        await expect(service.submitSignature(principal, malformed)).rejects.toMatchObject({
          response: { code: "invalid_activation_signature" },
        });
      }
    });

    it("asks to prepare again for a hash that is not the prepared one, or one too old", async () => {
      const other = "b".repeat(64);
      await expect(
        service.submitSignature(principal, { hash: other, signature: sign(userKey, other) }),
      ).rejects.toMatchObject({ response: { code: "activation_signature_stale" } });

      repository.find.mockResolvedValue({ ...prepared, updatedAt: new Date(Date.now() - 600_000) });
      await expect(service.submitSignature(principal, body())).rejects.toMatchObject({
        response: { code: "activation_signature_stale" },
      });
      expect(stellar.submitProvisioningTransaction).not.toHaveBeenCalled();
    });

    it("answers the state without submitting again once submitted", async () => {
      repository.find.mockResolvedValue({
        ...prepared,
        status: "SUBMITTED",
        preparedEnvelopeXdr: null,
      });

      await expect(service.submitSignature(principal, body())).resolves.toEqual({
        status: "submitted",
        transactionHash: hash,
      });
      expect(stellar.submitProvisioningTransaction).not.toHaveBeenCalled();
    });

    it("answers the state when a concurrent request already submitted", async () => {
      repository.claimSubmission.mockResolvedValue(null);
      repository.find
        .mockResolvedValueOnce(prepared)
        .mockResolvedValueOnce({ ...prepared, status: "SUBMITTED", preparedEnvelopeXdr: null });

      await expect(service.submitSignature(principal, body())).resolves.toMatchObject({
        status: "submitted",
      });
      expect(stellar.submitProvisioningTransaction).not.toHaveBeenCalled();
    });

    it("keeps an uncertain submission pending", async () => {
      stellar.submitProvisioningTransaction.mockRejectedValue(
        new StellarProviderError("submit_provisioning", true),
      );

      await expect(service.submitSignature(principal, body())).resolves.toMatchObject({
        status: "submitted",
      });
      expect(repository.markFailed).not.toHaveBeenCalled();
    });

    it("asks to prepare again when the sponsor's sequence moved on", async () => {
      stellar.submitProvisioningTransaction.mockRejectedValue(
        new StellarProviderError("submit_provisioning", false, "tx_bad_seq"),
      );

      await expect(service.submitSignature(principal, body())).rejects.toMatchObject({
        response: { code: "activation_signature_stale" },
      });
      expect(repository.markFailed).toHaveBeenCalledWith(baseUser.id, activation.id, "tx_bad_seq");
    });

    it("fails a submission the network rejects", async () => {
      stellar.submitProvisioningTransaction.mockRejectedValue(
        new StellarProviderError("submit_provisioning", false, "tx_bad_auth"),
      );

      await expect(service.submitSignature(principal, body())).rejects.toMatchObject({
        response: { code: "account_activation_failed" },
      });
      expect(repository.markFailed).toHaveBeenCalledWith(baseUser.id, activation.id, "tx_bad_auth");
    });
  });
});
