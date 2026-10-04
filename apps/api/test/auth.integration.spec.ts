import "reflect-metadata";

import { type ApiConfig } from "@access/config";
import { PrismaClient } from "@access/database";
import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";

import { AppModule } from "../src/app.module";
import { configureApplication } from "../src/app.setup";
import {
  PRIVY_GATEWAY,
  type PrivyGateway,
  type PrivyIdentity,
  type PrivyStellarWallet,
  type VerifiedPrivyPrincipal,
} from "../src/common/privy/privy.types";
import { stellarTestConfig } from "./test-stellar-config";
import { ticketsTestConfig } from "./test-tickets-config";

const baseConfig: ApiConfig = {
  nodeEnv: "test",
  apiPort: 0,
  databaseUrl: "postgresql://access_runtime:test_runtime@localhost:5433/access_test",
  databaseDirectUrl: "postgresql://test:test@localhost:5433/access_test",
  redisUrl: "redis://localhost:6380",
  healthCheckTimeoutMs: 250,
  privyAppId: "test-app-id",
  privyAppSecret: "test-app-secret",
  privyJwtVerificationKey: "test-verification-key",
  privyApiTimeoutMs: 500,
  databaseBlindPayWebhookUrl:
    "postgresql://access_blindpay_webhook_login:test_webhook@localhost:5433/access_test",
  blindPayApiKey: "blindpay-test-key",
  blindPayInstanceId: "in_test",
  blindPayBaseUrl: "https://api.blindpay.com/v1",
  blindPayWebhookSecret: "whsec_dGVzdA==",
  blindPayApiTimeoutMs: 500,
  blindPayAllowedRedirectOrigins: ["http://localhost:3000"],
  blindPayPartnerFeeId: undefined,
  ...stellarTestConfig,
  ...ticketsTestConfig,
};

const testUserId = "did:privy:test-user";
const testEmail = "buyer@example.com";
const testAddress = `G${"A".repeat(55)}`;

class FakePrivyGateway implements PrivyGateway {
  readonly tokenPrincipals = new Map<string, VerifiedPrivyPrincipal>();
  readonly identities = new Map<string, PrivyIdentity>();
  readonly wallets = new Map<string, PrivyStellarWallet>();
  readonly creations = new Map<string, Promise<PrivyStellarWallet>>();
  createCalls = 0;

  reset(): void {
    this.tokenPrincipals.clear();
    this.identities.clear();
    this.wallets.clear();
    this.creations.clear();
    this.createCalls = 0;
    this.tokenPrincipals.set("valid-token", {
      privyUserId: testUserId,
      sessionId: "test-session",
    });
    this.identities.set(testUserId, {
      privyUserId: testUserId,
      verifiedEmail: testEmail,
    });
  }

  async verifyAccessToken(token: string): Promise<VerifiedPrivyPrincipal> {
    const principal = this.tokenPrincipals.get(token);
    if (principal === undefined) {
      throw new Error("invalid token");
    }
    return principal;
  }

  async getIdentity(privyUserId: string): Promise<PrivyIdentity> {
    const identity = this.identities.get(privyUserId);
    if (identity === undefined) {
      throw new Error("unknown identity");
    }
    return identity;
  }

  async findStellarWallet(privyUserId: string): Promise<PrivyStellarWallet | null> {
    return this.wallets.get(privyUserId) ?? null;
  }

  createStellarWallet(privyUserId: string, idempotencyKey: string): Promise<PrivyStellarWallet> {
    const existingCreation = this.creations.get(idempotencyKey);
    if (existingCreation !== undefined) {
      return existingCreation;
    }

    this.createCalls += 1;
    const creation = new Promise<PrivyStellarWallet>((resolve) => {
      setTimeout(() => {
        const wallet = {
          id: "privy-wallet-test",
          address: testAddress,
          chainType: "stellar" as const,
          ownerPrivyUserId: privyUserId,
        };
        this.wallets.set(privyUserId, wallet);
        resolve(wallet);
      }, 10);
    });
    this.creations.set(idempotencyKey, creation);
    return creation;
  }

  async rawSignStellarHash(): Promise<string> {
    return `0x${"00".repeat(64)}`;
  }
}

describe("identity bootstrap integration", () => {
  let app: INestApplication;
  let ownerPrisma: PrismaClient;
  const privy = new FakePrivyGateway();

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule.forRoot(baseConfig)],
    })
      .overrideProvider(PRIVY_GATEWAY)
      .useValue(privy)
      .compile();
    app = module.createNestApplication();
    configureApplication(app);
    await app.init();
    ownerPrisma = new PrismaClient({
      datasources: { db: { url: baseConfig.databaseDirectUrl } },
    });
  });

  beforeEach(async () => {
    await ownerPrisma.blindPayWebhookDelivery.deleteMany();
    await ownerPrisma.outboxEvent.deleteMany();
    await ownerPrisma.blindPayCustomer.deleteMany();
    await ownerPrisma.producerProfile.deleteMany();
    await ownerPrisma.walletActivation.deleteMany();
    await ownerPrisma.walletAccount.deleteMany();
    await ownerPrisma.user.deleteMany();
    privy.reset();
  });

  afterAll(async () => {
    await ownerPrisma.blindPayWebhookDelivery.deleteMany();
    await ownerPrisma.outboxEvent.deleteMany();
    await ownerPrisma.blindPayCustomer.deleteMany();
    await ownerPrisma.producerProfile.deleteMany();
    await ownerPrisma.walletActivation.deleteMany();
    await ownerPrisma.walletAccount.deleteMany();
    await ownerPrisma.user.deleteMany();
    await app.close();
    await ownerPrisma.$disconnect();
  });

  it("rejects a private route without a token", async () => {
    const response = await request(app.getHttpServer()).get("/api/me").expect(401);

    expect(response.body).toEqual({
      code: "invalid_auth_token",
      message: "A valid access token is required.",
    });
  });

  it("keeps health public", async () => {
    await request(app.getHttpServer()).get("/api/health/live").expect(200);
  });

  it("returns 404 before bootstrap and the materialized account afterwards", async () => {
    const before = await request(app.getHttpServer())
      .get("/api/me")
      .set("Authorization", "Bearer valid-token")
      .expect(404);
    expect(before.body).toMatchObject({ code: "account_not_bootstrapped" });

    const bootstrapped = await request(app.getHttpServer())
      .post("/api/auth/bootstrap")
      .set("Authorization", "Bearer valid-token")
      .expect(200);
    const current = await request(app.getHttpServer())
      .get("/api/me")
      .set("Authorization", "Bearer valid-token")
      .expect(200);

    expect(current.body).toEqual(bootstrapped.body);
    expect(current.body).toMatchObject({
      user: { email: testEmail },
      wallet: { address: testAddress, chainType: "stellar" },
    });
  });

  it("is idempotent across repeated bootstrap requests", async () => {
    const first = await request(app.getHttpServer())
      .post("/api/auth/bootstrap")
      .set("Authorization", "Bearer valid-token")
      .expect(200);
    const repeated = await request(app.getHttpServer())
      .post("/api/auth/bootstrap")
      .set("Authorization", "Bearer valid-token")
      .expect(200);

    expect(repeated.body).toEqual(first.body);
    await expect(ownerPrisma.user.count()).resolves.toBe(1);
    await expect(ownerPrisma.walletAccount.count()).resolves.toBe(1);
    expect(privy.createCalls).toBe(1);
  });

  it("leaves one user and wallet after concurrent bootstrap requests", async () => {
    const requests = Array.from({ length: 2 }, () =>
      request(app.getHttpServer())
        .post("/api/auth/bootstrap")
        .set("Authorization", "Bearer valid-token"),
    );
    const responses = await Promise.all(requests);

    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(responses[0]?.body).toEqual(responses[1]?.body);
    await expect(ownerPrisma.user.count()).resolves.toBe(1);
    await expect(ownerPrisma.walletAccount.count()).resolves.toBe(1);
    expect(privy.createCalls).toBe(1);
  });

  it("enforces every identity and wallet uniqueness constraint", async () => {
    const firstUser = await ownerPrisma.user.create({
      data: { privyUserId: "did:privy:unique-1", email: "unique-1@example.com" },
    });
    const secondUser = await ownerPrisma.user.create({
      data: { privyUserId: "did:privy:unique-2", email: "unique-2@example.com" },
    });

    await expect(
      ownerPrisma.user.create({
        data: { privyUserId: firstUser.privyUserId, email: "other@example.com" },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
    await expect(
      ownerPrisma.user.create({
        data: { privyUserId: "did:privy:unique-3", email: firstUser.email },
      }),
    ).rejects.toMatchObject({ code: "P2002" });

    await ownerPrisma.walletAccount.create({
      data: {
        userId: firstUser.id,
        privyWalletId: "unique-wallet-1",
        stellarAddress: `G${"B".repeat(55)}`,
      },
    });
    await expect(
      ownerPrisma.walletAccount.create({
        data: {
          userId: firstUser.id,
          privyWalletId: "unique-wallet-2",
          stellarAddress: `G${"C".repeat(55)}`,
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
    await expect(
      ownerPrisma.walletAccount.create({
        data: {
          userId: secondUser.id,
          privyWalletId: "unique-wallet-1",
          stellarAddress: `G${"D".repeat(55)}`,
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
    await expect(
      ownerPrisma.walletAccount.create({
        data: {
          userId: secondUser.id,
          privyWalletId: "unique-wallet-3",
          stellarAddress: `G${"B".repeat(55)}`,
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });
});
