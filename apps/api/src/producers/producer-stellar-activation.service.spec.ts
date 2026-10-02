import { ConflictException } from "@nestjs/common";

import { type BlindPayGateway } from "../common/blindpay/blindpay.types";
import { type PrivyGateway } from "../common/privy/privy.types";
import { type StellarGateway } from "../common/stellar/stellar.types";
import { type UserWithWallet, UsersRepository } from "../users/users.repository";
import { ProducerStellarActivationService } from "./producer-stellar-activation.service";
import {
  ProducerStellarRepository,
  type StellarProvisioningRecord,
} from "./producer-stellar.repository";
import { ProducersRepository, type ProducerProfileRecord } from "./producers.repository";

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
  stellarAddress: `G${"A".repeat(55)}`,
  createdAt: now,
  updatedAt: now,
};
const user: UserWithWallet = {
  id: wallet.userId,
  privyUserId: principal.privyUserId,
  email: "producer@example.com",
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
  assetCode: "USDB",
  assetIssuer: "GCQSSIMOW5OCGULZATDXKU5MOJBOMFX6G65X6CXZDQ7AIB3SKFUZ67NX",
  status: "PENDING",
  transactionHash: null,
  failureCode: null,
  activatedAt: null,
  createdAt: now,
  updatedAt: now,
};
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
      | "markSubmitted"
      | "markActive"
      | "markFailed"
      | "markWalletRegistered"
    >
  >;
  let privy: jest.Mocked<Pick<PrivyGateway, "findStellarWallet" | "rawSignStellarHash">>;
  let stellar: jest.Mocked<StellarGateway>;
  let blindPay: jest.Mocked<Pick<BlindPayGateway, "registerExternalStellarWallet">>;
  let service: ProducerStellarActivationService;

  beforeEach(() => {
    users = { findByPrivyUserId: jest.fn().mockResolvedValue(user) };
    producers = { findByUserId: jest.fn().mockResolvedValue(producer) };
    repository = {
      ensure: jest.fn().mockResolvedValue(provisioning),
      find: jest.fn().mockResolvedValue(provisioning),
      claimSigning: jest
        .fn()
        .mockResolvedValue({ ...provisioning, status: "SIGNING", updatedAt: new Date() }),
      markSubmitted: jest.fn().mockImplementation((_userId, _id, transactionHash: string) =>
        Promise.resolve({ ...provisioning, status: "SUBMITTED", transactionHash }),
      ),
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
      rawSignStellarHash: jest.fn().mockResolvedValue(`0x${"01".repeat(64)}`),
    };
    stellar = {
      getAccountState: jest
        .fn()
        .mockResolvedValueOnce({ accountExists: false, trustlineExists: false })
        .mockResolvedValueOnce({ accountExists: true, trustlineExists: true }),
      buildProvisioningTransaction: jest.fn().mockResolvedValue({
        transactionXdr: "unsigned-xdr",
        transactionHash: "b".repeat(64),
      }),
      submitProvisioningTransaction: jest
        .fn()
        .mockResolvedValue({ transactionHash: "b".repeat(64) }),
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
      {
        stellarNetwork: "testnet",
        stellarAssetCode: "USDB",
        stellarAssetIssuer: provisioning.assetIssuer,
      },
    );
  });

  it("signs with the current user JWT, submits and registers the confirmed wallet", async () => {
    await expect(service.activate(principal)).resolves.toEqual({
      status: "active",
      transactionHash: null,
    });

    expect(stellar.buildProvisioningTransaction).toHaveBeenCalledWith(wallet.stellarAddress, false);
    expect(privy.rawSignStellarHash).toHaveBeenCalledWith(
      wallet.privyWalletId,
      "b".repeat(64),
      principal.accessToken,
      expect.stringMatching(/^[0-9a-f]{64}$/),
    );
    expect(stellar.submitProvisioningTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ transactionHash: "b".repeat(64) }),
      wallet.stellarAddress,
      `0x${"01".repeat(64)}`,
    );
    expect(blindPay.registerExternalStellarWallet).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: customer.externalCustomerId,
        address: wallet.stellarAddress,
      }),
      expect.stringMatching(/^[0-9a-f]{64}$/),
    );
    expect(repository.markWalletRegistered).toHaveBeenCalledWith(
      user.id,
      customer.id,
      "bw_test",
    );
  });

  it("reconciles an existing account and trustline without signing another transaction", async () => {
    stellar.getAccountState.mockReset().mockResolvedValue({
      accountExists: true,
      trustlineExists: true,
    });

    await expect(service.activate(principal)).resolves.toMatchObject({ status: "active" });

    expect(repository.markActive).toHaveBeenCalled();
    expect(stellar.buildProvisioningTransaction).not.toHaveBeenCalled();
    expect(privy.rawSignStellarHash).not.toHaveBeenCalled();
  });

  it("keeps a recent unknown submission pending instead of creating a duplicate", async () => {
    const submitted = {
      ...provisioning,
      status: "SUBMITTED" as const,
      transactionHash: "c".repeat(64),
      updatedAt: new Date(),
    };
    repository.ensure.mockResolvedValue(submitted);
    stellar.getAccountState.mockReset().mockResolvedValue({
      accountExists: false,
      trustlineExists: false,
    });
    stellar.getTransactionStatus.mockResolvedValue("not_found");

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

  it("requires an operational BlindPay customer", async () => {
    producers.findByUserId.mockResolvedValue({
      ...producer,
      blindPayCustomers: [{ ...customer, kycStatus: "VERIFYING" }],
    });

    await expect(service.activate(principal)).rejects.toMatchObject({
      response: { code: "blindpay_customer_not_operational" },
    });
    expect(stellar.getAccountState).not.toHaveBeenCalled();
  });
});
