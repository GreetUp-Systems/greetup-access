import "reflect-metadata";

import { randomUUID } from "node:crypto";

import { PrismaClient, PrismaService } from "@access/database";

import { type EmailGateway, type EmailMessage } from "../src/notifications/email.gateway";
import { NotificationsRepository } from "../src/notifications/notifications.repository";
import { NotifyService } from "../src/notifications/notify.service";

const ownerDatabaseUrl = "postgresql://test:test@localhost:5433/access_test";
const workerDatabaseUrl = "postgresql://access_worker_login:test_worker@localhost:5433/access_test";

/** Resend stand-in: a repeated idempotency key is accepted but not delivered again. */
class FakeEmailGateway implements EmailGateway {
  readonly delivered = new Map<string, EmailMessage>();
  calls = 0;

  async send(message: EmailMessage, idempotencyKey: string): Promise<{ id: string }> {
    this.calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 20));
    if (!this.delivered.has(idempotencyKey)) {
      this.delivered.set(idempotencyKey, message);
    }
    return { id: `email-${idempotencyKey}` };
  }
}

describe("NotifyWorker integration", () => {
  const ownerPrisma = new PrismaClient({ datasources: { db: { url: ownerDatabaseUrl } } });
  const workerPrisma = new PrismaService(workerDatabaseUrl, true, "access_worker");
  let email: FakeEmailGateway;
  let service: NotifyService;

  beforeAll(async () => {
    await workerPrisma.onModuleInit();
  });

  async function cleanDatabase(): Promise<void> {
    await ownerPrisma.emailNotification.deleteMany();
    await ownerPrisma.outboxEvent.deleteMany();
    await ownerPrisma.ticket.deleteMany();
    await ownerPrisma.purchase.deleteMany();
    await ownerPrisma.ticketType.deleteMany();
    await ownerPrisma.event.deleteMany();
    await ownerPrisma.producerProfile.deleteMany();
    await ownerPrisma.walletActivation.deleteMany();
    await ownerPrisma.walletAccount.deleteMany();
    await ownerPrisma.user.deleteMany();
  }

  beforeEach(async () => {
    await cleanDatabase();
    email = new FakeEmailGateway();
    service = new NotifyService(new NotificationsRepository(workerPrisma), email, {
      appPublicUrl: "https://app.example.com",
    });
  });

  afterAll(async () => {
    await cleanDatabase();
    await workerPrisma.$disconnect();
    await ownerPrisma.$disconnect();
  });

  async function purchaseWithTickets(statuses: Array<"ISSUED" | "PENDING_MINT">) {
    const suffix = randomUUID().slice(0, 8);
    const producerUser = await ownerPrisma.user.create({
      data: { privyUserId: `did:privy:producer-${suffix}`, email: `producer-${suffix}@x.com` },
    });
    const producer = await ownerPrisma.producerProfile.create({
      data: { userId: producerUser.id, displayName: "Produtora" },
    });
    const buyer = await ownerPrisma.user.create({
      data: { privyUserId: `did:privy:buyer-${suffix}`, email: `buyer-${suffix}@x.com` },
    });
    const event = await ownerPrisma.event.create({
      data: {
        producerId: producer.id,
        slug: `show-${suffix}`,
        name: "Show",
        startsAt: new Date(Date.now() + 30 * 86_400_000),
        capacity: 300,
        status: "PUBLISHED",
      },
    });
    const ticketType = await ownerPrisma.ticketType.create({
      data: {
        eventId: event.id,
        producerId: producer.id,
        name: "Pista",
        priceCents: 5_000,
        quantity: 10,
      },
    });
    const purchase = await ownerPrisma.purchase.create({
      data: {
        buyerUserId: buyer.id,
        producerId: producer.id,
        eventId: event.id,
        ticketTypeId: ticketType.id,
        quantity: statuses.length,
        unitPriceCents: 5_000,
        subtotalCents: 5_000 * statuses.length,
        idempotencyKey: randomUUID(),
        status: statuses.every((status) => status === "ISSUED")
          ? "TICKET_ISSUED"
          : "PAYMENT_CONFIRMED",
      },
    });
    const tickets = [];
    for (const [index, status] of statuses.entries()) {
      tickets.push(
        await ownerPrisma.ticket.create({
          data: {
            purchaseId: purchase.id,
            producerId: producer.id,
            eventId: event.id,
            ticketTypeId: ticketType.id,
            ownerUserId: buyer.id,
            status,
            ...(status === "ISSUED" ? { tokenId: index + 100, issuedAt: new Date() } : {}),
          },
        }),
      );
    }
    return { buyer, purchase, tickets };
  }

  it("sends a single e-mail for a purchase of three tickets, even with repeated jobs", async () => {
    const { buyer, purchase, tickets } = await purchaseWithTickets(["ISSUED", "ISSUED", "ISSUED"]);

    const outcomes = await Promise.all(tickets.map((ticket) => service.ticketsReady(ticket.id)));
    const repeated = await service.ticketsReady(tickets[0]!.id);

    expect(outcomes).toContain("sent");
    expect(repeated).toBe("already_sent");
    expect(email.delivered.size).toBe(1);
    expect(email.delivered.get(`tickets-ready:${purchase.id}`)).toMatchObject({
      to: buyer.email,
      subject: "Seus ingressos para Show estão prontos",
    });
    const notifications = await ownerPrisma.emailNotification.findMany();
    expect(notifications).toEqual([
      expect.objectContaining({
        kind: "TICKETS_READY",
        referenceId: purchase.id,
        userId: buyer.id,
        status: "SENT",
        providerMessageId: `email-tickets-ready:${purchase.id}`,
      }),
    ]);
  });

  it("waits for the last ticket before sending", async () => {
    const { tickets } = await purchaseWithTickets(["ISSUED", "PENDING_MINT"]);

    await expect(service.ticketsReady(tickets[0]!.id)).resolves.toBe("tickets_pending");
    expect(email.calls).toBe(0);
    await expect(ownerPrisma.emailNotification.count()).resolves.toBe(0);

    await ownerPrisma.ticket.update({
      where: { id: tickets[1]!.id },
      data: { status: "ISSUED", tokenId: 200, issuedAt: new Date() },
    });
    await expect(service.ticketsReady(tickets[1]!.id)).resolves.toBe("sent");
  });

  it("reads only the recipient's id and e-mail from users", async () => {
    const { buyer } = await purchaseWithTickets(["ISSUED"]);

    await expect(
      workerPrisma.user.findUnique({ where: { id: buyer.id }, select: { id: true, email: true } }),
    ).resolves.toEqual({ id: buyer.id, email: buyer.email });
    await expect(
      workerPrisma.user.findUnique({ where: { id: buyer.id }, select: { privyUserId: true } }),
    ).rejects.toThrow(/permission denied/i);
    await expect(
      workerPrisma.ticketType.findFirst({ select: { priceCents: true } }),
    ).rejects.toThrow(/permission denied/i);
  });
});
