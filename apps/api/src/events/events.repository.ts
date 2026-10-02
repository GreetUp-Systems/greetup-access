import { Prisma, PrismaService, TenantContextService } from "@access/database";
import { Injectable } from "@nestjs/common";

import { type ProducerProfileRecord, producerContext } from "../producers/producers.repository";

const eventInclude = {
  ticketTypes: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.EventInclude;

const publicEventInclude = {
  ticketTypes: { orderBy: { createdAt: "asc" } },
  producer: { select: { displayName: true } },
} satisfies Prisma.EventInclude;

export type EventRecord = Prisma.EventGetPayload<{ include: typeof eventInclude }>;
export type EventSummaryRecord = Prisma.EventGetPayload<Record<string, never>>;
export type TicketTypeRecord = EventRecord["ticketTypes"][number];
export type PublicEventRecord = Prisma.EventGetPayload<{ include: typeof publicEventInclude }>;
export type StoredEventStatus = EventRecord["status"];

export interface NewEvent {
  slug: string;
  name: string;
  description: string | null;
  location: string | null;
  startsAt: Date;
  capacity: number;
  refundPolicy: string | null;
}

// Undefined fields mean "leave unchanged" and are dropped before reaching Prisma.
export interface EventChanges {
  slug?: string | undefined;
  name?: string | undefined;
  description?: string | null | undefined;
  location?: string | null | undefined;
  startsAt?: Date | undefined;
  capacity?: number | undefined;
  refundPolicy?: string | null | undefined;
  status?: "PUBLISHED" | "CANCELLED" | undefined;
  publishedAt?: Date | undefined;
  cancelledAt?: Date | undefined;
}

export interface NewTicketType {
  name: string;
  description: string | null;
  priceCents: number;
  quantity: number;
}

export interface TicketTypeChanges {
  name?: string | undefined;
  description?: string | null | undefined;
  priceCents?: number | undefined;
  quantity?: number | undefined;
}

type Defined<T> = { [K in keyof T]?: Exclude<T[K], undefined> };

function withoutUndefined<T extends object>(value: T): Defined<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Defined<T>;
}

export interface LockedEventScope {
  readonly event: EventRecord;
  loadProducer(): Promise<ProducerProfileRecord>;
  updateEvent(changes: EventChanges): Promise<void>;
  createTicketType(input: NewTicketType): Promise<TicketTypeRecord>;
  updateTicketType(ticketTypeId: string, changes: TicketTypeChanges): Promise<TicketTypeRecord>;
  deleteTicketType(ticketTypeId: string): Promise<void>;
  deleteDraftEvent(): Promise<void>;
  recordCancellation(): Promise<void>;
  reload(): Promise<EventRecord>;
}

export class EventNotFoundError extends Error {
  constructor() {
    super("event_not_found");
    this.name = "EventNotFoundError";
  }
}

@Injectable()
export class EventsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  create(userId: string, input: NewEvent): Promise<EventRecord> {
    return this.tenantContext.withProducerContext(userId, (transaction, producerId) =>
      transaction.event.create({
        data: { ...input, producerId },
        include: eventInclude,
      }),
    );
  }

  list(userId: string, status: StoredEventStatus | undefined): Promise<EventSummaryRecord[]> {
    return this.tenantContext.withProducerContext(userId, (transaction, producerId) =>
      transaction.event.findMany({
        where: { producerId, ...(status === undefined ? {} : { status }) },
        orderBy: { createdAt: "desc" },
      }),
    );
  }

  find(userId: string, eventId: string): Promise<EventRecord | null> {
    return this.tenantContext.withProducerContext(userId, (transaction, producerId) =>
      transaction.event.findFirst({
        where: { id: eventId, producerId },
        include: eventInclude,
      }),
    );
  }

  // Locks the event row for the whole transaction so publication, capacity checks and
  // cancellation cannot interleave (SPEC-004 §7).
  withLockedEvent<T>(
    userId: string,
    eventId: string,
    operation: (scope: LockedEventScope) => Promise<T>,
  ): Promise<T> {
    return this.tenantContext.withProducerContext(userId, async (transaction, producerId) => {
      const locked = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "events" WHERE "id" = ${eventId}::uuid FOR UPDATE
      `;
      if (locked.length === 0) {
        throw new EventNotFoundError();
      }

      const event = await transaction.event.findUniqueOrThrow({
        where: { id: eventId },
        include: eventInclude,
      });

      return operation(this.scopeFor(transaction, producerId, event));
    });
  }

  // Runs without user context: only the public-read policies apply (SPEC-004 §7).
  findPublicBySlug(slug: string): Promise<PublicEventRecord | null> {
    return this.prisma.event.findFirst({
      where: { slug, status: { in: ["PUBLISHED", "CANCELLED"] } },
      include: publicEventInclude,
    });
  }

  private scopeFor(
    transaction: Prisma.TransactionClient,
    producerId: string,
    event: EventRecord,
  ): LockedEventScope {
    const eventId = event.id;

    return {
      event,
      loadProducer: () =>
        transaction.producerProfile.findUniqueOrThrow({
          where: { id: producerId },
          include: producerContext,
        }),
      updateEvent: async (changes) => {
        await transaction.event.update({ where: { id: eventId }, data: withoutUndefined(changes) });
      },
      createTicketType: (input) =>
        transaction.ticketType.create({ data: { ...input, eventId, producerId } }),
      updateTicketType: (ticketTypeId, changes) =>
        transaction.ticketType.update({
          where: { id: ticketTypeId, eventId },
          data: withoutUndefined(changes),
        }),
      deleteTicketType: async (ticketTypeId) => {
        await transaction.ticketType.delete({ where: { id: ticketTypeId, eventId } });
      },
      deleteDraftEvent: async () => {
        await transaction.ticketType.deleteMany({ where: { eventId } });
        await transaction.event.delete({ where: { id: eventId } });
      },
      recordCancellation: async () => {
        await transaction.outboxEvent.createMany({
          data: [
            {
              deduplicationKey: `event:${eventId}:cancelled:v1`,
              aggregateType: "event",
              aggregateId: eventId,
              eventType: "event.cancelled",
              payload: { eventId, producerId },
            },
          ],
          skipDuplicates: true,
        });
      },
      reload: () =>
        transaction.event.findUniqueOrThrow({ where: { id: eventId }, include: eventInclude }),
    };
  }
}
