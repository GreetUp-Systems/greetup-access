import { Prisma, ProducerContextNotFoundError } from "@access/database";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { type ZodType } from "zod";

import { type AuthenticatedPrincipal } from "../auth/auth.types";
import { CitiesRepository } from "../cities/cities.repository";
import { type CityView } from "../cities/cities.types";
import {
  COVER_STORAGE,
  type CoverStorage,
  CoverStorageError,
} from "../common/storage/cover-storage.types";
import { deriveOnboardingStatus } from "../producers/producer-onboarding-status";
import { UsersRepository } from "../users/users.repository";
import {
  coverKeyContentType,
  coverUploadExpiresInSeconds,
  isAcceptedCover,
  newCoverKey,
} from "./event-cover";
import { publicSlugPattern, slugCandidates, slugify } from "./event-slug";
import {
  type EventRecord,
  type EventSummaryRecord,
  EventNotFoundError,
  EventsRepository,
  type LockedEventScope,
  type PublicEventRecord,
  type StoredEventCategory,
  type TicketTypeRecord,
} from "./events.repository";
import {
  coverUploadSchema,
  createEventSchema,
  createTicketTypeSchema,
  listEventsQuerySchema,
  setCoverSchema,
  updateEventSchema,
  updateTicketTypeSchema,
} from "./events.schemas";
import {
  type CoverUploadView,
  type EventCategoryView,
  type EventListItemView,
  type EventSummaryView,
  type EventView,
  type PublicEventView,
  type PublishRequirement,
  TICKET_PRICING,
  type TicketPricing,
  type TicketTypeView,
} from "./events.types";

const slugAttempts = 5;

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    private readonly users: UsersRepository,
    private readonly events: EventsRepository,
    private readonly cities: CitiesRepository,
    @Inject(TICKET_PRICING) private readonly pricing: TicketPricing,
    @Inject(COVER_STORAGE) private readonly coverStorage: CoverStorage | null,
  ) {}

  async create(principal: AuthenticatedPrincipal, body: unknown): Promise<EventView> {
    const input = this.parse(createEventSchema, body, "invalid_event");
    const startsAt = this.futureDate(input.startsAt);
    const endsAt = input.endsAt === undefined ? null : new Date(input.endsAt);
    this.assertEndsAfterStart(startsAt, endsAt);
    const userId = await this.requireUserId(principal);
    await this.assertKnownCity(input.cityCode);

    const event = await this.withSlug(input.name, (slug) =>
      this.events.create(userId, {
        slug: slug ?? slugify(input.name),
        name: input.name,
        description: input.description ?? null,
        category: input.category === undefined ? null : this.toStoredCategory(input.category),
        venueName: input.venueName ?? null,
        cityCode: input.cityCode ?? null,
        address: input.address ?? null,
        startsAt,
        endsAt,
        capacity: input.capacity,
        refundPolicy: input.refundPolicy ?? null,
      }),
    );
    return this.toEventView(event);
  }

  async list(principal: AuthenticatedPrincipal, query: unknown): Promise<EventListItemView[]> {
    const { status } = this.parse(listEventsQuerySchema, query, "invalid_event_query");
    const userId = await this.requireUserId(principal);
    const events = await this.mapErrors(() =>
      this.events.list(userId, status === undefined ? undefined : this.toStoredStatus(status)),
    );
    return events.map((event) => ({
      ...this.toSummaryView(event),
      soldTickets: event.soldTickets,
      salesCents: event.salesCents,
    }));
  }

  async get(principal: AuthenticatedPrincipal, eventId: string): Promise<EventView> {
    const userId = await this.requireUserId(principal);
    return this.toEventView(await this.requireEvent(userId, eventId));
  }

  async update(
    principal: AuthenticatedPrincipal,
    eventId: string,
    body: unknown,
  ): Promise<EventView> {
    const input = this.parse(updateEventSchema, body, "invalid_event");
    const startsAt = input.startsAt === undefined ? undefined : this.futureDate(input.startsAt);
    const userId = await this.requireUserId(principal);
    await this.assertKnownCity(input.cityCode);

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
          category:
            input.category === undefined ? undefined : this.toStoredCategory(input.category),
          venueName: input.venueName,
          cityCode: input.cityCode,
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
      const missing = this.missingRequirements(scope.event);
      if (missing.length > 0) {
        throw new UnprocessableEntityException({
          code: "event_not_publishable",
          message: "The event needs a cover, a category and a city to be published.",
          missing,
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

  async createCoverUpload(
    principal: AuthenticatedPrincipal,
    eventId: string,
    body: unknown,
  ): Promise<CoverUploadView> {
    const storage = this.requireCoverStorage();
    const { contentType } = this.parse(coverUploadSchema, body, "invalid_cover_request");
    const userId = await this.requireUserId(principal);
    const event = await this.requireEvent(userId, eventId);
    this.assertNotCancelled(event);

    const key = newCoverKey(event.id, contentType);
    const expiresAt = new Date(Date.now() + coverUploadExpiresInSeconds * 1_000);
    const uploadUrl = await storage.presignUpload(key, contentType, coverUploadExpiresInSeconds);
    return { uploadUrl, key, expiresAt: expiresAt.toISOString() };
  }

  async setCover(
    principal: AuthenticatedPrincipal,
    eventId: string,
    body: unknown,
  ): Promise<EventView> {
    const storage = this.requireCoverStorage();
    const { key } = this.parse(setCoverSchema, body, "invalid_cover_request");
    const userId = await this.requireUserId(principal);
    const current = await this.requireEvent(userId, eventId);
    this.assertNotCancelled(current);
    if (current.coverKey === key) {
      return this.toEventView(current);
    }

    // Only a key issued for this event is looked up or deleted; any other key is refused as is.
    const contentType = coverKeyContentType(current.id, key);
    if (contentType === null) {
      throw this.invalidCover();
    }
    // Checked before the row lock, so the lock never waits on R2.
    const stored = await this.storageCall(() => storage.head(key));
    if (stored === null) {
      throw this.invalidCover();
    }
    if (!isAcceptedCover(contentType, stored)) {
      await this.discardCover(storage, current.id, key);
      throw this.invalidCover();
    }

    const { event, previousKey } = await this.locked(userId, eventId, async (scope) => {
      this.assertNotCancelled(scope.event);
      const previousKey = scope.event.coverKey;
      if (previousKey !== key) {
        await scope.updateEvent({ coverKey: key });
      }
      return { event: await scope.reload(), previousKey };
    });
    if (previousKey !== null && previousKey !== key) {
      await this.discardCover(storage, event.id, previousKey);
    }
    return this.toEventView(event);
  }

  async removeCover(principal: AuthenticatedPrincipal, eventId: string): Promise<void> {
    const storage = this.requireCoverStorage();
    const userId = await this.requireUserId(principal);
    const previousKey = await this.locked(userId, eventId, async (scope) => {
      this.assertNotCancelled(scope.event);
      if (scope.event.coverKey === null) {
        return null;
      }
      if (scope.event.status === "PUBLISHED") {
        throw new ConflictException({
          code: "event_cover_required",
          message: "A published event keeps its cover; replace it instead.",
        });
      }
      await scope.updateEvent({ coverKey: null });
      return scope.event.coverKey;
    });
    if (previousKey !== null) {
      await this.discardCover(storage, eventId, previousKey);
    }
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

  private async requireEvent(userId: string, eventId: string): Promise<EventRecord> {
    const event = await this.mapErrors(() => this.events.find(userId, eventId));
    if (event === null) {
      throw this.eventNotFound();
    }
    return event;
  }

  // The list of cities never shrinks, so checking before the write leaves no race.
  private async assertKnownCity(cityCode: number | undefined): Promise<void> {
    if (cityCode !== undefined && !(await this.cities.exists(cityCode))) {
      throw new BadRequestException({
        code: "invalid_event",
        message: "The request body is invalid.",
        fields: ["cityCode"],
      });
    }
  }

  private missingRequirements(event: EventRecord): PublishRequirement[] {
    const missing: PublishRequirement[] = [];
    if (event.coverKey === null) {
      missing.push("cover");
    }
    if (event.category === null) {
      missing.push("category");
    }
    if (event.cityCode === null) {
      missing.push("city");
    }
    return missing;
  }

  private requireCoverStorage(): CoverStorage {
    if (this.coverStorage === null) {
      throw this.coverStorageUnavailable();
    }
    return this.coverStorage;
  }

  private async storageCall<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof CoverStorageError) {
        this.logger.warn(`Cover storage ${error.operation} failed.`);
        throw this.coverStorageUnavailable();
      }
      throw error;
    }
  }

  // Nothing points at the object any more; a failed delete leaves an orphan in the bucket, which
  // is accepted like an abandoned upload (SPEC-015 §8).
  private async discardCover(storage: CoverStorage, eventId: string, key: string): Promise<void> {
    try {
      await storage.delete(key);
    } catch (error) {
      if (!(error instanceof CoverStorageError)) {
        throw error;
      }
      this.logger.warn(`Cover object of event ${eventId} could not be deleted.`);
    }
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

  private invalidCover(): UnprocessableEntityException {
    return new UnprocessableEntityException({
      code: "invalid_cover",
      message: "The cover must be a JPG, PNG or WebP image up to 5 MB uploaded for this event.",
    });
  }

  private coverStorageUnavailable(): ServiceUnavailableException {
    return new ServiceUnavailableException({
      code: "cover_storage_unavailable",
      message: "Cover storage is temporarily unavailable.",
    });
  }

  private toStoredStatus(status: "draft" | "published" | "cancelled"): EventRecord["status"] {
    return status.toUpperCase() as EventRecord["status"];
  }

  private toStoredCategory(category: EventCategoryView): StoredEventCategory {
    return category.toUpperCase() as StoredEventCategory;
  }

  private toCategoryView(category: StoredEventCategory | null): EventCategoryView | null {
    return category === null ? null : (category.toLowerCase() as EventCategoryView);
  }

  private toCityView(city: EventSummaryRecord["city"]): CityView | null {
    return city === null ? null : { code: city.ibgeCode, name: city.name, uf: city.uf };
  }

  // Without storage configured there is no public origin to serve the key from.
  private coverUrl(coverKey: string | null): string | null {
    return coverKey === null || this.coverStorage === null
      ? null
      : this.coverStorage.publicUrl(coverKey);
  }

  private toSummaryView(event: EventSummaryRecord): EventSummaryView {
    return {
      id: event.id,
      slug: event.slug,
      name: event.name,
      description: event.description,
      category: this.toCategoryView(event.category),
      coverUrl: this.coverUrl(event.coverKey),
      venueName: event.venueName,
      city: this.toCityView(event.city),
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
      ticketMinPriceCents: this.pricing.minPriceCents,
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
      category: this.toCategoryView(event.category),
      coverUrl: this.coverUrl(event.coverKey),
      venueName: event.venueName,
      city: this.toCityView(event.city),
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
