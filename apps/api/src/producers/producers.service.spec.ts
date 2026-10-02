import { ConflictException, NotFoundException } from "@nestjs/common";

import { type UserWithWallet, UsersRepository } from "../users/users.repository";
import { ProducersRepository, type ProducerProfileRecord } from "./producers.repository";
import { ProducersService } from "./producers.service";

const principal = {
  privyUserId: "did:privy:producer",
  sessionId: "session",
  accessToken: "access-token",
};
const now = new Date("2026-09-30T00:00:00.000Z");
const user: UserWithWallet = {
  id: "00000000-0000-4000-8000-000000000001",
  privyUserId: principal.privyUserId,
  email: "producer@example.com",
  createdAt: now,
  updatedAt: now,
  wallet: {
    id: "00000000-0000-4000-8000-000000000002",
    userId: "00000000-0000-4000-8000-000000000001",
    privyWalletId: "wallet-id",
    stellarAddress: `G${"A".repeat(55)}`,
    createdAt: now,
    updatedAt: now,
  },
};
const producer: ProducerProfileRecord = {
  id: "00000000-0000-4000-8000-000000000003",
  userId: user.id,
  displayName: "Festival Access",
  createdAt: now,
  updatedAt: now,
  blindPayCustomers: [],
  stellarProvisioning: null,
};

const activeProvisioning: NonNullable<ProducerProfileRecord["stellarProvisioning"]> = {
  id: "00000000-0000-4000-8000-000000000005",
  producerId: producer.id,
  walletAccountId: user.wallet!.id,
  network: "testnet",
  status: "ACTIVE",
  transactionHash: "a".repeat(64),
  failureCode: null,
  activatedAt: now,
  createdAt: now,
  updatedAt: now,
};

function producerWithKyc(
  kycStatus: ProducerProfileRecord["blindPayCustomers"][number]["kycStatus"],
): ProducerProfileRecord {
  return {
    ...producer,
    blindPayCustomers: [
      {
        id: "00000000-0000-4000-8000-000000000004",
        producerId: producer.id,
        externalCustomerId: "re_test",
        providerIdempotencyKey: "a".repeat(64),
        customerType: "INDIVIDUAL",
        creationStatus: "CREATED",
        kycStatus,
        isCurrent: true,
        externalBlockchainWalletId: null,
        failureCode: null,
        createdAt: now,
        updatedAt: now,
      },
    ],
  };
}

describe("ProducersService", () => {
  let users: jest.Mocked<Pick<UsersRepository, "findByPrivyUserId">>;
  let producers: jest.Mocked<Pick<ProducersRepository, "findByUserId" | "create">>;
  let service: ProducersService;

  beforeEach(() => {
    users = { findByPrivyUserId: jest.fn().mockResolvedValue(user) };
    producers = {
      findByUserId: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(producer),
    };
    service = new ProducersService(
      users as unknown as UsersRepository,
      producers as unknown as ProducersRepository,
    );
  });

  it("creates a normalized producer profile for the authenticated user", async () => {
    await expect(
      service.create(principal, { displayName: "  Festival Access  " }),
    ).resolves.toEqual({
      id: producer.id,
      displayName: producer.displayName,
      onboardingStatus: "stellar_pending",
      compliance: { status: null, hasOpenRfi: false },
      stellar: { status: "not_started" },
    });

    expect(producers.create).toHaveBeenCalledWith(user.id, "Festival Access");
  });

  it("returns an existing profile only when the idempotent input matches", async () => {
    producers.findByUserId.mockResolvedValue(producer);

    await expect(
      service.create(principal, { displayName: producer.displayName }),
    ).resolves.toMatchObject({ id: producer.id });
    expect(producers.create).not.toHaveBeenCalled();

    await expect(
      service.create(principal, { displayName: "Another producer" }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it.each([
    ["VERIFYING", "compliance_pending", false],
    ["REJECTED", "compliance_pending", false],
    ["COMPLIANCE_REQUEST", "compliance_pending", true],
    ["APPROVED", "wallet_registration_pending", false],
    ["APPROVED_RFI", "wallet_registration_pending", true],
  ] as const)(
    "derives onboarding for KYC status %s once Stellar is active",
    async (kycStatus, onboardingStatus, hasOpenRfi) => {
      producers.findByUserId.mockResolvedValue({
        ...producerWithKyc(kycStatus),
        stellarProvisioning: activeProvisioning,
      });

      await expect(service.me(principal)).resolves.toMatchObject({
        onboardingStatus,
        compliance: { status: kycStatus.toLowerCase(), hasOpenRfi },
        stellar: { status: "active" },
      });
    },
  );

  it("reports the Stellar setup before compliance, since both tracks are independent", async () => {
    producers.findByUserId.mockResolvedValue(producerWithKyc("APPROVED"));
    await expect(service.me(principal)).resolves.toMatchObject({
      onboardingStatus: "stellar_pending",
      compliance: { status: "approved" },
      stellar: { status: "not_started" },
    });

    producers.findByUserId.mockResolvedValue({
      ...producer,
      stellarProvisioning: activeProvisioning,
    });
    await expect(service.me(principal)).resolves.toMatchObject({
      onboardingStatus: "compliance_pending",
      compliance: { status: null },
      stellar: { status: "active" },
    });
  });

  it("derives wallet registration pending and ready from persisted provider state", async () => {
    const approved = producerWithKyc("APPROVED");
    producers.findByUserId.mockResolvedValue({
      ...approved,
      stellarProvisioning: activeProvisioning,
    });

    await expect(service.me(principal)).resolves.toMatchObject({
      onboardingStatus: "wallet_registration_pending",
      stellar: { status: "active" },
    });

    producers.findByUserId.mockResolvedValue({
      ...approved,
      blindPayCustomers: approved.blindPayCustomers.map((customer) => ({
        ...customer,
        externalBlockchainWalletId: "bw_test",
      })),
      stellarProvisioning: activeProvisioning,
    });
    await expect(service.me(principal)).resolves.toMatchObject({
      onboardingStatus: "ready",
      stellar: { status: "active" },
    });
  });

  it.each([
    null,
    {},
    { displayName: "" },
    { displayName: " ".repeat(3) },
    { displayName: "a".repeat(121) },
    { displayName: "Festival", producerId: "another" },
  ])("rejects an invalid producer payload", async (input) => {
    await expect(service.create(principal, input)).rejects.toMatchObject({
      response: { code: "invalid_producer_profile" },
    });
    expect(users.findByPrivyUserId).not.toHaveBeenCalled();
  });

  it("requires the account bootstrap and reports a missing producer", async () => {
    users.findByPrivyUserId.mockResolvedValueOnce(null);
    await expect(service.create(principal, { displayName: "Festival" })).rejects.toBeInstanceOf(
      NotFoundException,
    );

    producers.findByUserId.mockResolvedValueOnce(null);
    await expect(service.me(principal)).rejects.toMatchObject({
      response: { code: "producer_not_found" },
    });
  });
});
