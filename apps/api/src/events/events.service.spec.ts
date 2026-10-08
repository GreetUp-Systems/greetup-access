import { Prisma, ProducerContextNotFoundError } from "@access/database";

import { CitiesRepository } from "../cities/cities.repository";
import { type CoverStorage, CoverStorageError } from "../common/storage/cover-storage.types";
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
const city = { ibgeCode: 3550308, name: "São Paulo", uf: "SP", searchName: "sao paulo" };
const coverKey = `events/${eventId}/00000000-0000-4000-8000-0000000000c1.jpg`;
const newKey = `events/${eventId}/00000000-0000-4000-8000-0000000000c2.png`;
const publicBaseUrl = "https://covers.example.com";

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
    category: "SHOWS",
    venueName: null,
    cityCode: city.ibgeCode,
    city,
    address: null,
    coverKey,
    endsAt: null,
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
      preparedEnvelopeXdr: null,
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
    Pick<
      EventsRepository,
      "create" | "list" | "find" | "withLockedEvent" | "findPublicBySlug" | "publicAvailability"
    >
  >;
  let scope: jest.Mocked<Omit<LockedEventScope, "event">> & { event: EventRecord };
  let cities: jest.Mocked<Pick<CitiesRepository, "exists">>;
  let storage: jest.Mocked<CoverStorage>;
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
      publicAvailability: jest.fn().mockResolvedValue(new Map()),
    };
    cities = { exists: jest.fn().mockResolvedValue(true) };
    storage = {
      presignUpload: jest.fn().mockResolvedValue("https://r2.example.com/signed"),
      head: jest.fn().mockResolvedValue({ contentType: "image/png", size: 1_024 }),
      delete: jest.fn().mockResolvedValue(undefined),
      publicUrl: jest.fn((key: string) => `${publicBaseUrl}/${key}`),
    };
    service = new EventsService(
      users as unknown as UsersRepository,
      repository as unknown as EventsRepository,
      cities as unknown as CitiesRepository,
      { minPriceCents: 6_000 },
      storage,
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

    it("stores the category and the IBGE city of the draft", async () => {
      const view = await service.create(principal, {
        ...validEvent,
        category: "standup",
        cityCode: city.ibgeCode,
      });

      expect(cities.exists).toHaveBeenCalledWith(city.ibgeCode);
      expect(repository.create).toHaveBeenCalledWith(
        user.id,
        expect.objectContaining({ category: "STANDUP", cityCode: city.ibgeCode }),
      );
      expect(view).toMatchObject({
        category: "standup",
        city: { code: 3550308, name: "São Paulo", uf: "SP" },
      });
    });

    it("refuses a city outside the IBGE base as a field error", async () => {
      cities.exists.mockResolvedValue(false);

      await expect(
        service.create(principal, { ...validEvent, cityCode: 1_234_567 }),
      ).rejects.toMatchObject({ response: { code: "invalid_event", fields: ["cityCode"] } });
      expect(repository.create).not.toHaveBeenCalled();
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
      [{ ...validEvent, category: "Shows" }, "category outside the list"],
      [{ ...validEvent, cityCode: 35_503 }, "city code without seven digits"],
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
      ["event_not_publishable", event({ category: null }), true],
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

    it("names every listing requirement the event still lacks", async () => {
      lock(event({ coverKey: null, category: null, cityCode: null, city: null }));
      await expect(service.publish(principal, eventId)).rejects.toMatchObject({
        response: { code: "event_not_publishable", missing: ["cover", "category", "city"] },
      });

      lock(event({ coverKey: null }));
      await expect(service.publish(principal, eventId)).rejects.toMatchObject({
        response: { code: "event_not_publishable", missing: ["cover"] },
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

  describe("end time", () => {
    const later = (hours: number) => new Date(future.getTime() + hours * 3_600_000).toISOString();

    it("accepts an end after the start and refuses one at or before it", async () => {
      await expect(
        service.create(principal, {
          name: "Festival",
          startsAt: future.toISOString(),
          endsAt: later(5),
          venueName: "Casa Access",
          address: "Rua Exemplo, 100 · São Paulo",
          capacity: 100,
        }),
      ).resolves.toMatchObject({ endsAt: later(5), venueName: "Casa Access" });

      await expect(
        service.create(principal, {
          name: "Festival",
          startsAt: future.toISOString(),
          endsAt: future.toISOString(),
          capacity: 100,
        }),
      ).rejects.toMatchObject({ response: { code: "event_ends_before_start" } });
    });

    it("checks the end against the stored start when only one of them changes", async () => {
      lock(event({ endsAt: new Date(later(2)) }));

      await expect(
        service.update(principal, eventId, { startsAt: later(3) }),
      ).rejects.toMatchObject({ response: { code: "event_ends_before_start" } });
      await expect(service.update(principal, eventId, { endsAt: null })).resolves.toBeDefined();
      expect(scope.updateEvent).toHaveBeenCalledWith(expect.objectContaining({ endsAt: null }));
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

    it("replaces the category and the city but never clears them", async () => {
      await service.update(principal, eventId, { category: "food", cityCode: 3_304_557 });

      expect(scope.updateEvent).toHaveBeenCalledWith(
        expect.objectContaining({ category: "FOOD", cityCode: 3_304_557 }),
      );

      for (const body of [{ category: null }, { cityCode: null }]) {
        await expect(service.update(principal, eventId, body)).rejects.toMatchObject({
          response: { code: "invalid_event", fields: [Object.keys(body)[0]] },
        });
      }
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

    it("refuses a price below the minimum on create and on edit, and accepts the minimum", async () => {
      await expect(
        service.createTicketType(principal, eventId, {
          name: "Meia",
          priceCents: 5_999,
          quantity: 1,
        }),
      ).rejects.toMatchObject({
        status: 422,
        response: { code: "ticket_price_below_minimum", minimumCents: 6_000 },
      });
      expect(scope.createTicketType).not.toHaveBeenCalled();

      await expect(
        service.updateTicketType(principal, eventId, ticketType().id, { priceCents: 5_999 }),
      ).rejects.toMatchObject({ response: { code: "ticket_price_below_minimum" } });
      expect(scope.updateTicketType).not.toHaveBeenCalled();

      await expect(
        service.createTicketType(principal, eventId, {
          name: "Meia",
          priceCents: 6_000,
          quantity: 1,
        }),
      ).resolves.toBeDefined();
      // Editing only the quantity of an older ticket type below the minimum is still allowed.
      await expect(
        service.updateTicketType(principal, eventId, ticketType().id, { quantity: 150 }),
      ).resolves.toBeDefined();
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

  describe("cover", () => {
    it("signs a ten-minute upload under a new key of the event", async () => {
      const before = Date.now();

      const upload = await service.createCoverUpload(principal, eventId, {
        contentType: "image/webp",
      });

      expect(upload.uploadUrl).toBe("https://r2.example.com/signed");
      expect(upload.key).toMatch(new RegExp(`^events/${eventId}/[0-9a-f-]{36}\\.webp$`));
      expect(storage.presignUpload).toHaveBeenCalledWith(upload.key, "image/webp", 600);
      const expiresAt = new Date(upload.expiresAt).getTime();
      expect(expiresAt).toBeGreaterThanOrEqual(before + 600_000);
      expect(expiresAt).toBeLessThanOrEqual(Date.now() + 600_000);
    });

    it("refuses an upload of another type, for a missing event or a cancelled one", async () => {
      await expect(
        service.createCoverUpload(principal, eventId, { contentType: "image/gif" }),
      ).rejects.toMatchObject({ response: { code: "invalid_cover_request" } });

      repository.find.mockResolvedValueOnce(null);
      await expect(
        service.createCoverUpload(principal, eventId, { contentType: "image/png" }),
      ).rejects.toMatchObject({ response: { code: "event_not_found" } });

      repository.find.mockResolvedValueOnce(event({ status: "CANCELLED" }));
      await expect(
        service.createCoverUpload(principal, eventId, { contentType: "image/png" }),
      ).rejects.toMatchObject({ response: { code: "event_cancelled" } });
      expect(storage.presignUpload).not.toHaveBeenCalled();
    });

    it("confirms an uploaded image and deletes the previous cover after saving", async () => {
      scope.reload.mockResolvedValue(event({ coverKey: newKey }));

      await expect(service.setCover(principal, eventId, { key: newKey })).resolves.toMatchObject({
        coverUrl: `${publicBaseUrl}/${newKey}`,
      });

      expect(storage.head).toHaveBeenCalledWith(newKey);
      expect(scope.updateEvent).toHaveBeenCalledWith({ coverKey: newKey });
      expect(storage.delete).toHaveBeenCalledWith(coverKey);
      expect(storage.delete.mock.invocationCallOrder[0]).toBeGreaterThan(
        scope.updateEvent.mock.invocationCallOrder[0]!,
      );
    });

    it("answers a repeated confirmation of the current cover without touching R2", async () => {
      await expect(service.setCover(principal, eventId, { key: coverKey })).resolves.toMatchObject({
        coverUrl: `${publicBaseUrl}/${coverKey}`,
      });

      expect(storage.head).not.toHaveBeenCalled();
      expect(storage.delete).not.toHaveBeenCalled();
      expect(repository.withLockedEvent).not.toHaveBeenCalled();
    });

    it.each([
      [
        "another event",
        `events/00000000-0000-4000-8000-000000000099/00000000-0000-4000-8000-0000000000c2.png`,
      ],
      [
        "a path outside the event",
        `events/${eventId}/../other/00000000-0000-4000-8000-0000000000c2.png`,
      ],
      ["an unsupported extension", `events/${eventId}/00000000-0000-4000-8000-0000000000c2.gif`],
    ])("refuses the key of %s without looking it up or deleting it", async (_case, key) => {
      await expect(service.setCover(principal, eventId, { key })).rejects.toMatchObject({
        response: { code: "invalid_cover" },
      });

      expect(storage.head).not.toHaveBeenCalled();
      expect(storage.delete).not.toHaveBeenCalled();
      expect(repository.withLockedEvent).not.toHaveBeenCalled();
    });

    it("refuses a key that was never uploaded", async () => {
      storage.head.mockResolvedValue(null);

      await expect(service.setCover(principal, eventId, { key: newKey })).rejects.toMatchObject({
        response: { code: "invalid_cover" },
      });
      expect(storage.delete).not.toHaveBeenCalled();
    });

    it.each([
      ["another type", { contentType: "image/jpeg", size: 1_024 }],
      ["no type", { contentType: null, size: 1_024 }],
      ["more than 5 MB", { contentType: "image/png", size: 5 * 1024 * 1024 + 1 }],
      ["no bytes", { contentType: "image/png", size: 0 }],
    ])("deletes and refuses an upload with %s", async (_case, stored) => {
      storage.head.mockResolvedValue(stored);

      await expect(service.setCover(principal, eventId, { key: newKey })).rejects.toMatchObject({
        response: { code: "invalid_cover" },
      });
      expect(storage.delete).toHaveBeenCalledWith(newKey);
      expect(repository.withLockedEvent).not.toHaveBeenCalled();
    });

    it("answers 503 when R2 cannot be read, and keeps the new cover when the old one stays", async () => {
      storage.head.mockRejectedValueOnce(new CoverStorageError("head"));
      await expect(service.setCover(principal, eventId, { key: newKey })).rejects.toMatchObject({
        response: { code: "cover_storage_unavailable" },
      });

      storage.delete.mockRejectedValueOnce(new CoverStorageError("delete"));
      scope.reload.mockResolvedValue(event({ coverKey: newKey }));
      await expect(service.setCover(principal, eventId, { key: newKey })).resolves.toMatchObject({
        coverUrl: `${publicBaseUrl}/${newKey}`,
      });
      expect(scope.updateEvent).toHaveBeenCalledWith({ coverKey: newKey });
    });

    it("refuses a cover for a cancelled event", async () => {
      repository.find.mockResolvedValueOnce(event({ status: "CANCELLED" }));

      await expect(service.setCover(principal, eventId, { key: newKey })).rejects.toMatchObject({
        response: { code: "event_cancelled" },
      });
      expect(storage.head).not.toHaveBeenCalled();
    });

    it("removes the cover of a draft, and keeps the one of a published event", async () => {
      await service.removeCover(principal, eventId);
      expect(scope.updateEvent).toHaveBeenCalledWith({ coverKey: null });
      expect(storage.delete).toHaveBeenCalledWith(coverKey);

      lock(event({ status: "PUBLISHED" }));
      storage.delete.mockClear();
      await expect(service.removeCover(principal, eventId)).rejects.toMatchObject({
        response: { code: "event_cover_required" },
      });
      expect(scope.updateEvent).not.toHaveBeenCalled();
      expect(storage.delete).not.toHaveBeenCalled();
    });

    it("treats removing a missing cover as done", async () => {
      lock(event({ coverKey: null }));

      await service.removeCover(principal, eventId);

      expect(scope.updateEvent).not.toHaveBeenCalled();
      expect(storage.delete).not.toHaveBeenCalled();
    });

    it("answers 503 to every cover route and shows no cover URL when storage is off", async () => {
      const withoutStorage = new EventsService(
        users as unknown as UsersRepository,
        repository as unknown as EventsRepository,
        cities as unknown as CitiesRepository,
        { minPriceCents: 6_000 },
        null,
      );

      for (const call of [
        () => withoutStorage.createCoverUpload(principal, eventId, { contentType: "image/png" }),
        () => withoutStorage.setCover(principal, eventId, { key: newKey }),
        () => withoutStorage.removeCover(principal, eventId),
      ]) {
        await expect(call()).rejects.toMatchObject({
          response: { code: "cover_storage_unavailable" },
        });
      }
      await expect(withoutStorage.get(principal, eventId)).resolves.toMatchObject({
        coverUrl: null,
      });
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
      repository.publicAvailability.mockResolvedValue(new Map([[ticketType().id, 120]]));

      const view = await service.findPublic("festival-access");

      expect(view).toEqual({
        slug: "festival-access",
        name: "Festival Access",
        description: null,
        category: "shows",
        coverUrl: `${publicBaseUrl}/${coverKey}`,
        venueName: null,
        city: { code: 3550308, name: "São Paulo", uf: "SP" },
        address: null,
        endsAt: null,
        startsAt: future.toISOString(),
        status: "published",
        refundPolicy: "Reembolso até 7 dias antes.",
        producer: { displayName: "Festival Access" },
        ticketTypes: [
          {
            id: ticketType().id,
            name: "Pista",
            description: null,
            priceCents: 8_000,
            available: 120,
          },
        ],
      });
    });
  });
});
