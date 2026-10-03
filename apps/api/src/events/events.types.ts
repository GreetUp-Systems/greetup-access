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
  location: string | null;
  startsAt: string;
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
  location: string | null;
  startsAt: string;
  status: Exclude<EventStatusView, "draft">;
  refundPolicy: string | null;
  producer: { displayName: string };
  ticketTypes: Array<Omit<TicketTypeView, "quantity">>;
}
