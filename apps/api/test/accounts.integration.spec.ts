import "reflect-metadata";

import { createHmac, randomUUID } from "node:crypto";

import { type ApiConfig } from "@access/config";
import { PrismaClient, TenantContextService } from "@access/database";
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
import {
  STELLAR_GATEWAY,
  type PreparedStellarProvisioning,
  type StellarAccountState,
  type StellarGateway,
  type StellarTransactionStatus,
} from "../src/common/stellar/stellar.types";
import { stellarTestConfig } from "./test-stellar-config";
import { ticketsTestConfig } from "./test-tickets-config";

const ownerDatabaseUrl = "postgresql://test:test@localhost:5433/access_test";

const config: ApiConfig = {
  nodeEnv: "test",
  apiPort: 0,
  databaseUrl: "postgresql://access_runtime:test_runtime@localhost:5433/access_test",
  databaseDirectUrl: ownerDatabaseUrl,
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
  // Built at runtime: the same test-only value the other suites use for the webhook secret.
  blindPayWebhookSecret: `whsec_${Buffer.from("test").toString("base64")}`,
  blindPayApiTimeoutMs: 500,
  blindPayAllowedRedirectOrigins: ["http://localhost:3000"],
  blindPayPartnerFeeId: undefined,
  ticketMinPriceCents: 6_000,
  purchaseMaxTotalCents: 4_000_000,
  corsOrigins: [],
  ...stellarTestConfig,
  ...ticketsTestConfig,
};

const users = {
  a: {
    token: "activation-a",
    privyUserId: "did:privy:activation-a",
    address: `G${"E".repeat(55)}`,
  },
  b: {
    token: "activation-b",
    privyUserId: "did:privy:activation-b",
    address: `G${"F".repeat(55)}`,
  },
} as const;
type TestUser = (typeof users)[keyof typeof users];

class FakePrivyGateway implements PrivyGateway {
  private readonly wallets = new Map<string, PrivyStellarWallet>();
  signatures: Array<{ walletId: string; userJwt: string }> = [];

  reset(): void {
    this.wallets.clear();
    this.signatures = [];
  }

  async verifyAccessToken(token: string): Promise<VerifiedPrivyPrincipal> {
    const user = Object.values(users).find((candidate) => candidate.token === token);
    if (user === undefined) {
      throw new Error("invalid token");
    }
    return { privyUserId: user.privyUserId, sessionId: `${token}-session` };
  }

  async getIdentity(privyUserId: string): Promise<PrivyIdentity> {
    return { privyUserId, verifiedEmail: `${privyUserId.split(":").pop()}@example.com` };
  }

  async findStellarWallet(privyUserId: string): Promise<PrivyStellarWallet | null> {
    return this.wallets.get(privyUserId) ?? null;
  }

  async createStellarWallet(privyUserId: string): Promise<PrivyStellarWallet> {
    const user = Object.values(users).find((candidate) => candidate.privyUserId === privyUserId)!;
    const wallet = {
      id: `${privyUserId}-wallet`,
      address: user.address,
      chainType: "stellar" as const,
      ownerPrivyUserId: privyUserId,
    };
    this.wallets.set(privyUserId, wallet);
    return wallet;
  }

  async rawSignStellarHash(walletId: string, _hash: string, userJwt: string): Promise<string> {
    this.signatures.push({ walletId, userJwt });
    return `0x${"00".repeat(64)}`;
  }
}

class FakeStellarGateway implements StellarGateway {
  readonly accounts = new Set<string>();
  builds: Array<{ address: string; state: StellarAccountState }> = [];

  reset(): void {
    this.accounts.clear();
    this.builds = [];
  }

  async getAccountState(address: string): Promise<StellarAccountState> {
    return { accountExists: this.accounts.has(address), missingTrustlines: [] };
  }

  async buildProvisioningTransaction(
    address: string,
    state: StellarAccountState,
  ): Promise<PreparedStellarProvisioning> {
    this.builds.push({ address, state });
    return {
      transactionXdr: `xdr-${address}`,
      transactionHash: createHmac("sha256", "activation").update(address).digest("hex"),
    };
  }

  async submitProvisioningTransaction(
    prepared: PreparedStellarProvisioning,
    address: string,
  ): Promise<{ transactionHash: string }> {
    this.accounts.add(address);
    return { transactionHash: prepared.transactionHash };
  }

  async getTransactionStatus(): Promise<StellarTransactionStatus> {
    return "not_found";
  }
}

describe("account activation integration", () => {
  let app: INestApplication;
  let ownerPrisma: PrismaClient;
  let tenantContext: TenantContextService;
  const privy = new FakePrivyGateway();
  const stellar = new FakeStellarGateway();

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule.forRoot(config)] })
      .overrideProvider(PRIVY_GATEWAY)
      .useValue(privy)
      .overrideProvider(STELLAR_GATEWAY)
      .useValue(stellar)
      .compile();
    app = module.createNestApplication();
    configureApplication(app);
    await app.init();
    ownerPrisma = new PrismaClient({ datasources: { db: { url: ownerDatabaseUrl } } });
    tenantContext = app.get(TenantContextService);
  });

  async function cleanDatabase(): Promise<void> {
    await ownerPrisma.emailNotification.deleteMany();
    await ownerPrisma.walletActivation.deleteMany();
    await ownerPrisma.outboxEvent.deleteMany();
    await ownerPrisma.ticket.deleteMany();
    await ownerPrisma.purchase.deleteMany();
    await ownerPrisma.ticketType.deleteMany();
    await ownerPrisma.event.deleteMany();
    await ownerPrisma.producerProfile.deleteMany();
    await ownerPrisma.walletAccount.deleteMany();
    await ownerPrisma.user.deleteMany();
  }

  beforeEach(async () => {
    await cleanDatabase();
    privy.reset();
    stellar.reset();
  });

  afterAll(async () => {
    await cleanDatabase();
    await app.close();
    await ownerPrisma.$disconnect();
  });

  function bootstrap(user: TestUser, body?: object) {
    const call = request(app.getHttpServer())
      .post("/api/auth/bootstrap")
      .set("Authorization", `Bearer ${user.token}`);
    return body === undefined ? call : call.send(body);
  }

  function activate(user: TestUser) {
    return request(app.getHttpServer())
      .post("/api/me/stellar/activate")
      .set("Authorization", `Bearer ${user.token}`);
  }

  async function userId(user: TestUser): Promise<string> {
    return (await ownerPrisma.user.findUniqueOrThrow({ where: { privyUserId: user.privyUserId } }))
      .id;
  }

  it("activates the account of a spontaneous login once, signed with the user's JWT", async () => {
    await bootstrap(users.a, { origin: "login" }).expect(200);
    await expect(
      ownerPrisma.user.findUniqueOrThrow({ where: { privyUserId: users.a.privyUserId } }),
    ).resolves.toMatchObject({ spontaneousLoginAt: expect.any(Date) });

    const first = await activate(users.a).expect(200);
    expect(first.body).toEqual({ status: "active", transactionHash: expect.any(String) });
    expect(stellar.builds).toEqual([
      { address: users.a.address, state: { accountExists: false, missingTrustlines: [] } },
    ]);
    expect(privy.signatures).toEqual([
      { walletId: `${users.a.privyUserId}-wallet`, userJwt: users.a.token },
    ]);

    await activate(users.a).expect(200);
    expect(stellar.builds).toHaveLength(1);
    await expect(ownerPrisma.walletActivation.findMany()).resolves.toEqual([
      expect.objectContaining({ status: "ACTIVE", userId: await userId(users.a) }),
    ]);
  });

  it("keeps a checkout-only account inactive until it has a paid purchase", async () => {
    await bootstrap(users.a, { origin: "checkout" }).expect(200);
    await bootstrap(users.b).expect(200);

    await activate(users.a)
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe("account_activation_not_allowed"));
    await activate(users.b).expect(409);
    expect(stellar.builds).toEqual([]);

    const producerUser = await ownerPrisma.user.create({
      data: { privyUserId: "did:privy:seller", email: "seller@example.com" },
    });
    const producer = await ownerPrisma.producerProfile.create({
      data: { userId: producerUser.id, displayName: "Produtora" },
    });
    const event = await ownerPrisma.event.create({
      data: {
        producerId: producer.id,
        slug: `show-${randomUUID().slice(0, 8)}`,
        name: "Show",
        startsAt: new Date(Date.now() + 86_400_000),
        capacity: 10,
        status: "PUBLISHED",
      },
    });
    const ticketType = await ownerPrisma.ticketType.create({
      data: {
        eventId: event.id,
        producerId: producer.id,
        name: "Pista",
        priceCents: 5_000,
        quantity: 5,
      },
    });
    await ownerPrisma.purchase.create({
      data: {
        buyerUserId: await userId(users.a),
        producerId: producer.id,
        eventId: event.id,
        ticketTypeId: ticketType.id,
        quantity: 1,
        unitPriceCents: 5_000,
        subtotalCents: 5_000,
        idempotencyKey: randomUUID(),
        status: "TICKET_ISSUED",
      },
    });

    await activate(users.a).expect(200);
    await activate(users.b).expect(409);
  });

  it("rejects an unknown origin and isolates activation records by user", async () => {
    await bootstrap(users.a, { origin: "admin" })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe("invalid_bootstrap"));

    await bootstrap(users.a, { origin: "login" }).expect(200);
    await bootstrap(users.b, { origin: "login" }).expect(200);
    await activate(users.a).expect(200);

    const [seenByA, seenByB] = await Promise.all([
      tenantContext.withUserContext(await userId(users.a), (tx) => tx.walletActivation.count()),
      tenantContext.withUserContext(await userId(users.b), (tx) => tx.walletActivation.count()),
    ]);
    expect([seenByA, seenByB]).toEqual([1, 0]);
  });
});
