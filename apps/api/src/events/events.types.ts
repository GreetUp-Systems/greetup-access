export type EventStatusView = "draft" | "published" | "cancelled";

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
  venueName: string | null;
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

export interface EventView extends EventSummaryView {
  ticketTypes: TicketTypeView[];
}

export interface PublicEventView {
  slug: string;
  name: string;
  description: string | null;
  venueName: string | null;
  address: string | null;
  startsAt: string;
  endsAt: string | null;
  status: Exclude<EventStatusView, "draft">;
  refundPolicy: string | null;
  producer: { displayName: string };
  /** `available` is quantity minus committed stock, never negative; zero means sold out. */
  ticketTypes: Array<Omit<TicketTypeView, "quantity"> & { available: number }>;
}
