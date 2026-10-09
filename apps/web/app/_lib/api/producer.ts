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

export interface ProducerEvent {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string | null;
  coverUrl: string | null;
  venueName: string | null;
  city: { code: number; name: string; uf: string } | null;
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

export interface OpenRfi {
  id: string;
  status: "pending" | "submitted" | "expired" | "cancelled";
  expiresAt: string;
  createdAt: string;
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

/** The open request for information of the current BlindPay customer, or null. */
export function getOpenRfi(token: string): Promise<OpenRfi | null> {
  return apiRequest<OpenRfi | null>("/producers/onboarding/rfi", { token });
}
