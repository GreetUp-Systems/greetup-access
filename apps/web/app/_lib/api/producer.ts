import { apiRequest } from "./client";

// Mirrors of the API views of the producer system (apps/api/src/producers and
// apps/api/src/events, SPEC-015 §8).

export type KycStatus =
  "verifying" | "approved" | "rejected" | "compliance_request" | "approved_rfi";
export type StellarStatus =
  "not_started" | "pending" | "signing" | "submitted" | "active" | "failed";

export interface ProducerProfile {
  id: string;
  displayName: string;
  onboardingStatus:
    "compliance_pending" | "stellar_pending" | "wallet_registration_pending" | "ready";
  compliance: { status: KycStatus | null; hasOpenRfi: boolean };
  stellar: { status: StellarStatus };
}

export type EventStatus = "draft" | "published" | "cancelled";

/** The fixed list of categories (SPEC-015 E2), in the API's lower case. */
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
export type EventCategory = (typeof eventCategories)[number];

/** A municipality of the IBGE base (SPEC-015 E3): `code` is the IBGE code. */
export interface City {
  code: number;
  name: string;
  uf: string;
}

/** The private view of an event, without its ticket types (apps/api EventSummaryView). */
export interface EventSummary {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: EventCategory | null;
  /** The cover on R2 (SPEC-015 E1); null without one. */
  coverUrl: string | null;
  venueName: string | null;
  city: City | null;
  address: string | null;
  startsAt: string;
  endsAt: string | null;
  capacity: number;
  refundPolicy: string | null;
  status: EventStatus;
  publishedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** An event of `GET /api/events`, with its sales (SPEC-015 §8). */
export interface ProducerEvent extends EventSummary {
  /** Tickets of purchases with the payment confirmed or issued. */
  soldTickets: number;
  /** Their subtotals, without the service fee paid by the buyer. */
  salesCents: number;
}

export type SalesPeriod = "7d" | "30d" | "90d";

export interface SalesTotals {
  tickets: number;
  salesCents: number;
}

export interface SalesSummary extends SalesTotals {
  period: SalesPeriod;
  previous: SalesTotals;
  daily: Array<SalesTotals & { date: string }>;
}

export interface RecentSale {
  eventName: string;
  ticketTypeName: string;
  quantity: number;
  subtotalCents: number;
  confirmedAt: string;
}

/** 404 `producer_not_found` when the account has no producer profile yet (SPEC-015 N5). */
export function getProducer(token: string): Promise<ProducerProfile> {
  return apiRequest<ProducerProfile>("/producers/me", { token });
}

export function listEvents(token: string): Promise<ProducerEvent[]> {
  return apiRequest<ProducerEvent[]>("/events", { token });
}

export function getSalesSummary(token: string, period: SalesPeriod): Promise<SalesSummary> {
  return apiRequest<SalesSummary>(`/producers/me/sales?period=${period}`, { token });
}

export function getRecentSales(token: string, limit: number): Promise<RecentSale[]> {
  return apiRequest<RecentSale[]>(`/producers/me/sales/recent?limit=${limit}`, { token });
}
