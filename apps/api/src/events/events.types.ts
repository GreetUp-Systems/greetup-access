import { type CityView } from "../cities/cities.types";

/** Minimum price of a ticket type in BRL cents, covering the Pix minimum with a margin (D-26). */
export interface TicketPricing {
  minPriceCents: number;
}

export const TICKET_PRICING = Symbol("TICKET_PRICING");

export type EventStatusView = "draft" | "published" | "cancelled";

/** Fixed category list (SPEC-015 E2), stored as the `EventCategory` enum. */
export const eventCategories = [
  "shows",
  "parties",
  "theater",
  "standup",
  "sports",
  "festivals",
  "kids",
  "courses",
  "food",
] as const;
export type EventCategoryView = (typeof eventCategories)[number];

/** What an event still lacks to be published, besides the SPEC-004 rules (SPEC-015 E1–E3). */
export type PublishRequirement = "cover" | "category" | "city";

export interface TicketTypeView {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  quantity: number;
}

export interface EventSummaryView {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: EventCategoryView | null;
  coverUrl: string | null;
  venueName: string | null;
  city: CityView | null;
  address: string | null;
  startsAt: string;
  endsAt: string | null;
  capacity: number;
  refundPolicy: string | null;
  status: EventStatusView;
  publishedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** An item of `GET /api/events`: sales are purchases with the payment confirmed (SPEC-015 §8). */
export interface EventListItemView extends EventSummaryView {
  soldTickets: number;
  /** Sum of the subtotals, without the service fee paid by the buyer. */
  salesCents: number;
}

export interface EventView extends EventSummaryView {
  ticketTypes: TicketTypeView[];
  /** `TICKET_MIN_PRICE_CENTS`, for the ticket type form (SPEC-015 §8). */
  ticketMinPriceCents: number;
}

export interface PublicEventView {
  slug: string;
  name: string;
  description: string | null;
  category: EventCategoryView | null;
  coverUrl: string | null;
  venueName: string | null;
  city: CityView | null;
  address: string | null;
  startsAt: string;
  endsAt: string | null;
  status: Exclude<EventStatusView, "draft">;
  refundPolicy: string | null;
  producer: { displayName: string };
  /** `available` is quantity minus committed stock, never negative; zero means sold out. */
  ticketTypes: Array<Omit<TicketTypeView, "quantity"> & { available: number }>;
}

/** A presigned PUT straight to R2; the upload must send the same Content-Type (D-30). */
export interface CoverUploadView {
  uploadUrl: string;
  key: string;
  expiresAt: string;
}
