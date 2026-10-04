import "reflect-metadata";

import { createHmac, randomUUID } from "node:crypto";

import { type ApiConfig } from "@access/config";
import { PrismaClient, PrismaService, TenantContextService } from "@access/database";
import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";

import { AppModule } from "../src/app.module";
import { configureApplication } from "../src/app.setup";
import {
  BLINDPAY_GATEWAY,
  type BlindPayGateway,
  type BlindPayPayin,
  type BlindPayPayinQuote,
  type BlindPayPayinQuoteInput,
  BlindPayProviderError,
} from "../src/common/blindpay/blindpay.types";
import {
  PRIVY_GATEWAY,
  type PrivyGateway,
  type PrivyIdentity,
  type PrivyStellarWallet,
  type VerifiedPrivyPrincipal,
} from "../src/common/privy/privy.types";
import { stellarTestConfig } from "./test-stellar-config";

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
  // Built at runtime: the same test-only value the other suites use for the webhook secret.
  blindPayWebhookSecret: `whsec_${Buffer.from("test").toString("base64")}`,
  blindPayApiTimeoutMs: 500,
  blindPayAllowedRedirectOrigins: ["http://localhost:3000"],
  blindPayPartnerFeeId: undefined,
  ...stellarTestConfig,
};

const users = {
  producer: { token: "checkout-producer", privyUserId: "did:privy:checkout-producer" },
  buyerA: { token: "checkout-buyer-a", privyUserId: "did:privy:checkout-buyer-a" },
  buyerB: { token: "checkout-buyer-b", privyUserId: "did:privy:checkout-buyer-b" },
} as const;

type TestUser = (typeof users)[keyof typeof users];

const addressFor = (index: number) =>
  ["GAAA", "GBBB", "GCCC"][index]!.padEnd(56, ["A", "B", "C"][index]!);

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
    return { privyUserId: user.privyUserId, sessionId: `${user.token}-session` };
  }

  async getIdentity(privyUserId: string): Promise<PrivyIdentity> {
    return { privyUserId, verifiedEmail: `${privyUserId.split(":").pop()}@example.com` };
  }

  async findStellarWallet(privyUserId: string): Promise<PrivyStellarWallet | null> {
    return this.wallets.get(privyUserId) ?? null;
  }

  async createStellarWallet(privyUserId: string): Promise<PrivyStellarWallet> {
    const index = Object.values(users).findIndex((user) => user.privyUserId === privyUserId);
    const wallet = {
      id: `${privyUserId}-wallet`,
      address: addressFor(index),
      chainType: "stellar" as const,
      ownerPrivyUserId: privyUserId,
    };
    this.wallets.set(privyUserId, wallet);
    return wallet;
  }
}

class FakeBlindPayGateway implements BlindPayGateway {
  quoteInputs: BlindPayPayinQuoteInput[] = [];
  payinInputs: Array<{ quoteId: string; idempotencyKey: string }> = [];
  nextQuoteError: BlindPayProviderError | undefined;

  reset(): void {
    this.quoteInputs = [];
    this.payinInputs = [];
    this.nextQuoteError = undefined;
  }

  async createPayinQuote(input: BlindPayPayinQuoteInput): Promise<BlindPayPayinQuote> {
    this.quoteInputs.push(input);
    if (this.nextQuoteError !== undefined) {
      const error = this.nextQuoteError;
      this.nextQuoteError = undefined;
      throw error;
    }
    return {
      id: `qu_${randomUUID()}`,
      expiresAt: new Date(Date.now() + 5 * 60_000),
      senderAmount: input.requestAmountCents + 500,
      receiverAmount: Math.round(input.requestAmountCents / 5.5),
      commercialQuotation: 5.42,
      blindpayQuotation: 5.5,
      flatFee: 0,
      partnerFeeAmount: 0,
    };
  }

  async createPayin(quoteId: string, idempotencyKey: string): Promise<BlindPayPayin> {
    this.payinInputs.push({ quoteId, idempotencyKey });
    return { id: `pi_${quoteId.slice(3)}`, status: "processing", pixCode: `pix-${quoteId}` };
  }

  async createTermsOfServiceUrl(): Promise<never> {
    throw new Error("not used");
  }
  async uploadDocument(): Promise<never> {
    throw new Error("not used");
  }
  async createCustomer(): Promise<never> {
    throw new Error("not used");
  }
  async getCustomerKycStatus(): Promise<never> {
    throw new Error("not used");
  }
  async getOpenRfi(): Promise<never> {
    throw new Error("not used");
  }
  async submitRfi(): Promise<never> {
    throw new Error("not used");
  }
  async registerExternalStellarWallet(): Promise<never> {
    throw new Error("not used");
  }
}

const inThirtyDays = () => new Date(Date.now() + 30 * 86_400_000).toISOString();

describe("purchases integration", () => {
  let app: INestApplication;
  let ownerPrisma: PrismaClient;
  let runtimePrisma: PrismaService;
  let tenantContext: TenantContextService;
  const privy = new FakePrivyGateway();
  const blindPay = new FakeBlindPayGateway();

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule.forRoot(config)] })
      .overrideProvider(PRIVY_GATEWAY)
      .useValue(privy)
      .overrideProvider(BLINDPAY_GATEWAY)
      .useValue(blindPay)
      .compile();

    app = module.createNestApplication();
    configureApplication(app);
    await app.init();

    ownerPrisma = new PrismaClient({ datasources: { db: { url: ownerDatabaseUrl } } });
    runtimePrisma = app.get(PrismaService);
    tenantContext = app.get(TenantContextService);
  });

  async function cleanDatabase(): Promise<void> {
    await ownerPrisma.blindPayWebhookDelivery.deleteMany();
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
    blindPay.reset();
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
      post: (path: string, body?: object, key?: string) => {
        const call = request(server).post(path).set("Authorization", auth);
        return (key === undefined ? call : call.set("Idempotency-Key", key)).send(body);
      },
      patch: (path: string, body: object) =>
        request(server).patch(path).set("Authorization", auth).send(body),
    };
  }

  async function bootstrap(user: TestUser): Promise<string> {
    await api(user).post("/api/auth/bootstrap").expect(200);
    const account = await ownerPrisma.user.findUniqueOrThrow({
      where: { privyUserId: user.privyUserId },
    });
    return account.id;
  }

  async function readyProducer(): Promise<string> {
    const userId = await bootstrap(users.producer);
    const producer = await api(users.producer)
      .post("/api/producers", { displayName: "Produtora" })
      .expect(200);
    const wallet = await ownerPrisma.walletAccount.findUniqueOrThrow({ where: { userId } });
    await ownerPrisma.stellarAccountProvisioning.create({
      data: {
        producerId: producer.body.id,
        walletAccountId: wallet.id,
        network: "testnet",
        status: "ACTIVE",
        activatedAt: new Date(),
      },
    });
    await ownerPrisma.blindPayCustomer.create({
      data: {
        producerId: producer.body.id,
        externalCustomerId: "re_checkout",
        providerIdempotencyKey: "c".repeat(64),
        customerType: "INDIVIDUAL",
        creationStatus: "CREATED",
        kycStatus: "APPROVED",
        externalBlockchainWalletId: "bw_checkout",
      },
    });
    return producer.body.id as string;
  }

  async function publishedTicketType(quantity: number, priceCents = 8_000): Promise<string> {
    const event = await api(users.producer)
      .post("/api/events", { name: "Show", startsAt: inThirtyDays(), capacity: 500 })
      .expect(201);
    const ticketType = await api(users.producer)
      .post(`/api/events/${event.body.id}/ticket-types`, { name: "Pista", priceCents, quantity })
      .expect(201);
    await api(users.producer).post(`/api/events/${event.body.id}/publish`).expect(200);
    return ticketType.body.id as string;
  }

  function buy(user: TestUser, ticketTypeId: string, quantity: number, key = randomUUID()) {
    return api(user).post("/api/purchases", { ticketTypeId, quantity }, key);
  }

  it("creates a Pix to the producer wallet and shows it only to the buyer", async () => {
    await readyProducer();
    const ticketTypeId = await publishedTicketType(10);
    await bootstrap(users.buyerA);
    await bootstrap(users.buyerB);

    const created = await buy(users.buyerA, ticketTypeId, 2).expect(201);

    expect(created.body).toMatchObject({
      status: "awaiting_payment",
      quantity: 2,
      subtotalCents: 16_000,
      serviceFeeCents: 500,
      totalCents: 16_500,
      pixCode: expect.stringMatching(/^pix-qu_/),
      tickets: [],
    });
    expect(blindPay.quoteInputs).toEqual([
      {
        blockchainWalletId: "bw_checkout",
        requestAmountCents: 16_000,
        token: "USDB",
        partnerFeeId: undefined,
      },
    ]);
    await api(users.buyerA).get(`/api/purchases/${created.body.id}`).expect(200);
    await api(users.buyerB).get(`/api/purchases/${created.body.id}`).expect(404);
  });

  it("returns the same purchase for a repeated key and rejects the key for another order", async () => {
    await readyProducer();
    const ticketTypeId = await publishedTicketType(10);
    await bootstrap(users.buyerA);
    const key = randomUUID();

    const first = await buy(users.buyerA, ticketTypeId, 2, key).expect(201);
    const repeated = await buy(users.buyerA, ticketTypeId, 2, key).expect(201);
    expect(repeated.body).toEqual(first.body);
    expect(blindPay.quoteInputs).toHaveLength(1);
    expect(blindPay.payinInputs).toHaveLength(1);

    const reused = await buy(users.buyerA, ticketTypeId, 3, key).expect(409);
    expect(reused.body).toMatchObject({ code: "idempotency_key_reused" });
    await api(users.buyerA)
      .post("/api/purchases", { ticketTypeId, quantity: 1 })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe("invalid_idempotency_key"));
  });

  it("never sells the last tickets twice under concurrent checkouts", async () => {
    await readyProducer();
    const ticketTypeId = await publishedTicketType(3);
    await bootstrap(users.buyerA);
    await bootstrap(users.buyerB);

    const results = await Promise.all([
      buy(users.buyerA, ticketTypeId, 2),
      buy(users.buyerB, ticketTypeId, 2),
      buy(users.buyerA, ticketTypeId, 1),
      buy(users.buyerB, ticketTypeId, 1),
    ]);

    const reserved = await ownerPrisma.purchase.aggregate({
      where: { ticketTypeId, status: "AWAITING_PAYMENT" },
      _sum: { quantity: true },
    });
    expect(reserved._sum.quantity).toBeLessThanOrEqual(3);
    for (const result of results.filter((candidate) => candidate.status !== 201)) {
      expect(result.status).toBe(409);
      expect(result.body).toMatchObject({ code: "ticket_type_sold_out" });
    }
    expect(blindPay.payinInputs).toHaveLength(
      results.filter((candidate) => candidate.status === 201).length,
    );
  });

  it("keeps stock held while a Pix can be paid and releases only lapsed or failed orders", async () => {
    await readyProducer();
    const ticketTypeId = await publishedTicketType(2);
    await bootstrap(users.buyerA);
    await bootstrap(users.buyerB);

    const awaiting = await buy(users.buyerA, ticketTypeId, 2).expect(201);
    await ownerPrisma.purchase.update({
      where: { id: awaiting.body.id },
      data: { createdAt: new Date(Date.now() - 3 * 86_400_000) },
    });
    await buy(users.buyerB, ticketTypeId, 1)
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe("ticket_type_sold_out"));

    await ownerPrisma.purchase.update({
      where: { id: awaiting.body.id },
      data: { status: "INITIATED" },
    });
    await buy(users.buyerB, ticketTypeId, 2).expect(201);
  });

  it("fails the purchase and frees the stock when BlindPay rejects it", async () => {
    await readyProducer();
    const ticketTypeId = await publishedTicketType(2);
    await bootstrap(users.buyerA);
    blindPay.nextQuoteError = new BlindPayProviderError("create_payin_quote", false, 400, "LIMIT");

    const rejected = await buy(users.buyerA, ticketTypeId, 2).expect(422);
    expect(rejected.body).toMatchObject({ code: "payment_rejected" });
    await expect(ownerPrisma.purchase.findFirstOrThrow()).resolves.toMatchObject({
      status: "PAYMENT_FAILED",
      failureCode: "create_payin_quote:LIMIT",
    });

    await buy(users.buyerA, ticketTypeId, 2).expect(201);
  });

  it("refuses drafts, unready producers and orders below R$ 10", async () => {
    const producerId = await readyProducer();
    const ticketTypeId = await publishedTicketType(10, 900);
    await bootstrap(users.buyerA);

    await buy(users.buyerA, ticketTypeId, 1)
      .expect(422)
      .expect(({ body }) => expect(body.code).toBe("purchase_below_minimum"));
    await buy(users.buyerA, ticketTypeId, 2).expect(201);

    const draft = await api(users.producer)
      .post("/api/events", { name: "Rascunho", startsAt: inThirtyDays(), capacity: 10 })
      .expect(201);
    const draftType = await api(users.producer)
      .post(`/api/events/${draft.body.id}/ticket-types`, {
        name: "X",
        priceCents: 5_000,
        quantity: 5,
      })
      .expect(201);
    await buy(users.buyerA, draftType.body.id, 1)
      .expect(404)
      .expect(({ body }) => expect(body.code).toBe("ticket_type_not_available"));

    await ownerPrisma.blindPayCustomer.updateMany({
      where: { producerId },
      data: { kycStatus: "COMPLIANCE_REQUEST" },
    });
    await buy(users.buyerA, ticketTypeId, 2)
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe("producer_not_ready_for_sales"));
  });

  it("keeps a ticket type quantity above what is reserved or sold", async () => {
    await readyProducer();
    const ticketTypeId = await publishedTicketType(5);
    await bootstrap(users.buyerA);
    await buy(users.buyerA, ticketTypeId, 3).expect(201);
    const event = await ownerPrisma.ticketType.findUniqueOrThrow({ where: { id: ticketTypeId } });

    await api(users.producer)
      .patch(`/api/events/${event.eventId}/ticket-types/${ticketTypeId}`, { quantity: 2 })
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe("ticket_quantity_below_committed"));
    await api(users.producer)
      .patch(`/api/events/${event.eventId}/ticket-types/${ticketTypeId}`, { quantity: 3 })
      .expect(200);
  });

  it("confines purchases to the buyer, the producer's sales and the checkout functions", async () => {
    const producerId = await readyProducer();
    const ticketTypeId = await publishedTicketType(10);
    const buyerA = await bootstrap(users.buyerA);
    const buyerB = await bootstrap(users.buyerB);
    await buy(users.buyerA, ticketTypeId, 2).expect(201);
    const producerUser = await ownerPrisma.producerProfile.findUniqueOrThrow({
      where: { id: producerId },
    });

    const seen = await Promise.all([
      tenantContext.withUserContext(buyerA, (tx) => tx.purchase.count()),
      tenantContext.withUserContext(buyerB, (tx) => tx.purchase.count()),
      tenantContext.withProducerContext(producerUser.userId, (tx) => tx.purchase.count()),
      runtimePrisma.purchase.count(),
    ]);
    expect(seen).toEqual([1, 0, 1, 0]);

    await expect(
      runtimePrisma.$queryRaw`SELECT * FROM "reserve_purchase"(${ticketTypeId}::uuid, 1, 'k')`,
    ).rejects.toThrow(/checkout_user_context_missing/);
    await expect(
      tenantContext.withUserContext(
        buyerB,
        (tx) =>
          tx.$executeRaw`UPDATE "ticket_types" SET "quantity" = 1 WHERE "id" = ${ticketTypeId}::uuid`,
      ),
    ).resolves.toBe(0);
    await expect(
      tenantContext.withUserContext(
        buyerB,
        (tx) =>
          tx.$executeRaw`
          INSERT INTO "purchases" ("id", "buyer_user_id", "producer_id", "event_id",
            "ticket_type_id", "quantity", "unit_price_cents", "subtotal_cents",
            "idempotency_key", "updated_at")
          SELECT gen_random_uuid(), ${buyerB}::uuid, "producer_id", "event_id", "id", 1,
            "price_cents", "price_cents", 'direct', now()
          FROM "ticket_types" WHERE "id" = ${ticketTypeId}::uuid
        `,
      ),
    ).rejects.toThrow(/permission denied/);
  });

  describe("payin webhooks (6B)", () => {
    let messageSequence = 0;

    function payinWebhook(payinId: string, status: string, event = "payin.complete") {
      const body = JSON.stringify({ webhook_event: event, id: payinId, status });
      const messageId = `msg_payin_${(messageSequence += 1)}`;
      const timestamp = Math.floor(Date.now() / 1_000);
      const signature = createHmac("sha256", Buffer.from("test", "utf8"))
        .update(Buffer.from(`${messageId}.${timestamp}.${body}`, "utf8"))
        .digest("base64");
      const send = () =>
        request(app.getHttpServer())
          .post("/api/webhooks/blindpay")
          .set("Content-Type", "application/json")
          .set("svix-id", messageId)
          .set("svix-timestamp", String(timestamp))
          .set("svix-signature", `v1,${signature}`)
          .send(body);
      return { send };
    }

    async function awaitingPurchase(quantity = 2) {
      await readyProducer();
      const ticketTypeId = await publishedTicketType(5);
      await bootstrap(users.buyerA);
      const created = await buy(users.buyerA, ticketTypeId, quantity).expect(201);
      const stored = await ownerPrisma.purchase.findUniqueOrThrow({
        where: { id: created.body.id },
      });
      return { ticketTypeId, purchaseId: stored.id, payinId: stored.externalPayinId! };
    }

    it("confirms the payment once, creating the tickets and payment.confirmed together", async () => {
      const { purchaseId, payinId } = await awaitingPurchase(2);

      const delivery = payinWebhook(payinId, "completed");
      await delivery.send().expect(200);
      await delivery.send().expect(200);
      await payinWebhook(payinId, "completed").send().expect(200);

      const purchase = await ownerPrisma.purchase.findUniqueOrThrow({
        where: { id: purchaseId },
        include: { tickets: true },
      });
      expect(purchase.status).toBe("PAYMENT_CONFIRMED");
      expect(purchase.paymentConfirmedAt).not.toBeNull();
      expect(purchase.tickets).toHaveLength(2);
      for (const ticket of purchase.tickets) {
        expect(ticket).toMatchObject({
          status: "PENDING_MINT",
          ownerUserId: purchase.buyerUserId,
          eventId: purchase.eventId,
          ticketTypeId: purchase.ticketTypeId,
          tokenId: null,
        });
      }
      const outbox = await ownerPrisma.outboxEvent.findMany();
      expect(outbox).toHaveLength(1);
      expect(outbox[0]).toMatchObject({
        eventType: "payment.confirmed",
        aggregateType: "purchase",
        aggregateId: purchaseId,
        deduplicationKey: `purchase:${purchaseId}:payment_confirmed:v1`,
        payload: { purchaseId },
      });

      const view = await api(users.buyerA).get(`/api/purchases/${purchaseId}`).expect(200);
      expect(view.body).toMatchObject({ status: "payment_confirmed", pixCode: null });
      expect(view.body.tickets).toHaveLength(2);
    });

    it.each([
      ["failed", "PAYMENT_FAILED", "payin_failed"],
      ["refunded", "PAYMENT_REFUNDED", "payin_refunded"],
    ])("moves a %s payin to its final state and frees the stock", async (status, final, code) => {
      const { ticketTypeId, purchaseId, payinId } = await awaitingPurchase(5);

      await payinWebhook(payinId, status).send().expect(200);

      await expect(
        ownerPrisma.purchase.findUniqueOrThrow({ where: { id: purchaseId } }),
      ).resolves.toMatchObject({ status: final, failureCode: code });
      await expect(ownerPrisma.ticket.count()).resolves.toBe(0);
      await expect(ownerPrisma.outboxEvent.count()).resolves.toBe(0);
      await buy(users.buyerA, ticketTypeId, 5).expect(201);
    });

    it("keeps open payins waiting and ignores a late completion of a failed purchase", async () => {
      const { purchaseId, payinId } = await awaitingPurchase(2);

      await payinWebhook(payinId, "processing", "payin.new").send().expect(200);
      await payinWebhook(payinId, "on_hold", "payin.update").send().expect(200);
      await expect(
        ownerPrisma.purchase.findUniqueOrThrow({ where: { id: purchaseId } }),
      ).resolves.toMatchObject({ status: "AWAITING_PAYMENT" });

      await payinWebhook(payinId, "failed").send().expect(200);
      await payinWebhook(payinId, "completed").send().expect(200);
      await expect(
        ownerPrisma.purchase.findUniqueOrThrow({ where: { id: purchaseId } }),
      ).resolves.toMatchObject({ status: "PAYMENT_FAILED" });
      await expect(ownerPrisma.ticket.count()).resolves.toBe(0);
    });

    it("asks BlindPay to retry a final status for a payin it does not know yet", async () => {
      await payinWebhook("pi_unknown", "completed").send().expect(503);
      await payinWebhook("pi_unknown", "processing", "payin.new").send().expect(200);
      await expect(ownerPrisma.blindPayWebhookDelivery.count()).resolves.toBe(1);
    });
  });
});
