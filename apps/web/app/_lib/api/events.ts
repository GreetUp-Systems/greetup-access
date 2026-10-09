import { ApiError, apiRequest } from "./client";

// Mirror of the public event view (apps/api/src/events/events.types.ts, PublicEventView).
export interface PublicTicketType {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  available: number;
}

export interface PublicEvent {
  slug: string;
  name: string;
  description: string | null;
  /** The cover on R2 (SPEC-015 15A); null without one. */
  coverUrl: string | null;
  venueName: string | null;
  address: string | null;
  startsAt: string;
  endsAt: string | null;
  status: "published" | "cancelled";
  refundPolicy: string | null;
  producer: { displayName: string };
  ticketTypes: PublicTicketType[];
}

/** The public event page data; null when the slug is unknown or the event is a draft. */
export async function getPublicEvent(slug: string): Promise<PublicEvent | null> {
  try {
    return await apiRequest<PublicEvent>(`/public/events/${encodeURIComponent(slug)}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}
