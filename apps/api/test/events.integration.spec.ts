import "reflect-metadata";

import { randomUUID } from "node:crypto";

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
import { COVER_STORAGE } from "../src/common/storage/cover-storage.types";
import { calendarDays, salesDate } from "../src/producers/producer-sales.types";
import { FakeCoverStorage } from "./fake-cover-storage";
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
  ticketMinPriceCents: 6_000,
  purchaseMaxTotalCents: 4_000_000,
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
const saoPaulo = { code: 3550308, name: "São Paulo", uf: "SP" };

describe("events integration", () => {
  let app: INestApplication;
  let ownerPrisma: PrismaClient;
  let runtimePrisma: PrismaService;
  let tenantContext: TenantContextService;
  const privy = new FakePrivyGateway();
  const covers = new FakeCoverStorage();

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule.forRoot(config)] })
      .overrideProvider(PRIVY_GATEWAY)
      .useValue(privy)
      .overrideProvider(COVER_STORAGE)
      .useValue(covers)
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
    covers.reset();
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
      put: (path: string, body: object) =>
        request(server).put(path).set("Authorization", auth).send(body),
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
        category: "festivals",
        cityCode: saoPaulo.code,
        startsAt: inThirtyDays(),
        capacity: 300,
        refundPolicy: "Reembolso integral até 7 dias antes do evento.",
        ...overrides,
      })
      .expect(201);
    return created.body as { id: string; slug: string };
  }

  // The browser's part of the flow: ask for the URL, PUT the file to R2, confirm the key.
  async function attachCover(
    user: TestUser,
    eventId: string,
    contentType = "image/png",
  ): Promise<string> {
    const upload = await api(user)
      .post(`/api/events/${eventId}/cover/upload-url`, { contentType })
      .expect(200);
    covers.upload(upload.body.key as string, contentType, 200_000);
    await api(user).put(`/api/events/${eventId}/cover`, { key: upload.body.key }).expect(200);
    return upload.body.key as string;
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
    await attachCover(user, event.id);
    await api(user).post(`/api/events/${event.id}/publish`).expect(200);
    return event;
  }

  it("creates a draft before KYC and publishes only once the producer is ready", async () => {
    const producerId = await createProducer(users.a);
    const event = await createEvent(users.a);
    expect(event).toMatchObject({ slug: "festival-access", status: "draft", ticketTypes: [] });

    await addTicketType(users.a, event.id);
    await attachCover(users.a, event.id);
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
    const { coverKey } = await ownerPrisma.event.findUniqueOrThrow({ where: { id: event.id } });

    const response = await request(app.getHttpServer())
      .get(`/api/public/events/${event.slug}`)
      .expect(200);
    expect(response.body).toEqual({
      slug: "festival-access",
      name: "Festival Access",
      description: null,
      category: "festivals",
      coverUrl: `https://covers.test/${coverKey}`,
      venueName: null,
      city: saoPaulo,
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
      await api(users.a)
        .post(`/api/events/${id}/cover/upload-url`, { contentType: "image/png" })
        .expect(404);
      await api(users.a).delete(`/api/events/${id}/cover`).expect(404);
    }
    const coverOfB = (await ownerPrisma.event.findUniqueOrThrow({ where: { id: eventOfB.id } }))
      .coverKey!;
    await api(users.a).put(`/api/events/${eventOfB.id}/cover`, { key: coverOfB }).expect(404);
    expect(covers.objects.has(coverOfB)).toBe(true);
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
    await attachCover(users.a, event.id);

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
    await attachCover(users.a, event.id);
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

  it("refuses a ticket price below the Pix minimum and accepts the minimum (D-26)", async () => {
    await createProducer(users.a);
    const event = await createEvent(users.a);

    const refused = await api(users.a)
      .post(`/api/events/${event.id}/ticket-types`, {
        name: "Meia",
        priceCents: 5_999,
        quantity: 1,
      })
      .expect(422);
    expect(refused.body).toMatchObject({ code: "ticket_price_below_minimum", minimumCents: 6_000 });

    const accepted = await api(users.a)
      .post(`/api/events/${event.id}/ticket-types`, {
        name: "Meia",
        priceCents: 6_000,
        quantity: 1,
      })
      .expect(201);
    await api(users.a)
      .patch(`/api/events/${event.id}/ticket-types/${accepted.body.id}`, { priceCents: 100 })
      .expect(422);
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

  it("gives the private view the minimum ticket price", async () => {
    await createProducer(users.a);
    const event = await createEvent(users.a);

    const view = await api(users.a).get(`/api/events/${event.id}`).expect(200);
    expect(view.body.ticketMinPriceCents).toBe(6_000);
  });

  it("counts confirmed and issued sales per event and in the panel, without buyer data", async () => {
    const eventA = await publishedEvent(users.a);
    const eventB = await publishedEvent(users.b);
    const [typeA, typeB] = await Promise.all(
      [eventA, eventB].map((event) =>
        ownerPrisma.ticketType.findFirstOrThrow({ where: { eventId: event.id } }),
      ),
    );
    const buyer = await ownerPrisma.user.create({
      data: { privyUserId: "did:privy:sales-buyer", email: "sales-buyer@example.com" },
    });

    // Brasília has no daylight saving time: -03:00 all year.
    const days = calendarDays(salesDate(new Date()), 11);
    const today = days[10]!;
    const yesterday = days[9]!;
    const dayBefore = days[8]!;
    const tenDaysAgo = days[0]!;
    const at = (date: string, time: string) => new Date(`${date}T${time}-03:00`);
    const sale = (
      ticketType: typeof typeA,
      status: "AWAITING_PAYMENT" | "PAYMENT_CONFIRMED" | "TICKET_ISSUED" | "PAYMENT_FAILED",
      quantity: number,
      confirmedAt: Date | null,
    ) =>
      ownerPrisma.purchase.create({
        data: {
          buyerUserId: buyer.id,
          producerId: ticketType!.producerId,
          eventId: ticketType!.eventId,
          ticketTypeId: ticketType!.id,
          quantity,
          unitPriceCents: 8_000,
          subtotalCents: quantity * 8_000,
          serviceFeeCents: 500,
          totalCents: quantity * 8_000 + 500,
          idempotencyKey: randomUUID(),
          status,
          paymentConfirmedAt: confirmedAt,
        },
      });
    await sale(typeA, "PAYMENT_CONFIRMED", 2, at(yesterday, "00:30:00"));
    // 02:30 UTC of yesterday, but still the day before in Brasília.
    await sale(typeA, "TICKET_ISSUED", 1, at(dayBefore, "23:30:00"));
    await sale(typeA, "TICKET_ISSUED", 1, at(tenDaysAgo, "12:00:00"));
    await sale(typeA, "AWAITING_PAYMENT", 3, null);
    await sale(typeA, "PAYMENT_FAILED", 4, null);
    await sale(typeB, "PAYMENT_CONFIRMED", 5, at(yesterday, "10:00:00"));

    const listA = await api(users.a).get("/api/events").expect(200);
    expect(listA.body).toEqual([
      expect.objectContaining({ id: eventA.id, soldTickets: 4, salesCents: 32_000 }),
    ]);
    const listB = await api(users.b).get("/api/events").expect(200);
    expect(listB.body[0]).toMatchObject({ soldTickets: 5, salesCents: 40_000 });

    const week = await api(users.a).get("/api/producers/me/sales?period=7d").expect(200);
    expect(week.body).toMatchObject({
      period: "7d",
      tickets: 3,
      salesCents: 24_000,
      previous: { tickets: 1, salesCents: 8_000 },
    });
    expect(week.body.daily).toHaveLength(7);
    expect(week.body.daily.slice(-3)).toEqual([
      { date: dayBefore, tickets: 1, salesCents: 8_000 },
      { date: yesterday, tickets: 2, salesCents: 16_000 },
      { date: today, tickets: 0, salesCents: 0 },
    ]);
    const month = await api(users.a).get("/api/producers/me/sales?period=30d").expect(200);
    expect(month.body).toMatchObject({ tickets: 4, previous: { tickets: 0 } });
    expect(month.body.daily).toHaveLength(30);

    const recent = await api(users.a).get("/api/producers/me/sales/recent?limit=2").expect(200);
    expect(recent.body).toEqual([
      {
        eventName: "Festival Access",
        ticketTypeName: "Pista",
        quantity: 2,
        subtotalCents: 16_000,
        confirmedAt: at(yesterday, "00:30:00").toISOString(),
      },
      {
        eventName: "Festival Access",
        ticketTypeName: "Pista",
        quantity: 1,
        subtotalCents: 8_000,
        confirmedAt: at(dayBefore, "23:30:00").toISOString(),
      },
    ]);
    const all = await api(users.a).get("/api/producers/me/sales/recent").expect(200);
    expect(all.body).toHaveLength(3);
    expect(JSON.stringify(all.body)).not.toMatch(new RegExp(`${buyer.id}|sales-buyer`));

    for (const path of [
      "/api/producers/me/sales",
      "/api/producers/me/sales?period=1y",
      "/api/producers/me/sales/recent?limit=0",
      "/api/producers/me/sales/recent?limit=21",
    ]) {
      const invalid = await api(users.a).get(path).expect(400);
      expect(invalid.body).toMatchObject({ code: "invalid_sales_query" });
    }
  });

  it("searches IBGE cities without accents, by any word, ten at most in alphabetical order", async () => {
    await api(users.a).post("/api/auth/bootstrap").expect(200);
    const search = (query: string) =>
      api(users.a)
        .get(`/api/cities?query=${encodeURIComponent(query)}`)
        .expect(200);

    const accented = await search("São Paulo");
    const plain = await search("sao paulo");
    expect(accented.body).toEqual(plain.body);
    expect(accented.body[0]).toEqual(saoPaulo);
    expect(accented.body.map((city: { name: string }) => city.name)).toEqual([
      "São Paulo",
      "São Paulo das Missões",
      "São Paulo de Olivença",
      "São Paulo do Potengi",
    ]);

    const byWord = await search("olivenca");
    expect(byWord.body).toContainEqual({ code: 1303908, name: "São Paulo de Olivença", uf: "AM" });
    const afterApostrophe = await search("oeste");
    expect(afterApostrophe.body).toContainEqual({
      code: 1100015,
      name: "Alta Floresta D'Oeste",
      uf: "RO",
    });
    const afterHyphen = await search("mirim");
    expect(afterHyphen.body).toContainEqual({ code: 1100106, name: "Guajará-Mirim", uf: "RO" });

    const many = await search("sa");
    expect(many.body).toHaveLength(10);
    const names = many.body.map((city: { name: string }) =>
      city.name.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase(),
    );
    expect(names).toEqual([...names].sort());

    const short = await api(users.a).get("/api/cities?query=s").expect(400);
    expect(short.body).toMatchObject({ code: "invalid_city_query" });
    await expect(search("sa%")).resolves.toMatchObject({ body: [] });
    await request(app.getHttpServer()).get("/api/cities?query=sao").expect(401);
  });

  it("stores the category and the IBGE city, and refuses a code outside the base", async () => {
    await createProducer(users.a);
    const created = await api(users.a)
      .post("/api/events", {
        name: "Stand-up",
        category: "standup",
        cityCode: 3304557,
        startsAt: inThirtyDays(),
        capacity: 100,
      })
      .expect(201);
    expect(created.body).toMatchObject({
      category: "standup",
      city: { code: 3304557, name: "Rio de Janeiro", uf: "RJ" },
      coverUrl: null,
    });

    const updated = await api(users.a)
      .patch(`/api/events/${created.body.id}`, { category: "theater", cityCode: saoPaulo.code })
      .expect(200);
    expect(updated.body).toMatchObject({ category: "theater", city: saoPaulo });
    const listed = await api(users.a).get("/api/events").expect(200);
    expect(listed.body[0]).toMatchObject({ category: "theater", city: saoPaulo, coverUrl: null });

    for (const body of [{ cityCode: 1_234_567 }, { cityCode: null }, { category: "rodeio" }]) {
      const refused = await api(users.a).patch(`/api/events/${created.body.id}`, body).expect(400);
      expect(refused.body).toMatchObject({ code: "invalid_event", fields: Object.keys(body) });
    }
  });

  it("publishes only with a cover, a category and a city", async () => {
    const producerId = await createProducer(users.a);
    await makeReady(users.a, producerId);
    const bare = await api(users.a)
      .post("/api/events", { name: "Sem capa", startsAt: inThirtyDays(), capacity: 300 })
      .expect(201);
    expect(bare.body).toMatchObject({ category: null, city: null, coverUrl: null });
    await addTicketType(users.a, bare.body.id);

    const missingAll = await api(users.a).post(`/api/events/${bare.body.id}/publish`).expect(422);
    expect(missingAll.body).toMatchObject({
      code: "event_not_publishable",
      missing: ["cover", "category", "city"],
    });

    await api(users.a)
      .patch(`/api/events/${bare.body.id}`, { category: "shows", cityCode: saoPaulo.code })
      .expect(200);
    const missingCover = await api(users.a).post(`/api/events/${bare.body.id}/publish`).expect(422);
    expect(missingCover.body).toMatchObject({ missing: ["cover"] });

    await attachCover(users.a, bare.body.id);
    await api(users.a).post(`/api/events/${bare.body.id}/publish`).expect(200);
  });

  it("confirms only a valid upload of the event's own key", async () => {
    await createProducer(users.a);
    const event = await createEvent(users.a);
    const other = await createEvent(users.a, { name: "Outro" });

    const upload = await api(users.a)
      .post(`/api/events/${event.id}/cover/upload-url`, { contentType: "image/jpeg" })
      .expect(200);
    expect(upload.body).toEqual({
      uploadUrl: expect.stringContaining(upload.body.key),
      key: expect.stringMatching(new RegExp(`^events/${event.id}/[0-9a-f-]{36}\\.jpg$`)),
      expiresAt: expect.any(String),
    });
    expect(covers.presigned).toEqual([
      { key: upload.body.key, contentType: "image/jpeg", expiresInSeconds: 600 },
    ]);
    const invalidRequest = await api(users.a)
      .post(`/api/events/${event.id}/cover/upload-url`, { contentType: "image/gif" })
      .expect(400);
    expect(invalidRequest.body).toMatchObject({ code: "invalid_cover_request" });

    // Never uploaded.
    await api(users.a).put(`/api/events/${event.id}/cover`, { key: upload.body.key }).expect(422);

    // Uploaded with a type other than the signed one, or too large: refused and deleted.
    covers.upload(upload.body.key, "image/png", 1_000);
    const wrongType = await api(users.a)
      .put(`/api/events/${event.id}/cover`, { key: upload.body.key })
      .expect(422);
    expect(wrongType.body).toMatchObject({ code: "invalid_cover" });
    expect(covers.objects.has(upload.body.key)).toBe(false);
    covers.upload(upload.body.key, "image/jpeg", 5 * 1024 * 1024 + 1);
    await api(users.a).put(`/api/events/${event.id}/cover`, { key: upload.body.key }).expect(422);
    expect(covers.objects.has(upload.body.key)).toBe(false);

    // The key of another event is refused without touching that event's object.
    const otherKey = await attachCover(users.a, other.id);
    await api(users.a).put(`/api/events/${event.id}/cover`, { key: otherKey }).expect(422);
    expect(covers.objects.has(otherKey)).toBe(true);

    const stored = await ownerPrisma.event.findUniqueOrThrow({ where: { id: event.id } });
    expect(stored.coverKey).toBeNull();
  });

  it("replaces and removes covers, deleting the old object, and keeps a published one", async () => {
    const producerId = await createProducer(users.a);
    await makeReady(users.a, producerId);
    const event = await createEvent(users.a);
    await addTicketType(users.a, event.id);

    const first = await attachCover(users.a, event.id, "image/jpeg");
    const second = await attachCover(users.a, event.id, "image/webp");
    expect(covers.objects.has(first)).toBe(false);
    const current = await api(users.a).get(`/api/events/${event.id}`).expect(200);
    expect(current.body.coverUrl).toBe(`https://covers.test/${second}`);

    // Confirming the current key again changes nothing.
    await api(users.a).put(`/api/events/${event.id}/cover`, { key: second }).expect(200);
    expect(covers.objects.has(second)).toBe(true);

    await api(users.a).delete(`/api/events/${event.id}/cover`).expect(204);
    expect(covers.objects.has(second)).toBe(false);
    await api(users.a).delete(`/api/events/${event.id}/cover`).expect(204);
    await expect(api(users.a).get(`/api/events/${event.id}`)).resolves.toMatchObject({
      body: { coverUrl: null },
    });

    const third = await attachCover(users.a, event.id);
    await api(users.a).post(`/api/events/${event.id}/publish`).expect(200);
    const kept = await api(users.a).delete(`/api/events/${event.id}/cover`).expect(409);
    expect(kept.body).toMatchObject({ code: "event_cover_required" });
    expect(covers.objects.has(third)).toBe(true);

    // A published event can still swap its cover.
    const fourth = await attachCover(users.a, event.id);
    expect(covers.objects.has(third)).toBe(false);
    const publicView = await request(app.getHttpServer())
      .get(`/api/public/events/${event.slug}`)
      .expect(200);
    expect(publicView.body.coverUrl).toBe(`https://covers.test/${fourth}`);
  });
});
