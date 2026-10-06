import { ConflictException } from "@nestjs/common";
import { Keypair } from "@stellar/stellar-sdk";

import { type BlindPayGateway } from "../common/blindpay/blindpay.types";
import { type PrivyGateway } from "../common/privy/privy.types";
import { type StellarGateway, StellarProviderError } from "../common/stellar/stellar.types";
import { type UserWithWallet, UsersRepository } from "../users/users.repository";
import { ProducerStellarActivationService } from "./producer-stellar-activation.service";
import {
  ProducerStellarRepository,
  type StellarProvisioningRecord,
} from "./producer-stellar.repository";
import { ProducersRepository, type ProducerProfileRecord } from "./producers.repository";

// The producer's wallet, generated at runtime: it signs hashes the way signRawHash does (D-28).
const producerKey = Keypair.random();
const otherKey = Keypair.random();
const sign = (key: Keypair, hash: string): string =>
  `0x${key.sign(Buffer.from(hash, "hex")).toString("hex")}`;

const hash = "b".repeat(64);
const now = new Date();
const principal = {
  privyUserId: "did:privy:producer",
  sessionId: "session",
  accessToken: "current-user-jwt",
};
const wallet = {
  id: "00000000-0000-4000-8000-000000000002",
  userId: "00000000-0000-4000-8000-000000000001",
  privyWalletId: "wallet-id",
  stellarAddress: producerKey.publicKey(),
  createdAt: now,
  updatedAt: now,
};
const user: UserWithWallet = {
  id: wallet.userId,
  privyUserId: principal.privyUserId,
  email: "producer@example.com",
  spontaneousLoginAt: null,
  createdAt: now,
  updatedAt: now,
  wallet,
};
const customer = {
  id: "00000000-0000-4000-8000-000000000004",
  producerId: "00000000-0000-4000-8000-000000000003",
  externalCustomerId: "re_test",
  providerIdempotencyKey: "a".repeat(64),
  customerType: "INDIVIDUAL" as const,
  creationStatus: "CREATED" as const,
  kycStatus: "APPROVED" as const,
  isCurrent: true,
  externalBlockchainWalletId: null,
  failureCode: null,
  createdAt: now,
  updatedAt: now,
};
const provisioning: StellarProvisioningRecord = {
  id: "00000000-0000-4000-8000-000000000005",
  producerId: customer.producerId,
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
const prepared: StellarProvisioningRecord = {
  ...provisioning,
  status: "SIGNING",
  transactionHash: hash,
  preparedEnvelopeXdr: "unsigned-xdr",
  updatedAt: new Date(),
};
const usdb = { code: "USDB", issuer: "GCQSSIMOW5OCGULZATDXKU5MOJBOMFX6G65X6CXZDQ7AIB3SKFUZ67NX" };
const usdc = { code: "USDC", issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5" };
const unfunded = { accountExists: false, missingTrustlines: [usdb, usdc] };
const provisioned = { accountExists: true, missingTrustlines: [] };
const producer: ProducerProfileRecord = {
  id: customer.producerId,
  userId: user.id,
  displayName: "Festival Access",
  createdAt: now,
  updatedAt: now,
  blindPayCustomers: [customer],
  stellarProvisioning: null,
};

describe("ProducerStellarActivationService", () => {
  let users: jest.Mocked<Pick<UsersRepository, "findByPrivyUserId">>;
  let producers: jest.Mocked<Pick<ProducersRepository, "findByUserId">>;
  let repository: jest.Mocked<
    Pick<
      ProducerStellarRepository,
      | "ensure"
      | "find"
      | "claimSigning"
      | "savePrepared"
      | "claimSubmission"
      | "markActive"
      | "markFailed"
      | "markWalletRegistered"
    >
  >;
  let privy: jest.Mocked<Pick<PrivyGateway, "findStellarWallet">>;
  let stellar: jest.Mocked<StellarGateway>;
  let blindPay: jest.Mocked<Pick<BlindPayGateway, "registerExternalStellarWallet">>;
  let service: ProducerStellarActivationService;

  beforeEach(() => {
    users = { findByPrivyUserId: jest.fn().mockResolvedValue(user) };
    producers = { findByUserId: jest.fn().mockResolvedValue(producer) };
    repository = {
      ensure: jest.fn().mockResolvedValue(provisioning),
      find: jest.fn().mockResolvedValue(prepared),
      claimSigning: jest
        .fn()
        .mockResolvedValue({ ...provisioning, status: "SIGNING", updatedAt: new Date() }),
      savePrepared: jest
        .fn()
        .mockImplementation((_userId, _id, transactionHash: string, preparedEnvelopeXdr: string) =>
          Promise.resolve({ ...prepared, transactionHash, preparedEnvelopeXdr }),
        ),
      claimSubmission: jest
        .fn()
        .mockResolvedValue({ ...prepared, status: "SUBMITTED", preparedEnvelopeXdr: null }),
      markActive: jest
        .fn()
        .mockResolvedValue({ ...provisioning, status: "ACTIVE", activatedAt: new Date() }),
      markFailed: jest.fn().mockResolvedValue(undefined),
      markWalletRegistered: jest.fn().mockResolvedValue(undefined),
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
      buildProvisioningTransaction: jest.fn().mockResolvedValue({
        transactionXdr: "unsigned-xdr",
        transactionHash: hash,
      }),
      submitProvisioningTransaction: jest.fn().mockResolvedValue({ transactionHash: hash }),
      getTransactionStatus: jest.fn().mockResolvedValue("not_found"),
    };
    blindPay = {
      registerExternalStellarWallet: jest.fn().mockResolvedValue({
        id: "bw_test",
        address: wallet.stellarAddress,
        network: "stellar_testnet",
      }),
    };
    service = new ProducerStellarActivationService(
      users as unknown as UsersRepository,
      producers as unknown as ProducersRepository,
      repository as unknown as ProducerStellarRepository,
      privy as unknown as PrivyGateway,
      stellar,
      blindPay as unknown as BlindPayGateway,
      { stellarNetwork: "testnet" },
    );
  });

  const signature = () => ({ hash, signature: sign(producerKey, hash) });

  it("prepares the account and trustlines and hands out the hash to sign", async () => {
    await expect(service.activate(principal)).resolves.toEqual({
      status: "signing",
      hashToSign: hash,
    });

    expect(stellar.buildProvisioningTransaction).toHaveBeenCalledWith(
      wallet.stellarAddress,
      unfunded,
    );
    expect(repository.savePrepared).toHaveBeenCalledWith(
      user.id,
      provisioning.id,
      hash,
      "unsigned-xdr",
    );
    expect(stellar.submitProvisioningTransaction).not.toHaveBeenCalled();
  });

  it("submits the producer's signature and registers the confirmed wallet", async () => {
    stellar.getAccountState.mockResolvedValue(provisioned);
    const input = signature();

    await expect(service.submitSignature(principal, input)).resolves.toMatchObject({
      status: "active",
    });

    expect(stellar.submitProvisioningTransaction).toHaveBeenCalledWith(
      { transactionXdr: "unsigned-xdr", transactionHash: hash },
      wallet.stellarAddress,
      input.signature,
    );
    expect(blindPay.registerExternalStellarWallet).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: customer.externalCustomerId,
        address: wallet.stellarAddress,
      }),
      expect.stringMatching(/^[0-9a-f]{64}$/),
    );
    expect(repository.markWalletRegistered).toHaveBeenCalledWith(user.id, customer.id, "bw_test");
  });

  it("refuses a signature by another key without submitting", async () => {
    await expect(
      service.submitSignature(principal, { hash, signature: sign(otherKey, hash) }),
    ).rejects.toMatchObject({ response: { code: "invalid_activation_signature" } });
    expect(repository.claimSubmission).not.toHaveBeenCalled();
  });

  it("asks to prepare again for a stale transaction or a moved sequence", async () => {
    repository.find.mockResolvedValueOnce({
      ...prepared,
      updatedAt: new Date(Date.now() - 600_000),
    });
    await expect(service.submitSignature(principal, signature())).rejects.toMatchObject({
      response: { code: "activation_signature_stale" },
    });

    stellar.submitProvisioningTransaction.mockRejectedValue(
      new StellarProviderError("submit_provisioning", false, "tx_bad_seq"),
    );
    await expect(service.submitSignature(principal, signature())).rejects.toMatchObject({
      response: { code: "activation_signature_stale" },
    });
    expect(repository.markFailed).toHaveBeenCalledWith(user.id, provisioning.id, "tx_bad_seq");
  });

  it("reconciles an existing account and trustlines without preparing another transaction", async () => {
    stellar.getAccountState.mockResolvedValue(provisioned);

    await expect(service.activate(principal)).resolves.toMatchObject({ status: "active" });

    expect(repository.markActive).toHaveBeenCalled();
    expect(stellar.buildProvisioningTransaction).not.toHaveBeenCalled();
  });

  it("keeps a recent unknown submission pending instead of creating a duplicate", async () => {
    repository.ensure.mockResolvedValue({
      ...provisioning,
      status: "SUBMITTED",
      transactionHash: "c".repeat(64),
      updatedAt: new Date(),
    });

    await expect(service.activate(principal)).resolves.toEqual({
      status: "submitted",
      transactionHash: "c".repeat(64),
    });
    expect(repository.claimSigning).not.toHaveBeenCalled();
    expect(stellar.buildProvisioningTransaction).not.toHaveBeenCalled();
  });

  it("rejects a Privy wallet that does not match the authenticated user's stored wallet", async () => {
    privy.findStellarWallet.mockResolvedValue({
      id: "another-wallet",
      address: wallet.stellarAddress,
      chainType: "stellar",
      ownerPrivyUserId: principal.privyUserId,
    });

    await expect(service.activate(principal)).rejects.toBeInstanceOf(ConflictException);
    expect(repository.ensure).not.toHaveBeenCalled();
  });

  it.each([
    ["without a BlindPay customer", []],
    ["while KYC is still verifying", [{ ...customer, kycStatus: "VERIFYING" as const }]],
  ])("configures Stellar %s and defers the wallet registration", async (_label, customers) => {
    producers.findByUserId.mockResolvedValue({ ...producer, blindPayCustomers: customers });
    stellar.getAccountState.mockResolvedValue(provisioned);

    await expect(service.submitSignature(principal, signature())).resolves.toMatchObject({
      status: "active",
    });

    expect(stellar.submitProvisioningTransaction).toHaveBeenCalledTimes(1);
    expect(repository.markActive).toHaveBeenCalled();
    expect(blindPay.registerExternalStellarWallet).not.toHaveBeenCalled();
    expect(repository.markWalletRegistered).not.toHaveBeenCalled();
  });

  it("registers the wallet after KYC without another Stellar transaction", async () => {
    repository.ensure.mockResolvedValue({ ...provisioning, status: "ACTIVE", activatedAt: now });
    stellar.getAccountState.mockResolvedValue(provisioned);

    await expect(service.activate(principal)).resolves.toMatchObject({ status: "active" });

    expect(stellar.buildProvisioningTransaction).not.toHaveBeenCalled();
    expect(repository.markActive).not.toHaveBeenCalled();
    expect(repository.markWalletRegistered).toHaveBeenCalledWith(user.id, customer.id, "bw_test");
  });

  it("prepares only the missing trustline for an active record", async () => {
    const missingUsdc = { accountExists: true, missingTrustlines: [usdc] };
    repository.ensure.mockResolvedValue({ ...provisioning, status: "ACTIVE", activatedAt: now });
    stellar.getAccountState.mockResolvedValue(missingUsdc);

    await expect(service.activate(principal)).resolves.toMatchObject({ status: "signing" });

    expect(repository.claimSigning).toHaveBeenCalledTimes(1);
    expect(stellar.buildProvisioningTransaction).toHaveBeenCalledWith(
      wallet.stellarAddress,
      missingUsdc,
    );
  });
});
