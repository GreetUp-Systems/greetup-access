import "reflect-metadata";

import { randomBytes, randomUUID } from "node:crypto";

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
  type VerifiedPrivyPrincipal,
} from "../src/common/privy/privy.types";
import { COVER_STORAGE } from "../src/common/storage/cover-storage.types";
import { PURCHASE_STREAM_TIMING } from "../src/purchases/purchases.types";
import { TicketQrService } from "../src/tickets/ticket-qr.service";
import { FakeCoverStorage } from "./fake-cover-storage";
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
  a: { token: "tickets-a", privyUserId: "did:privy:tickets-a" },
  b: { token: "tickets-b", privyUserId: "did:privy:tickets-b" },
} as const;
type TestUser = (typeof users)[keyof typeof users];

const notUsed = (): never => {
  throw new Error("not used");
};

const privy: PrivyGateway = {
  async verifyAccessToken(token: string): Promise<VerifiedPrivyPrincipal> {
    const user = Object.values(users).find((candidate) => candidate.token === token);
    if (user === undefined) {
      throw new Error("invalid token");
    }
    return { privyUserId: user.privyUserId, sessionId: `${token}-session` };
  },
  getIdentity: notUsed,
  findStellarWallet: notUsed,
  createStellarWallet: notUsed,
};

describe("buyer tickets integration", () => {
  let app: INestApplication;
  let ownerPrisma: PrismaClient;
  let seeded: Awaited<ReturnType<typeof seed>>;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule.forRoot(config)] })
      .overrideProvider(PRIVY_GATEWAY)
      .useValue(privy)
      .overrideProvider(PURCHASE_STREAM_TIMING)
      .useValue({ pollMs: 50, heartbeatMs: 10_000, timeoutMs: 10_000 })
      .overrideProvider(COVER_STORAGE)
      .useValue(new FakeCoverStorage())
      .compile();
    app = module.createNestApplication();
    configureApplication(app);
    await app.init();
    ownerPrisma = new PrismaClient({ datasources: { db: { url: ownerDatabaseUrl } } });
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

  async function createUser(user: TestUser, letter: string) {
    return ownerPrisma.user.create({
      data: {
        privyUserId: user.privyUserId,
        email: `${user.token}@example.com`,
        wallet: {
          create: {
            privyWalletId: `${user.token}-wallet`,
            stellarAddress: `G${letter.repeat(55)}`,
          },
        },
      },
    });
  }

  async function seed() {
    const buyerA = await createUser(users.a, "C");
    const buyerB = await createUser(users.b, "D");
    const seller = await ownerPrisma.user.create({
      data: { privyUserId: "did:privy:tickets-seller", email: "seller@example.com" },
    });
    const producer = await ownerPrisma.producerProfile.create({
      data: { userId: seller.id, displayName: "Produtora" },
    });
    const createEvent = async (name: string, daysAhead: number, coverKey: string | null) =>
      ownerPrisma.event.create({
        data: {
          producerId: producer.id,
          slug: `${name.toLowerCase()}-${randomUUID().slice(0, 8)}`,
          name,
          startsAt: new Date(Date.now() + daysAhead * 86_400_000),
          capacity: 10,
          status: "PUBLISHED",
          coverKey,
        },
      });
    const later = await createEvent("Later", 20, `events/${randomUUID()}/${randomUUID()}.webp`);
    const sooner = await createEvent("Sooner", 5, null);
    const createType = async (eventId: string) =>
      ownerPrisma.ticketType.create({
        data: { eventId, producerId: producer.id, name: "Pista", priceCents: 5_000, quantity: 5 },
      });
    const laterType = await createType(later.id);
    const soonerType = await createType(sooner.id);

    const createPurchase = async (
      buyerUserId: string,
      eventId: string,
      ticketTypeId: string,
      status: "AWAITING_PAYMENT" | "TICKET_ISSUED" | "PAYMENT_CONFIRMED",
    ) =>
      ownerPrisma.purchase.create({
        data: {
          buyerUserId,
          producerId: producer.id,
          eventId,
          ticketTypeId,
          quantity: 1,
          unitPriceCents: 5_000,
          subtotalCents: 5_000,
          idempotencyKey: randomUUID(),
          status,
        },
      });
    const issuedPurchase = await createPurchase(buyerA.id, later.id, laterType.id, "TICKET_ISSUED");
    const pendingPurchase = await createPurchase(
      buyerA.id,
      sooner.id,
      soonerType.id,
      "PAYMENT_CONFIRMED",
    );
    const otherPurchase = await createPurchase(buyerB.id, later.id, laterType.id, "TICKET_ISSUED");
    const waitingPurchase = await createPurchase(
      buyerA.id,
      later.id,
      laterType.id,
      "AWAITING_PAYMENT",
    );

    const mintTxHash = randomBytes(32).toString("hex");
    const issued = await ownerPrisma.ticket.create({
      data: {
        purchaseId: issuedPurchase.id,
        producerId: producer.id,
        eventId: later.id,
        ticketTypeId: laterType.id,
        ownerUserId: buyerA.id,
        status: "ISSUED",
        tokenId: 7,
        mintTxHash,
        issuedAt: new Date(),
      },
    });
    const pending = await ownerPrisma.ticket.create({
      data: {
        purchaseId: pendingPurchase.id,
        producerId: producer.id,
        eventId: sooner.id,
        ticketTypeId: soonerType.id,
        ownerUserId: buyerA.id,
      },
    });
    const othersTicket = await ownerPrisma.ticket.create({
      data: {
        purchaseId: otherPurchase.id,
        producerId: producer.id,
        eventId: later.id,
        ticketTypeId: laterType.id,
        ownerUserId: buyerB.id,
        status: "ISSUED",
        tokenId: 8,
        mintTxHash: randomBytes(32).toString("hex"),
        issuedAt: new Date(),
      },
    });

    return { buyerA, issued, pending, othersTicket, mintTxHash, waitingPurchase, later, sooner };
  }

  beforeEach(async () => {
    await cleanDatabase();
    seeded = await seed();
  });

  afterAll(async () => {
    await cleanDatabase();
    await app.close();
    await ownerPrisma.$disconnect();
  });

  function get(user: TestUser, path: string) {
    return request(app.getHttpServer()).get(path).set("Authorization", `Bearer ${user.token}`);
  }

  it("lists only the buyer's own tickets, ordered by event date", async () => {
    const response = await get(users.a, "/api/me/tickets").expect(200);

    expect(response.body.tickets.map((ticket: { id: string }) => ticket.id)).toEqual([
      seeded.pending.id,
      seeded.issued.id,
    ]);
    expect(response.body.tickets[0]).toMatchObject({
      status: "pending_mint",
      event: { id: seeded.sooner.id, name: "Sooner", coverUrl: null },
      ticketType: { name: "Pista" },
      onchain: null,
    });
    expect(response.body.tickets[1]).toMatchObject({
      status: "issued",
      event: {
        id: seeded.later.id,
        name: "Later",
        coverUrl: `https://covers.test/${seeded.later.coverKey}`,
      },
      onchain: {
        contractId: config.stellarTicketContractId,
        tokenId: 7,
        transactionHash: seeded.mintTxHash,
        explorerUrl: `https://stellar.expert/explorer/testnet/tx/${seeded.mintTxHash}`,
      },
    });
    expect(response.body.tickets[1]).not.toHaveProperty("qrToken");

    const other = await get(users.b, "/api/me/tickets").expect(200);
    expect(other.body.tickets.map((ticket: { id: string }) => ticket.id)).toEqual([
      seeded.othersTicket.id,
    ]);
  });

  it("returns the signed QR only for an issued ticket of the owner", async () => {
    const issued = await get(users.a, `/api/me/tickets/${seeded.issued.id}`).expect(200);
    const qr = app.get(TicketQrService);
    expect(qr.verify(issued.body.qrToken as string, seeded.buyerA.id)).toBe(true);

    const pending = await get(users.a, `/api/me/tickets/${seeded.pending.id}`).expect(200);
    expect(pending.body.qrToken).toBeNull();

    await get(users.b, `/api/me/tickets/${seeded.issued.id}`)
      .expect(404)
      .expect(({ body }) => expect(body.code).toBe("ticket_not_found"));
    await get(users.a, "/api/me/tickets/not-a-uuid").expect(400);
    await request(app.getHttpServer()).get("/api/me/tickets").expect(401);
  });

  it("streams the purchase stages and closes on the final one", async () => {
    const server = app.getHttpServer();
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as { port: number };
    try {
      const response = await fetch(
        `http://127.0.0.1:${port}/api/purchases/${seeded.waitingPurchase.id}/stream`,
        { headers: { Authorization: `Bearer ${users.a.token}`, Accept: "text/event-stream" } },
      );
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/event-stream");

      // A Prisma query only runs once awaited, so the update is awaited inside the timer.
      const updated = new Promise<void>((resolve, reject) => {
        setTimeout(() => {
          ownerPrisma.purchase
            .update({
              where: { id: seeded.waitingPurchase.id },
              data: { status: "TICKET_ISSUED" },
            })
            .then(() => resolve(), reject);
        }, 300);
      });

      const events = (await response.text())
        .split(/\r?\n\r?\n/)
        .filter((block) => block.includes("event: status"))
        .map((block) => JSON.parse(block.split("data: ")[1]!) as Record<string, string>);
      await updated;
      expect(events).toEqual([
        {
          purchaseId: seeded.waitingPurchase.id,
          stage: "awaiting_payment",
          status: "awaiting_payment",
        },
        { purchaseId: seeded.waitingPurchase.id, stage: "ticket_issued", status: "ticket_issued" },
      ]);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("answers 404 before streaming another buyer's purchase", async () => {
    await get(users.b, `/api/purchases/${seeded.waitingPurchase.id}/stream`)
      .set("Accept", "text/event-stream")
      .expect(404)
      .expect(({ body }) => expect(body.code).toBe("purchase_not_found"));
  });
});
