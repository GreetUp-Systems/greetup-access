import "reflect-metadata";

import { randomUUID } from "node:crypto";

import { PrismaClient, PrismaService } from "@access/database";
import { Queue } from "bullmq";

import { OutboxRelayService } from "../src/outbox/outbox-relay.service";
import { BullMqPublisher } from "../src/queues/bullmq-publisher";
import { MINT_TICKET_JOB, type QueuePublisher, TICKETS_QUEUE } from "../src/queues/queues";

const ownerDatabaseUrl = "postgresql://test:test@localhost:5433/access_test";
const workerDatabaseUrl = "postgresql://access_worker_login:test_worker@localhost:5433/access_test";
const redisUrl = "redis://localhost:6380";

describe("OutboxRelay integration", () => {
  const ownerPrisma = new PrismaClient({ datasources: { db: { url: ownerDatabaseUrl } } });
  const workerPrisma = new PrismaService(workerDatabaseUrl, true, "access_worker");
  const publisher = new BullMqPublisher(redisUrl);
  const ticketsQueue = new Queue(TICKETS_QUEUE, { connection: { url: redisUrl } });
  const relay = new OutboxRelayService(workerPrisma, publisher);

  beforeAll(async () => {
    await workerPrisma.onModuleInit();
  });

  beforeEach(async () => {
    await ownerPrisma.outboxEvent.deleteMany();
    await ticketsQueue.obliterate({ force: true });
  });

  afterAll(async () => {
    await ownerPrisma.outboxEvent.deleteMany();
    await ticketsQueue.obliterate({ force: true });
    await ticketsQueue.close();
    await publisher.onModuleDestroy();
    await workerPrisma.$disconnect();
    await ownerPrisma.$disconnect();
  });

  async function outboxEvent(eventType: string, payload: object) {
    return ownerPrisma.outboxEvent.create({
      data: {
        deduplicationKey: randomUUID(),
        aggregateType: "purchase",
        aggregateId: randomUUID(),
        eventType,
        payload,
      },
    });
  }

  it("publishes payment.confirmed as a MintTicketJob keyed by the outbox id", async () => {
    const purchaseId = randomUUID();
    const confirmed = await outboxEvent("payment.confirmed", { purchaseId });
    const unrouted = await outboxEvent("event.cancelled", { eventId: randomUUID() });

    await expect(relay.relayOnce()).resolves.toBe(1);

    const job = await ticketsQueue.getJob(confirmed.id);
    expect(job?.name).toBe(MINT_TICKET_JOB);
    expect(job?.data).toEqual({ purchaseId, outboxEventId: confirmed.id });
    expect(job?.opts.attempts).toBe(8);
    await expect(
      ownerPrisma.outboxEvent.findUniqueOrThrow({ where: { id: confirmed.id } }),
    ).resolves.toMatchObject({ status: "PROCESSED", processedAt: expect.any(Date) });
    await expect(
      ownerPrisma.outboxEvent.findUniqueOrThrow({ where: { id: unrouted.id } }),
    ).resolves.toMatchObject({ status: "PENDING" });
  });

  it("publishes each event once under concurrent relays and harmless republication", async () => {
    const events = await Promise.all(
      Array.from({ length: 5 }, () =>
        outboxEvent("payment.confirmed", { purchaseId: randomUUID() }),
      ),
    );

    const relayed = await Promise.all([relay.relayOnce(), relay.relayOnce(), relay.relayOnce()]);
    expect(relayed.reduce((total, count) => total + count, 0)).toBe(5);
    await expect(ticketsQueue.count()).resolves.toBe(5);

    await ownerPrisma.outboxEvent.updateMany({ data: { status: "PENDING", processedAt: null } });
    await relay.relayOnce();
    await expect(ticketsQueue.count()).resolves.toBe(5);
    for (const event of events) {
      await expect(ticketsQueue.getJob(event.id)).resolves.toBeDefined();
    }
  });

  it("backs off when the queue is unavailable and fails events with a broken payload", async () => {
    const failingPublisher: QueuePublisher = {
      publish: () => Promise.reject(new Error("redis down")),
    };
    const failingRelay = new OutboxRelayService(workerPrisma, failingPublisher);
    const event = await outboxEvent("payment.confirmed", { purchaseId: randomUUID() });
    const broken = await outboxEvent("payment.confirmed", { unexpected: true });

    await failingRelay.relayOnce();

    const retried = await ownerPrisma.outboxEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(retried).toMatchObject({ status: "PENDING", attempts: 1, lastError: "Error" });
    expect(retried.availableAt.getTime()).toBeGreaterThan(Date.now());
    await expect(
      ownerPrisma.outboxEvent.findUniqueOrThrow({ where: { id: broken.id } }),
    ).resolves.toMatchObject({ status: "FAILED", lastError: "invalid_outbox_payload" });

    // Not yet available again: a second pass leaves it alone.
    await expect(relay.relayOnce()).resolves.toBe(0);
  });

  it("runs on a restricted role that cannot touch tenant data", async () => {
    await expect(workerPrisma.purchase.count()).rejects.toThrow(/permission denied/);
    await expect(workerPrisma.user.count()).rejects.toThrow(/permission denied/);

    const owner = new PrismaService(ownerDatabaseUrl, true, "access_worker");
    try {
      await expect(owner.assertRestrictedRuntimeRole()).rejects.toThrow(
        "The database URL must use the restricted access_worker role.",
      );
    } finally {
      await owner.$disconnect();
    }
  });
});
