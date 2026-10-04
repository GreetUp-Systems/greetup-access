import "reflect-metadata";

import { type ApiConfig } from "@access/config";
import { PrismaClient, PrismaService, TenantContextService } from "@access/database";
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

const ownerDatabaseUrl = "postgresql://test:test@localhost:5433/access_test";
const runtimeDatabaseUrl = "postgresql://access_runtime:test_runtime@localhost:5433/access_test";

const config: ApiConfig = {
  nodeEnv: "test",
  apiPort: 0,
  databaseUrl: runtimeDatabaseUrl,
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
  blindPayWebhookSecret: "whsec_dGVzdA==",
  blindPayApiTimeoutMs: 500,
  blindPayAllowedRedirectOrigins: ["http://localhost:3000"],
  blindPayPartnerFeeId: undefined,
  corsOrigins: [],
  ...stellarTestConfig,
  ...ticketsTestConfig,
};

const users = {
  a: {
    token: "events-producer-a-token",
    privyUserId: "did:privy:events-producer-a",
    email: "events-a@example.com",
    walletId: "events-producer-a-wallet",
    address: `G${"C".repeat(55)}`,
    displayName: "Produtora A",
  },
  b: {
    token: "events-producer-b-token",
    privyUserId: "did:privy:events-producer-b",
    email: "events-b@example.com",
    walletId: "events-producer-b-wallet",
    address: `G${"D".repeat(55)}`,
    displayName: "Produtora B",
  },
} as const;

type TestUser = (typeof users)[keyof typeof users];

class FakePrivyGateway implements Pick<
  PrivyGateway,
  "verifyAccessToken" | "getIdentity" | "findStellarWallet" | "createStellarWallet"
> {
  private readonly wallets = new Map<string, PrivyStellarWallet>();

  reset(): void {
    this.wallets.clear();
  }

  async verifyAccessToken(token: string): Promise<VerifiedPrivyPrincipal> {
    const user = Object.values(users).find((candidate) => candidate.token === token);
    if (user === undefined) {
      throw new Error("invalid token");
    }
    return { privyUserId: user.privyUserId, sessionId: `${user.walletId}-session` };
  }

  async getIdentity(privyUserId: string): Promise<PrivyIdentity> {
    return { privyUserId, verifiedEmail: this.userFor(privyUserId).email };
  }

  async findStellarWallet(privyUserId: string): Promise<PrivyStellarWallet | null> {
    return this.wallets.get(privyUserId) ?? null;
  }

  async createStellarWallet(privyUserId: string): Promise<PrivyStellarWallet> {
    const user = this.userFor(privyUserId);
    const wallet = {
      id: user.walletId,
      address: user.address,
      chainType: "stellar" as const,
      ownerPrivyUserId: privyUserId,
    };
    this.wallets.set(privyUserId, wallet);
    return wallet;
  }

  private userFor(privyUserId: string): TestUser {
    const user = Object.values(users).find((candidate) => candidate.privyUserId === privyUserId);
    if (user === undefined) {
      throw new Error("unknown identity");
    }
    return user;
  }
}

const inThirtyDays = () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000).toISOString();

describe("events integration", () => {
  let app: INestApplication;
  let ownerPrisma: PrismaClient;
  let runtimePrisma: PrismaService;
  let tenantContext: TenantContextService;
  const privy = new FakePrivyGateway();

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule.forRoot(config)] })
      .overrideProvider(PRIVY_GATEWAY)
      .useValue(privy)
      .compile();

    app = module.createNestApplication();
    configureApplication(app);
    await app.init();

    ownerPrisma = new PrismaClient({ datasources: { db: { url: ownerDatabaseUrl } } });
    runtimePrisma = app.get(PrismaService);
    tenantContext = app.get(TenantContextService);
  });

  async function cleanDatabase(): Promise<void> {
    await ownerPrisma.emailNotification.deleteMany();
    await ownerPrisma.outboxEvent.deleteMany();
    await ownerPrisma.ticket.deleteMany();
    await ownerPrisma.purchase.deleteMany();
    await ownerPrisma.ticketType.deleteMany();
    await ownerPrisma.event.deleteMany();
    await ownerPrisma.stellarAccountProvisioning.deleteMany();
    await ownerPrisma.blindPayCustomer.deleteMany();
    await ownerPrisma.producerProfile.deleteMany();
    await ownerPrisma.walletActivation.deleteMany();
    await ownerPrisma.walletAccount.deleteMany();
    await ownerPrisma.user.deleteMany();
  }

  beforeEach(async () => {
    await cleanDatabase();
    privy.reset();
  });

  afterAll(async () => {
    await cleanDatabase();
    await app.close();
    await ownerPrisma.$disconnect();
  });

  function api(user: TestUser) {
    const server = app.getHttpServer();
    const auth = `Bearer ${user.token}`;
    return {
      get: (path: string) => request(server).get(path).set("Authorization", auth),
      post: (path: string, body?: object) =>
        request(server).post(path).set("Authorization", auth).send(body),
      patch: (path: string, body: object) =>
        request(server).patch(path).set("Authorization", auth).send(body),
      delete: (path: string) => request(server).delete(path).set("Authorization", auth),
    };
  }

  async function createProducer(user: TestUser): Promise<string> {
    await api(user).post("/api/auth/bootstrap").expect(200);
    const producer = await api(user)
      .post("/api/producers", { displayName: user.displayName })
      .expect(200);
    return producer.body.id as string;
  }

  // Seeds the provider state that SPEC-003 derives as `ready`.
  async function makeReady(user: TestUser, producerId: string): Promise<void> {
    const account = await ownerPrisma.user.findUniqueOrThrow({
      where: { privyUserId: user.privyUserId },
      include: { wallet: true },
    });
    await ownerPrisma.stellarAccountProvisioning.create({
      data: {
        producerId,
        walletAccountId: account.wallet!.id,
        network: "testnet",
        status: "ACTIVE",
        activatedAt: new Date(),
      },
    });
    await ownerPrisma.blindPayCustomer.create({
      data: {
        producerId,
        externalCustomerId: `re_${user.walletId}`,
        providerIdempotencyKey: `${user.walletId}`.padEnd(64, "0").slice(0, 64),
        customerType: "INDIVIDUAL",
        creationStatus: "CREATED",
        kycStatus: "APPROVED",
        externalBlockchainWalletId: `bw_${user.walletId}`,
      },
    });
  }

  async function createEvent(
    user: TestUser,
    overrides: Record<string, unknown> = {},
  ): Promise<{ id: string; slug: string }> {
    const created = await api(user)
      .post("/api/events", {
        name: "Festival Access",
        startsAt: inThirtyDays(),
        capacity: 300,
        refundPolicy: "Reembolso integral até 7 dias antes do evento.",
        ...overrides,
      })
      .expect(201);
    return created.body as { id: string; slug: string };
  }

  async function addTicketType(user: TestUser, eventId: string, quantity = 200): Promise<string> {
    const created = await api(user)
      .post(`/api/events/${eventId}/ticket-types`, { name: "Pista", priceCents: 8_000, quantity })
      .expect(201);
    return created.body.id as string;
  }

  async function publishedEvent(user: TestUser): Promise<{ id: string; slug: string }> {
    const producerId = await createProducer(user);
    await makeReady(user, producerId);
    const event = await createEvent(user);
    await addTicketType(user, event.id);
    await api(user).post(`/api/events/${event.id}/publish`).expect(200);
    return event;
  }

  it("creates a draft before KYC and publishes only once the producer is ready", async () => {
    const producerId = await createProducer(users.a);
    const event = await createEvent(users.a);
    expect(event).toMatchObject({ slug: "festival-access", status: "draft", ticketTypes: [] });

    await addTicketType(users.a, event.id);
    const blocked = await api(users.a).post(`/api/events/${event.id}/publish`).expect(409);
    expect(blocked.body).toMatchObject({ code: "producer_not_ready" });

    await makeReady(users.a, producerId);
    const published = await api(users.a).post(`/api/events/${event.id}/publish`).expect(200);
    expect(published.body).toMatchObject({ status: "published", publishedAt: expect.any(String) });

    const repeated = await api(users.a).post(`/api/events/${event.id}/publish`).expect(200);
    expect(repeated.body.publishedAt).toBe(published.body.publishedAt);
    await expect(ownerPrisma.outboxEvent.count()).resolves.toBe(0);
  });

  it("serves published and cancelled events publicly and hides drafts", async () => {
    const event = await publishedEvent(users.a);
    const draft = await createEvent(users.a, { name: "Rascunho" });

    const response = await request(app.getHttpServer())
      .get(`/api/public/events/${event.slug}`)
      .expect(200);
    expect(response.body).toEqual({
      slug: "festival-access",
      name: "Festival Access",
      description: null,
      venueName: null,
      address: null,
      endsAt: null,
      startsAt: expect.any(String),
      status: "published",
      refundPolicy: "Reembolso integral até 7 dias antes do evento.",
      producer: { displayName: users.a.displayName },
      ticketTypes: [
        {
          id: expect.any(String),
          name: "Pista",
          description: null,
          priceCents: 8_000,
          available: 200,
        },
      ],
    });

    const hiddenDraft = await request(app.getHttpServer())
      .get(`/api/public/events/${draft.slug}`)
      .expect(404);
    const missing = await request(app.getHttpServer())
      .get("/api/public/events/does-not-exist")
      .expect(404);
    expect(hiddenDraft.body).toEqual(missing.body);

    await api(users.a).post(`/api/events/${event.id}/cancel`).expect(200);
    await request(app.getHttpServer())
      .get(`/api/public/events/${event.slug}`)
      .expect(200)
      .expect(({ body }) => expect(body.status).toBe("cancelled"));
  });

  it("isolates producers even when the other event is public", async () => {
    const eventOfB = await publishedEvent(users.b);
    const draftOfB = await createEvent(users.b, { name: "Rascunho B" });
    await createProducer(users.a);

    for (const id of [eventOfB.id, draftOfB.id]) {
      await api(users.a).get(`/api/events/${id}`).expect(404);
      await api(users.a).patch(`/api/events/${id}`, { name: "Invasão" }).expect(404);
      await api(users.a).post(`/api/events/${id}/publish`).expect(404);
      await api(users.a).post(`/api/events/${id}/cancel`).expect(404);
      await api(users.a).delete(`/api/events/${id}`).expect(404);
      await api(users.a)
        .post(`/api/events/${id}/ticket-types`, { name: "X", priceCents: 1, quantity: 1 })
        .expect(404);
    }
    await expect(api(users.a).get("/api/events").expect(200)).resolves.toMatchObject({
      body: [],
    });

    const userA = await ownerPrisma.user.findUniqueOrThrow({
      where: { privyUserId: users.a.privyUserId },
    });
    const visibleToA = await tenantContext.withProducerContext(userA.id, async (transaction) => ({
      events: await transaction.event.count(),
      ticketTypes: await transaction.ticketType.count(),
      producers: await transaction.producerProfile.count(),
    }));
    expect(visibleToA).toEqual({ events: 0, ticketTypes: 0, producers: 1 });
  });

  it("exposes only public rows to a read without user context", async () => {
    const event = await publishedEvent(users.a);
    await createEvent(users.a, { name: "Rascunho" });
    await createProducer(users.b);

    const [events, ticketTypes, producers] = await Promise.all([
      runtimePrisma.event.findMany({ select: { id: true, status: true } }),
      runtimePrisma.ticketType.findMany({ select: { eventId: true } }),
      runtimePrisma.producerProfile.findMany({ select: { displayName: true } }),
    ]);

    expect(events).toEqual([{ id: event.id, status: "PUBLISHED" }]);
    expect(ticketTypes).toEqual([{ eventId: event.id }]);
    expect(producers).toEqual([{ displayName: users.a.displayName }]);

    await expect(
      runtimePrisma.event.updateMany({ data: { name: "Sem contexto" } }),
    ).resolves.toEqual({ count: 0 });
  });

  it("records a single event.cancelled under concurrent cancellations", async () => {
    const event = await publishedEvent(users.a);

    const results = await Promise.all(
      Array.from({ length: 3 }, () => api(users.a).post(`/api/events/${event.id}/cancel`)),
    );

    expect(results.map((result) => result.status)).toEqual([200, 200, 200]);
    const outbox = await ownerPrisma.outboxEvent.findMany();
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({
      eventType: "event.cancelled",
      aggregateType: "event",
      aggregateId: event.id,
      deduplicationKey: `event:${event.id}:cancelled:v1`,
    });
    const producer = await ownerPrisma.producerProfile.findFirstOrThrow();
    expect(outbox[0]!.payload).toEqual({ eventId: event.id, producerId: producer.id });

    await api(users.a).patch(`/api/events/${event.id}`, { name: "Depois" }).expect(409);
    await api(users.a).post(`/api/events/${event.id}/publish`).expect(409);
  });

  it("keeps ticket quantities within capacity when publication and edits race", async () => {
    const producerId = await createProducer(users.a);
    await makeReady(users.a, producerId);
    const event = await createEvent(users.a, { capacity: 300 });
    await addTicketType(users.a, event.id, 200);

    await Promise.all([
      api(users.a).post(`/api/events/${event.id}/publish`),
      api(users.a).post(`/api/events/${event.id}/ticket-types`, {
        name: "VIP",
        priceCents: 20_000,
        quantity: 150,
      }),
    ]);

    const stored = await ownerPrisma.event.findUniqueOrThrow({
      where: { id: event.id },
      include: { ticketTypes: true },
    });
    const total = stored.ticketTypes.reduce((sum, ticketType) => sum + ticketType.quantity, 0);
    if (stored.status === "PUBLISHED") {
      expect(total).toBeLessThanOrEqual(stored.capacity);
    } else {
      expect(total).toBe(350);
    }
  });

  it("generates unique slugs and freezes them after publication", async () => {
    const event = await publishedEvent(users.a);
    const second = await createEvent(users.a);
    expect(second.slug).toMatch(/^festival-access-[a-z0-9]{6}$/);

    const renamedDraft = await api(users.a)
      .patch(`/api/events/${second.id}`, { name: "Show de Verão" })
      .expect(200);
    expect(renamedDraft.body.slug).toBe("show-de-verao");

    const renamedPublished = await api(users.a)
      .patch(`/api/events/${event.id}`, { name: "Outro Nome" })
      .expect(200);
    expect(renamedPublished.body).toMatchObject({ name: "Outro Nome", slug: "festival-access" });
  });

  it("deletes drafts with their ticket types and refuses to delete published events", async () => {
    const producerId = await createProducer(users.a);
    const draft = await createEvent(users.a);
    await addTicketType(users.a, draft.id);

    await api(users.a).delete(`/api/events/${draft.id}`).expect(204);
    await expect(ownerPrisma.ticketType.count()).resolves.toBe(0);
    await expect(ownerPrisma.event.count()).resolves.toBe(0);

    await makeReady(users.a, producerId);
    const event = await createEvent(users.a);
    const ticketTypeId = await addTicketType(users.a, event.id);
    await api(users.a).post(`/api/events/${event.id}/publish`).expect(200);

    const refused = await api(users.a).delete(`/api/events/${event.id}`).expect(409);
    expect(refused.body).toMatchObject({ code: "event_not_draft" });
    const locked = await api(users.a)
      .delete(`/api/events/${event.id}/ticket-types/${ticketTypeId}`)
      .expect(409);
    expect(locked.body).toMatchObject({ code: "ticket_type_locked" });
  });

  it("validates bodies and reports a missing producer profile", async () => {
    await api(users.a).post("/api/auth/bootstrap").expect(200);
    const missingProducer = await api(users.a)
      .post("/api/events", { name: "Sem perfil", startsAt: inThirtyDays(), capacity: 10 })
      .expect(404);
    expect(missingProducer.body).toMatchObject({ code: "producer_not_found" });

    await api(users.a).post("/api/producers", { displayName: users.a.displayName }).expect(200);
    const invalid = await api(users.a)
      .post("/api/events", { name: "X", startsAt: inThirtyDays(), capacity: 0, extra: true })
      .expect(400);
    expect(invalid.body).toMatchObject({ code: "invalid_event" });
    await api(users.a).get("/api/events/not-a-uuid").expect(400);
    await request(app.getHttpServer()).get("/api/events").expect(401);
  });

  it("enforces positive capacity, quantity and price in the database", async () => {
    const producerId = await createProducer(users.a);
    const event = await createEvent(users.a);

    await expect(
      ownerPrisma.event.update({ where: { id: event.id }, data: { capacity: 0 } }),
    ).rejects.toThrow();
    for (const data of [
      { priceCents: 0, quantity: 1 },
      { priceCents: 1, quantity: 0 },
    ]) {
      await expect(
        ownerPrisma.ticketType.create({
          data: { eventId: event.id, producerId, name: "Inválido", ...data },
        }),
      ).rejects.toThrow();
    }
  });
});
