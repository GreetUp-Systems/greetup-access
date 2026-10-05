import { Prisma, ProducerContextNotFoundError } from "@access/database";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { type ZodType } from "zod";

import { type AuthenticatedPrincipal } from "../auth/auth.types";
import { deriveOnboardingStatus } from "../producers/producer-onboarding-status";
import { UsersRepository } from "../users/users.repository";
import { publicSlugPattern, slugCandidates, slugify } from "./event-slug";
import {
  type EventRecord,
  type EventSummaryRecord,
  EventNotFoundError,
  EventsRepository,
  type LockedEventScope,
  type PublicEventRecord,
  type TicketTypeRecord,
} from "./events.repository";
import {
  createEventSchema,
  createTicketTypeSchema,
  listEventsQuerySchema,
  updateEventSchema,
  updateTicketTypeSchema,
} from "./events.schemas";
import {
  type EventSummaryView,
  type EventView,
  type PublicEventView,
  TICKET_PRICING,
  type TicketPricing,
  type TicketTypeView,
} from "./events.types";

const slugAttempts = 5;

@Injectable()
export class EventsService {
  constructor(
    private readonly users: UsersRepository,
    private readonly events: EventsRepository,
    @Inject(TICKET_PRICING) private readonly pricing: TicketPricing,
  ) {}

  async create(principal: AuthenticatedPrincipal, body: unknown): Promise<EventView> {
    const input = this.parse(createEventSchema, body, "invalid_event");
    const startsAt = this.futureDate(input.startsAt);
    const endsAt = input.endsAt === undefined ? null : new Date(input.endsAt);
    this.assertEndsAfterStart(startsAt, endsAt);
    const userId = await this.requireUserId(principal);

    const event = await this.withSlug(input.name, (slug) =>
      this.events.create(userId, {
        slug: slug ?? slugify(input.name),
        name: input.name,
        description: input.description ?? null,
        venueName: input.venueName ?? null,
        address: input.address ?? null,
        startsAt,
        endsAt,
        capacity: input.capacity,
        refundPolicy: input.refundPolicy ?? null,
      }),
    );
    return this.toEventView(event);
  }

  async list(principal: AuthenticatedPrincipal, query: unknown): Promise<EventSummaryView[]> {
    const { status } = this.parse(listEventsQuerySchema, query, "invalid_event_query");
    const userId = await this.requireUserId(principal);
    const events = await this.mapErrors(() =>
      this.events.list(userId, status === undefined ? undefined : this.toStoredStatus(status)),
    );
    return events.map((event) => this.toSummaryView(event));
  }

  async get(principal: AuthenticatedPrincipal, eventId: string): Promise<EventView> {
    const userId = await this.requireUserId(principal);
    const event = await this.mapErrors(() => this.events.find(userId, eventId));
    if (event === null) {
      throw this.eventNotFound();
    }
    return this.toEventView(event);
  }

  async update(
    principal: AuthenticatedPrincipal,
    eventId: string,
    body: unknown,
  ): Promise<EventView> {
    const input = this.parse(updateEventSchema, body, "invalid_event");
    const startsAt = input.startsAt === undefined ? undefined : this.futureDate(input.startsAt);
    const userId = await this.requireUserId(principal);

    const event = await this.withSlug(input.name, (slug) =>
      this.events.withLockedEvent(userId, eventId, async (scope) => {
        this.assertNotCancelled(scope.event);
        const endsAt =
          input.endsAt === undefined
            ? undefined
            : input.endsAt === null
              ? null
              : new Date(input.endsAt);
        this.assertEndsAfterStart(
          startsAt ?? scope.event.startsAt,
          endsAt === undefined ? scope.event.endsAt : endsAt,
        );
        const capacity = input.capacity ?? scope.event.capacity;
        if (scope.event.status === "PUBLISHED") {
          this.assertWithinCapacity(this.totalQuantity(scope.event), capacity);
        }

        const renamesDraft =
          scope.event.status === "DRAFT" &&
          input.name !== undefined &&
          slugify(input.name) !== slugify(scope.event.name);

        await scope.updateEvent({
          name: input.name,
          slug: renamesDraft ? slug : undefined,
          description: input.description,
          venueName: input.venueName,
          address: input.address,
          startsAt,
          endsAt,
          capacity: input.capacity,
          refundPolicy: input.refundPolicy,
        });
        return scope.reload();
      }),
    );
    return this.toEventView(event);
  }

  async remove(principal: AuthenticatedPrincipal, eventId: string): Promise<void> {
    const userId = await this.requireUserId(principal);
    await this.locked(userId, eventId, async (scope) => {
      if (scope.event.status !== "DRAFT") {
        throw new ConflictException({
          code: "event_not_draft",
          message: "Only draft events can be deleted.",
        });
      }
      await scope.deleteDraftEvent();
    });
  }

  async publish(principal: AuthenticatedPrincipal, eventId: string): Promise<EventView> {
    const userId = await this.requireUserId(principal);
    const event = await this.locked(userId, eventId, async (scope) => {
      if (scope.event.status === "PUBLISHED") {
        return scope.event;
      }
      this.assertNotCancelled(scope.event);

      if (deriveOnboardingStatus(await scope.loadProducer()) !== "ready") {
        throw new ConflictException({
          code: "producer_not_ready",
          message: "The producer must finish onboarding before publishing.",
        });
      }
      if (scope.event.ticketTypes.length === 0) {
        throw new UnprocessableEntityException({
          code: "event_without_ticket_types",
          message: "An event needs at least one ticket type to be published.",
        });
      }
      if (scope.event.startsAt.getTime() <= Date.now()) {
        throw this.startsInPast();
      }
      this.assertWithinCapacity(this.totalQuantity(scope.event), scope.event.capacity);

      await scope.updateEvent({ status: "PUBLISHED", publishedAt: new Date() });
      return scope.reload();
    });
    return this.toEventView(event);
  }

  async cancel(principal: AuthenticatedPrincipal, eventId: string): Promise<EventView> {
    const userId = await this.requireUserId(principal);
    const event = await this.locked(userId, eventId, async (scope) => {
      if (scope.event.status === "CANCELLED") {
        return scope.event;
      }
      if (scope.event.status === "DRAFT") {
        throw new ConflictException({
          code: "event_not_published",
          message: "Draft events are deleted, not cancelled.",
        });
      }

      await scope.updateEvent({ status: "CANCELLED", cancelledAt: new Date() });
      await scope.recordCancellation();
      return scope.reload();
    });
    return this.toEventView(event);
  }

  async createTicketType(
    principal: AuthenticatedPrincipal,
    eventId: string,
    body: unknown,
  ): Promise<TicketTypeView> {
    const input = this.parse(createTicketTypeSchema, body, "invalid_ticket_type");
    const userId = await this.requireUserId(principal);
    const ticketType = await this.locked(userId, eventId, async (scope) => {
      // Inside the lookup, so another producer's event answers 404 before any price rule.
      this.assertPriceAtLeastMinimum(input.priceCents);
      this.assertNotCancelled(scope.event);
      if (scope.event.status === "PUBLISHED") {
        this.assertWithinCapacity(
          this.totalQuantity(scope.event) + input.quantity,
          scope.event.capacity,
        );
      }
      return scope.createTicketType({
        name: input.name,
        description: input.description ?? null,
        priceCents: input.priceCents,
        quantity: input.quantity,
      });
    });
    return this.toTicketTypeView(ticketType);
  }

  async updateTicketType(
    principal: AuthenticatedPrincipal,
    eventId: string,
    ticketTypeId: string,
    body: unknown,
  ): Promise<TicketTypeView> {
    const input = this.parse(updateTicketTypeSchema, body, "invalid_ticket_type");
    const userId = await this.requireUserId(principal);
    const ticketType = await this.locked(userId, eventId, async (scope) => {
      this.assertNotCancelled(scope.event);
      const current = this.requireTicketType(scope, ticketTypeId);
      if (input.priceCents !== undefined) {
        this.assertPriceAtLeastMinimum(input.priceCents);
      }
      if (input.quantity !== undefined) {
        // Reserved and sold tickets are the floor (SPEC-005 §8); the row lock keeps checkout out.
        if (input.quantity < (await scope.lockCommittedQuantity(ticketTypeId))) {
          throw new ConflictException({
            code: "ticket_quantity_below_committed",
            message: "The quantity cannot go below the tickets already reserved or sold.",
          });
        }
        if (scope.event.status === "PUBLISHED") {
          this.assertWithinCapacity(
            this.totalQuantity(scope.event) - current.quantity + input.quantity,
            scope.event.capacity,
          );
        }
      }
      return scope.updateTicketType(ticketTypeId, input);
    });
    return this.toTicketTypeView(ticketType);
  }

  async removeTicketType(
    principal: AuthenticatedPrincipal,
    eventId: string,
    ticketTypeId: string,
  ): Promise<void> {
    const userId = await this.requireUserId(principal);
    await this.locked(userId, eventId, async (scope) => {
      this.requireTicketType(scope, ticketTypeId);
      if (scope.event.status !== "DRAFT") {
        throw new ConflictException({
          code: "ticket_type_locked",
          message: "Ticket types can only be deleted while the event is a draft.",
        });
      }
      await scope.deleteTicketType(ticketTypeId);
    });
  }

  async findPublic(slug: string): Promise<PublicEventView> {
    if (slug.length > 100 || !publicSlugPattern.test(slug)) {
      throw this.eventNotFound();
    }
    const event = await this.events.findPublicBySlug(slug);
    if (event === null || event.status === "DRAFT") {
      throw this.eventNotFound();
    }
    return this.toPublicView(event, await this.events.publicAvailability(event.id));
  }

  private async requireUserId(principal: AuthenticatedPrincipal): Promise<string> {
    const user = await this.users.findByPrivyUserId(principal.privyUserId);
    if (user === null || user.wallet === null) {
      throw new NotFoundException({
        code: "account_not_bootstrapped",
        message: "The authenticated account has not been bootstrapped.",
      });
    }
    return user.id;
  }

  private locked<T>(
    userId: string,
    eventId: string,
    operation: (scope: LockedEventScope) => Promise<T>,
  ): Promise<T> {
    return this.mapErrors(() => this.events.withLockedEvent(userId, eventId, operation));
  }

  // Retries with a new slug candidate when the unique index rejects the previous one. Without a
  // name there is no slug to generate, so the operation runs once.
  private async withSlug<T>(
    name: string | undefined,
    operation: (slug: string | undefined) => Promise<T>,
  ): Promise<T> {
    const candidates = name === undefined ? [undefined] : slugCandidates(name, slugAttempts);

    for (const candidate of candidates) {
      try {
        return await this.mapErrors(() => operation(candidate));
      } catch (error) {
        if (!this.isSlugConflict(error)) {
          throw error;
        }
      }
    }

    throw new ServiceUnavailableException({
      code: "event_slug_unavailable",
      message: "A unique event slug could not be generated. Try again.",
    });
  }

  private async mapErrors<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof ProducerContextNotFoundError) {
        throw new NotFoundException({
          code: "producer_not_found",
          message: "The authenticated account does not have a producer profile.",
        });
      }
      if (error instanceof EventNotFoundError) {
        throw this.eventNotFound();
      }
      throw error;
    }
  }

  private isSlugConflict(error: unknown): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
      return false;
    }
    const target = error.meta?.target;
    // Under RLS Postgres withholds the violated key, so Prisma reports no target. On `events`
    // the only unique key an application write can hit is the slug (ids are generated UUIDs).
    if (target === null || target === undefined) {
      return error.meta?.modelName === "Event";
    }
    return JSON.stringify(target).includes("slug");
  }

  private parse<T>(schema: ZodType<T>, body: unknown, code: string): T {
    const result = schema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException({
        code,
        message: "The request body is invalid.",
        fields: [...new Set(result.error.issues.map((issue) => issue.path.join(".")))],
      });
    }
    return result.data;
  }

  private assertEndsAfterStart(startsAt: Date, endsAt: Date | null): void {
    if (endsAt !== null && endsAt.getTime() <= startsAt.getTime()) {
      throw new UnprocessableEntityException({
        code: "event_ends_before_start",
        message: "The event must end after it starts.",
      });
    }
  }

  private futureDate(value: string): Date {
    const date = new Date(value);
    if (date.getTime() <= Date.now()) {
      throw this.startsInPast();
    }
    return date;
  }

  private assertNotCancelled(event: EventRecord): void {
    if (event.status === "CANCELLED") {
      throw new ConflictException({
        code: "event_cancelled",
        message: "Cancelled events cannot be changed.",
      });
    }
  }

  private assertWithinCapacity(totalQuantity: number, capacity: number): void {
    if (totalQuantity > capacity) {
      throw new UnprocessableEntityException({
        code: "ticket_quantity_exceeds_capacity",
        message: "The ticket quantities exceed the event capacity.",
      });
    }
  }

  private requireTicketType(scope: LockedEventScope, ticketTypeId: string): TicketTypeRecord {
    const ticketType = scope.event.ticketTypes.find((candidate) => candidate.id === ticketTypeId);
    if (ticketType === undefined) {
      throw new NotFoundException({
        code: "ticket_type_not_found",
        message: "The ticket type does not exist for this event.",
      });
    }
    return ticketType;
  }

  private totalQuantity(event: EventRecord): number {
    return event.ticketTypes.reduce((total, ticketType) => total + ticketType.quantity, 0);
  }

  // One ticket already clears the Pix minimum, with a margin for the exchange rate (D-26).
  private assertPriceAtLeastMinimum(priceCents: number): void {
    if (priceCents < this.pricing.minPriceCents) {
      throw new UnprocessableEntityException({
        code: "ticket_price_below_minimum",
        message: "The ticket price is below the minimum accepted by Pix.",
        minimumCents: this.pricing.minPriceCents,
      });
    }
  }

  private startsInPast(): UnprocessableEntityException {
    return new UnprocessableEntityException({
      code: "event_starts_in_past",
      message: "The event must start in the future.",
    });
  }

  private eventNotFound(): NotFoundException {
    return new NotFoundException({
      code: "event_not_found",
      message: "The event does not exist.",
    });
  }

  private toStoredStatus(status: "draft" | "published" | "cancelled"): EventRecord["status"] {
    return status.toUpperCase() as EventRecord["status"];
  }

  private toSummaryView(event: EventSummaryRecord): EventSummaryView {
    return {
      id: event.id,
      slug: event.slug,
      name: event.name,
      description: event.description,
      venueName: event.venueName,
      address: event.address,
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt?.toISOString() ?? null,
      capacity: event.capacity,
      refundPolicy: event.refundPolicy,
      status: event.status.toLowerCase() as EventSummaryView["status"],
      publishedAt: event.publishedAt?.toISOString() ?? null,
      cancelledAt: event.cancelledAt?.toISOString() ?? null,
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
    };
  }

  private toEventView(event: EventRecord): EventView {
    return {
      ...this.toSummaryView(event),
      ticketTypes: event.ticketTypes.map((ticketType) => this.toTicketTypeView(ticketType)),
    };
  }

  private toTicketTypeView(ticketType: TicketTypeRecord): TicketTypeView {
    return {
      id: ticketType.id,
      name: ticketType.name,
      description: ticketType.description,
      priceCents: ticketType.priceCents,
      quantity: ticketType.quantity,
    };
  }

  private toPublicView(
    event: PublicEventRecord,
    availability: Map<string, number>,
  ): PublicEventView {
    return {
      slug: event.slug,
      name: event.name,
      description: event.description,
      venueName: event.venueName,
      address: event.address,
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt?.toISOString() ?? null,
      status: event.status === "CANCELLED" ? "cancelled" : "published",
      refundPolicy: event.refundPolicy,
      producer: { displayName: event.producer.displayName },
      ticketTypes: event.ticketTypes.map((ticketType) => ({
        id: ticketType.id,
        name: ticketType.name,
        description: ticketType.description,
        priceCents: ticketType.priceCents,
        available: availability.get(ticketType.id) ?? 0,
      })),
    };
  }
}
