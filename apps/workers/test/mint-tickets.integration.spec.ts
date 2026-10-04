import "reflect-metadata";

import { randomUUID } from "node:crypto";

import { PrismaClient, PrismaService } from "@access/database";

import {
  type MintResult,
  type OnChainEvent,
  type TicketContractGateway,
} from "../src/chain/ticket-contract.gateway";
import { MintTicketsRepository } from "../src/tickets/mint-tickets.repository";
import { MintTicketsService } from "../src/tickets/mint-tickets.service";

const ownerDatabaseUrl = "postgresql://test:test@localhost:5433/access_test";
const workerDatabaseUrl = "postgresql://access_worker_login:test_worker@localhost:5433/access_test";

/** In-memory TicketContract with the same idempotency as the real one (SPEC-006 §5). */
class FakeTicketContract implements TicketContractGateway {
  readonly events = new Map<string, OnChainEvent>();
  readonly tokens = new Map<string, number>();
  capacityWrites = 0;

  async event(eventId: string): Promise<OnChainEvent | null> {
    return this.events.get(eventId) ?? null;
  }

  async setEventCapacity(eventId: string, capacity: number): Promise<void> {
    this.capacityWrites += 1;
    const minted = this.events.get(eventId)?.minted ?? 0;
    this.events.set(eventId, { capacity, minted });
  }

  async mint(ticketId: string, eventId: string): Promise<MintResult> {
    const existing = this.tokens.get(ticketId);
    if (existing !== undefined) {
      return { tokenId: existing, transactionHash: null };
    }
    const event = this.events.get(eventId)!;
    const tokenId = this.tokens.size;
    this.tokens.set(ticketId, tokenId);
    this.events.set(eventId, { ...event, minted: event.minted + 1 });
    return { tokenId, transactionHash: tokenId.toString(16).padStart(64, "0") };
  }
}

describe("MintTicketWorker integration", () => {
  const ownerPrisma = new PrismaClient({ datasources: { db: { url: ownerDatabaseUrl } } });
  const workerPrisma = new PrismaService(workerDatabaseUrl, true, "access_worker");
  let contract: FakeTicketContract;
  let service: MintTicketsService;

  beforeAll(async () => {
    await workerPrisma.onModuleInit();
  });

  async function cleanDatabase(): Promise<void> {
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
    contract = new FakeTicketContract();
    service = new MintTicketsService(new MintTicketsRepository(workerPrisma), contract);
  });

  afterAll(async () => {
    await cleanDatabase();
    await workerPrisma.$disconnect();
    await ownerPrisma.$disconnect();
  });

  async function confirmedPurchase(
    quantity: number,
    status: "PAYMENT_CONFIRMED" | "AWAITING_PAYMENT" = "PAYMENT_CONFIRMED",
  ) {
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
    await ownerPrisma.walletAccount.create({
      data: {
        userId: buyer.id,
        privyWalletId: `wallet-${suffix}`,
        stellarAddress: `G${suffix
          .toUpperCase()
          .replace(/[^A-Z2-7]/g, "A")
          .padEnd(55, "A")}`,
      },
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
        quantity,
        unitPriceCents: 5_000,
        subtotalCents: 5_000 * quantity,
        idempotencyKey: randomUUID(),
        status,
        externalPayinId: `pi_${suffix}`,
      },
    });
    await ownerPrisma.ticket.createMany({
      data: Array.from({ length: quantity }, () => ({
        purchaseId: purchase.id,
        producerId: producer.id,
        eventId: event.id,
        ticketTypeId: ticketType.id,
        ownerUserId: buyer.id,
      })),
    });
    return { purchaseId: purchase.id, eventId: event.id };
  }

  it("mints every ticket, records ticket.issued once each and completes the purchase", async () => {
    const { purchaseId, eventId } = await confirmedPurchase(3);

    await expect(service.mintPurchase(purchaseId)).resolves.toBe("issued");

    const purchase = await ownerPrisma.purchase.findUniqueOrThrow({
      where: { id: purchaseId },
      include: { tickets: true },
    });
    expect(purchase.status).toBe("TICKET_ISSUED");
    expect(purchase.tickets.map((ticket) => ticket.status)).toEqual(["ISSUED", "ISSUED", "ISSUED"]);
    expect(new Set(purchase.tickets.map((ticket) => ticket.tokenId)).size).toBe(3);
    expect(contract.events.get(eventId)).toEqual({ capacity: 300, minted: 3 });

    const outbox = await ownerPrisma.outboxEvent.findMany({
      where: { eventType: "ticket.issued" },
    });
    expect(outbox).toHaveLength(3);
    expect(outbox.map((event) => event.aggregateId).sort()).toEqual(
      purchase.tickets.map((ticket) => ticket.id).sort(),
    );

    await expect(service.mintPurchase(purchaseId)).resolves.toBe("already_issued");
    await expect(ownerPrisma.outboxEvent.count()).resolves.toBe(3);
    expect(contract.capacityWrites).toBe(1);
  });

  it("resumes after a failure midway without minting a ticket twice", async () => {
    const { purchaseId } = await confirmedPurchase(2);
    const mintSpy = jest.spyOn(contract, "mint");
    mintSpy.mockImplementationOnce(FakeTicketContract.prototype.mint.bind(contract));
    mintSpy.mockRejectedValueOnce(new Error("rpc timeout"));

    await expect(service.mintPurchase(purchaseId)).rejects.toThrow("rpc timeout");
    const halfway = await ownerPrisma.purchase.findUniqueOrThrow({
      where: { id: purchaseId },
      include: { tickets: true },
    });
    expect(halfway.status).toBe("PAYMENT_CONFIRMED");
    expect(halfway.tickets.filter((ticket) => ticket.status === "ISSUED")).toHaveLength(1);

    mintSpy.mockRestore();
    await expect(service.mintPurchase(purchaseId)).resolves.toBe("issued");
    await expect(
      ownerPrisma.purchase.findUniqueOrThrow({ where: { id: purchaseId } }),
    ).resolves.toMatchObject({ status: "TICKET_ISSUED" });
    expect(contract.tokens.size).toBe(2);
    await expect(
      ownerPrisma.outboxEvent.count({ where: { eventType: "ticket.issued" } }),
    ).resolves.toBe(2);
  });

  it("leaves unpaid purchases alone and cannot advance them on the worker role", async () => {
    const { purchaseId } = await confirmedPurchase(1, "AWAITING_PAYMENT");

    await expect(service.mintPurchase(purchaseId)).resolves.toBe("not_payable");
    expect(contract.tokens.size).toBe(0);

    await expect(
      workerPrisma.purchase.updateMany({
        where: { id: purchaseId },
        data: { status: "TICKET_ISSUED" },
      }),
    ).resolves.toEqual({ count: 0 });
    await expect(
      workerPrisma.ticket.updateMany({ where: { purchaseId }, data: { tokenId: 99 } }),
    ).resolves.toEqual({ count: 0 });
    await expect(workerPrisma.user.count()).rejects.toThrow(/permission denied/);
  });
});
