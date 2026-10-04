import { Prisma, ProducerContextNotFoundError } from "@access/database";

import { type ProducerProfileRecord } from "../producers/producers.repository";
import { type UserWithWallet, UsersRepository } from "../users/users.repository";
import {
  type EventRecord,
  EventsRepository,
  type LockedEventScope,
  type TicketTypeRecord,
} from "./events.repository";
import { EventsService } from "./events.service";

const now = new Date();
const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000);
const principal = { privyUserId: "did:privy:producer", sessionId: "session", accessToken: "jwt" };
const user: UserWithWallet = {
  id: "00000000-0000-4000-8000-000000000001",
  privyUserId: principal.privyUserId,
  email: "producer@example.com",
  spontaneousLoginAt: null,
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
const producerId = "00000000-0000-4000-8000-000000000003";
const eventId = "00000000-0000-4000-8000-000000000010";

function ticketType(overrides: Partial<TicketTypeRecord> = {}): TicketTypeRecord {
  return {
    id: "00000000-0000-4000-8000-000000000020",
    eventId,
    producerId,
    name: "Pista",
    description: null,
    priceCents: 8_000,
    quantity: 100,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function event(overrides: Partial<EventRecord> = {}): EventRecord {
  return {
    id: eventId,
    producerId,
    slug: "festival-access",
    name: "Festival Access",
    description: null,
    location: null,
    startsAt: future,
    capacity: 300,
    refundPolicy: null,
    status: "DRAFT",
    publishedAt: null,
    cancelledAt: null,
    createdAt: now,
    updatedAt: now,
    ticketTypes: [ticketType()],
    ...overrides,
  };
}

function producer(ready: boolean): ProducerProfileRecord {
  return {
    id: producerId,
    userId: user.id,
    displayName: "Festival Access",
    createdAt: now,
    updatedAt: now,
    blindPayCustomers: [
      {
        id: "00000000-0000-4000-8000-000000000004",
        producerId,
        externalCustomerId: "re_test",
        providerIdempotencyKey: "a".repeat(64),
        customerType: "INDIVIDUAL",
        creationStatus: "CREATED",
        kycStatus: ready ? "APPROVED" : "VERIFYING",
        isCurrent: true,
        externalBlockchainWalletId: ready ? "bw_test" : null,
        failureCode: null,
        createdAt: now,
        updatedAt: now,
      },
    ],
    stellarProvisioning: {
      id: "00000000-0000-4000-8000-000000000005",
      producerId,
      walletAccountId: user.wallet!.id,
      network: "testnet",
      status: "ACTIVE",
      transactionHash: "a".repeat(64),
      failureCode: null,
      activatedAt: now,
      createdAt: now,
      updatedAt: now,
    },
  };
}

function slugConflict(
  meta: Record<string, unknown> = { target: ["slug"] },
): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
    meta,
  });
}

describe("EventsService", () => {
  let users: jest.Mocked<Pick<UsersRepository, "findByPrivyUserId">>;
  let repository: jest.Mocked<
    Pick<EventsRepository, "create" | "list" | "find" | "withLockedEvent" | "findPublicBySlug">
  >;
  let scope: jest.Mocked<Omit<LockedEventScope, "event">> & { event: EventRecord };
  let service: EventsService;

  function lock(current: EventRecord, ready = true): void {
    scope = {
      event: current,
      loadProducer: jest.fn().mockResolvedValue(producer(ready)),
      updateEvent: jest.fn().mockResolvedValue(undefined),
      createTicketType: jest
        .fn()
        .mockImplementation((input) =>
          Promise.resolve(ticketType({ ...input, id: "00000000-0000-4000-8000-000000000021" })),
        ),
      updateTicketType: jest
        .fn()
        .mockImplementation((id: string, changes) =>
          Promise.resolve(ticketType({ id, ...changes })),
        ),
      deleteTicketType: jest.fn().mockResolvedValue(undefined),
      deleteDraftEvent: jest.fn().mockResolvedValue(undefined),
      lockCommittedQuantity: jest.fn().mockResolvedValue(0),
      recordCancellation: jest.fn().mockResolvedValue(undefined),
      reload: jest.fn().mockResolvedValue(current),
    };
    repository.withLockedEvent.mockImplementation((_userId, _eventId, operation) =>
      operation(scope as LockedEventScope),
    );
  }

  beforeEach(() => {
    users = { findByPrivyUserId: jest.fn().mockResolvedValue(user) };
    repository = {
      create: jest.fn().mockImplementation((_userId, input) => Promise.resolve(event(input))),
      list: jest.fn().mockResolvedValue([]),
      find: jest.fn().mockResolvedValue(event()),
      withLockedEvent: jest.fn(),
      findPublicBySlug: jest.fn(),
    };
    service = new EventsService(
      users as unknown as UsersRepository,
      repository as unknown as EventsRepository,
    );
    lock(event());
  });

  const validEvent = {
    name: "Festival Access",
    startsAt: future.toISOString(),
    capacity: 300,
  };

  describe("create", () => {
    it("creates a draft with a slug derived from the name", async () => {
      await expect(service.create(principal, validEvent)).resolves.toMatchObject({
        slug: "festival-access",
        status: "draft",
      });
      expect(repository.create).toHaveBeenCalledWith(
        user.id,
        expect.objectContaining({ slug: "festival-access", description: null }),
      );
    });

    it("retries with a suffixed slug when the unique index rejects the first one", async () => {
      repository.create.mockRejectedValueOnce(slugConflict());

      await service.create(principal, validEvent);

      expect(repository.create).toHaveBeenCalledTimes(2);
      expect(repository.create.mock.calls[1]![1].slug).toMatch(/^festival-access-[a-z0-9]{6}$/);
    });

    it("treats a target-less unique violation on events as a slug conflict, as RLS reports it", async () => {
      repository.create.mockRejectedValueOnce(slugConflict({ modelName: "Event", target: null }));

      await service.create(principal, validEvent);

      expect(repository.create).toHaveBeenCalledTimes(2);
    });

    it("does not retry unique violations from other models", async () => {
      repository.create.mockRejectedValue(slugConflict({ modelName: "TicketType", target: null }));

      await expect(service.create(principal, validEvent)).rejects.toMatchObject({ code: "P2002" });
      expect(repository.create).toHaveBeenCalledTimes(1);
    });

    it.each([
      [{ ...validEvent, producerId }, "unknown field"],
      [{ ...validEvent, capacity: 0 }, "zero capacity"],
      [{ ...validEvent, startsAt: "2026-12-12T20:00:00" }, "date without offset"],
      [{ ...validEvent, name: "   " }, "blank name"],
    ] as Array<[Record<string, unknown>, string]>)("rejects an invalid body (%#)", async (body) => {
      await expect(service.create(principal, body)).rejects.toMatchObject({
        response: { code: "invalid_event" },
      });
      expect(repository.create).not.toHaveBeenCalled();
    });

    it("rejects a start date in the past", async () => {
      await expect(
        service.create(principal, { ...validEvent, startsAt: "2020-01-01T00:00:00Z" }),
      ).rejects.toMatchObject({ response: { code: "event_starts_in_past" } });
    });

    it("reports a missing producer profile", async () => {
      repository.create.mockRejectedValue(new ProducerContextNotFoundError());

      await expect(service.create(principal, validEvent)).rejects.toMatchObject({
        response: { code: "producer_not_found" },
      });
    });
  });

  describe("publish", () => {
    it("publishes a valid draft of a ready producer", async () => {
      await service.publish(principal, eventId);

      expect(scope.updateEvent).toHaveBeenCalledWith({
        status: "PUBLISHED",
        publishedAt: expect.any(Date),
      });
    });

    it.each([
      ["producer_not_ready", event(), false],
      ["event_without_ticket_types", event({ ticketTypes: [] }), true],
      ["event_starts_in_past", event({ startsAt: new Date(Date.now() - 1_000) }), true],
      [
        "ticket_quantity_exceeds_capacity",
        event({
          capacity: 150,
          ticketTypes: [ticketType(), ticketType({ id: "x", quantity: 51 })],
        }),
        true,
      ],
    ] as const)("refuses to publish with %s", async (code, current, ready) => {
      lock(current, ready);

      await expect(service.publish(principal, eventId)).rejects.toMatchObject({
        response: { code },
      });
      expect(scope.updateEvent).not.toHaveBeenCalled();
    });

    it("is idempotent for a published event and terminal for a cancelled one", async () => {
      lock(event({ status: "PUBLISHED" }));
      await expect(service.publish(principal, eventId)).resolves.toMatchObject({
        status: "published",
      });
      expect(scope.updateEvent).not.toHaveBeenCalled();

      lock(event({ status: "CANCELLED" }));
      await expect(service.publish(principal, eventId)).rejects.toMatchObject({
        response: { code: "event_cancelled" },
      });
    });
  });

  describe("cancel", () => {
    it("cancels a published event and records the domain event in the same scope", async () => {
      lock(event({ status: "PUBLISHED" }));

      await service.cancel(principal, eventId);

      expect(scope.updateEvent).toHaveBeenCalledWith({
        status: "CANCELLED",
        cancelledAt: expect.any(Date),
      });
      expect(scope.recordCancellation).toHaveBeenCalledTimes(1);
    });

    it("does not record a second cancellation", async () => {
      lock(event({ status: "CANCELLED" }));

      await expect(service.cancel(principal, eventId)).resolves.toMatchObject({
        status: "cancelled",
      });
      expect(scope.recordCancellation).not.toHaveBeenCalled();
    });

    it("refuses to cancel a draft", async () => {
      await expect(service.cancel(principal, eventId)).rejects.toMatchObject({
        response: { code: "event_not_published" },
      });
    });
  });

  describe("update", () => {
    it("regenerates the slug when a draft is renamed", async () => {
      await service.update(principal, eventId, { name: "Novo Nome" });

      expect(scope.updateEvent).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Novo Nome", slug: "novo-nome" }),
      );
    });

    it("keeps the slug of a published event when it is renamed", async () => {
      lock(event({ status: "PUBLISHED" }));

      await service.update(principal, eventId, { name: "Novo Nome" });

      expect(scope.updateEvent).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Novo Nome", slug: undefined }),
      );
    });

    it("postpones a published event by editing its start date", async () => {
      lock(event({ status: "PUBLISHED" }));
      const postponed = new Date(future.getTime() + 7 * 24 * 60 * 60 * 1_000);

      await service.update(principal, eventId, { startsAt: postponed.toISOString() });

      expect(scope.updateEvent).toHaveBeenCalledWith(
        expect.objectContaining({ startsAt: postponed }),
      );
    });

    it("refuses a capacity below the ticket quantities of a published event", async () => {
      lock(event({ status: "PUBLISHED" }));

      await expect(service.update(principal, eventId, { capacity: 99 })).rejects.toMatchObject({
        response: { code: "ticket_quantity_exceeds_capacity" },
      });
    });

    it("lets a draft capacity drop below the quantities until publication", async () => {
      await service.update(principal, eventId, { capacity: 10 });

      expect(scope.updateEvent).toHaveBeenCalledWith(expect.objectContaining({ capacity: 10 }));
    });

    it("refuses any change to a cancelled event and an empty body", async () => {
      lock(event({ status: "CANCELLED" }));
      await expect(service.update(principal, eventId, { description: "x" })).rejects.toMatchObject({
        response: { code: "event_cancelled" },
      });

      await expect(service.update(principal, eventId, {})).rejects.toMatchObject({
        response: { code: "invalid_event" },
      });
    });
  });

  describe("delete", () => {
    it("deletes only drafts", async () => {
      await service.remove(principal, eventId);
      expect(scope.deleteDraftEvent).toHaveBeenCalledTimes(1);

      lock(event({ status: "PUBLISHED" }));
      await expect(service.remove(principal, eventId)).rejects.toMatchObject({
        response: { code: "event_not_draft" },
      });
    });
  });

  describe("ticket types", () => {
    it("refuses a new ticket type that would exceed the published capacity", async () => {
      lock(event({ status: "PUBLISHED", capacity: 150 }));

      await expect(
        service.createTicketType(principal, eventId, {
          name: "VIP",
          priceCents: 20_000,
          quantity: 51,
        }),
      ).rejects.toMatchObject({ response: { code: "ticket_quantity_exceeds_capacity" } });
      expect(scope.createTicketType).not.toHaveBeenCalled();
    });

    it("accepts a quantity change within the published capacity", async () => {
      lock(event({ status: "PUBLISHED", capacity: 150 }));

      await expect(
        service.updateTicketType(principal, eventId, ticketType().id, { quantity: 150 }),
      ).resolves.toMatchObject({ quantity: 150 });
    });

    it("refuses a quantity below the tickets already reserved or sold", async () => {
      scope.lockCommittedQuantity.mockResolvedValue(40);

      await expect(
        service.updateTicketType(principal, eventId, ticketType().id, { quantity: 39 }),
      ).rejects.toMatchObject({ response: { code: "ticket_quantity_below_committed" } });
      expect(scope.updateTicketType).not.toHaveBeenCalled();

      await expect(
        service.updateTicketType(principal, eventId, ticketType().id, { quantity: 40 }),
      ).resolves.toMatchObject({ quantity: 40 });
    });

    it("rejects zero price and an unknown ticket type", async () => {
      await expect(
        service.createTicketType(principal, eventId, { name: "Free", priceCents: 0, quantity: 1 }),
      ).rejects.toMatchObject({ response: { code: "invalid_ticket_type" } });

      await expect(
        service.updateTicketType(principal, eventId, "00000000-0000-4000-8000-000000000099", {
          priceCents: 9_000,
        }),
      ).rejects.toMatchObject({ response: { code: "ticket_type_not_found" } });
    });

    it("deletes ticket types only while the event is a draft", async () => {
      await service.removeTicketType(principal, eventId, ticketType().id);
      expect(scope.deleteTicketType).toHaveBeenCalledWith(ticketType().id);

      lock(event({ status: "PUBLISHED" }));
      await expect(
        service.removeTicketType(principal, eventId, ticketType().id),
      ).rejects.toMatchObject({ response: { code: "ticket_type_locked" } });
    });
  });

  describe("public read", () => {
    it("returns 404 for a malformed slug without touching the database", async () => {
      await expect(service.findPublic("../etc")).rejects.toMatchObject({
        response: { code: "event_not_found" },
      });
      expect(repository.findPublicBySlug).not.toHaveBeenCalled();
    });

    it("exposes the public view without capacity, quantities or producer ids", async () => {
      repository.findPublicBySlug.mockResolvedValue({
        ...event({ status: "PUBLISHED", refundPolicy: "Reembolso até 7 dias antes." }),
        producer: { displayName: "Festival Access" },
      });

      const view = await service.findPublic("festival-access");

      expect(view).toEqual({
        slug: "festival-access",
        name: "Festival Access",
        description: null,
        location: null,
        startsAt: future.toISOString(),
        status: "published",
        refundPolicy: "Reembolso até 7 dias antes.",
        producer: { displayName: "Festival Access" },
        ticketTypes: [{ id: ticketType().id, name: "Pista", description: null, priceCents: 8_000 }],
      });
    });
  });
});
