import { apiRequest } from "./client";
import type { City, EventCategory, EventSummary } from "./producer";

// Mirrors of the producer's event routes (apps/api/src/events: events.controller.ts and
// events.schemas.ts; apps/api/src/cities; SPEC-004 §8 and SPEC-015 §6 and §8). Prices are always
// in BRL cents; dates are ISO 8601 with the America/Sao_Paulo offset.

export interface TicketType {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  quantity: number;
}

/** `GET /api/events/:id`: the event with its ticket types and the minimum price (SPEC-015 §8). */
export interface EventDetail extends EventSummary {
  ticketTypes: TicketType[];
  /** `TICKET_MIN_PRICE_CENTS`, shown by the ticket type form. */
  ticketMinPriceCents: number;
}

/** The draft's three passos (SPEC-015 E4); the rest is added later. */
export interface CreateEventInput {
  name: string;
  category: EventCategory;
  startsAt: string;
  endsAt?: string;
  capacity: number;
}

/**
 * Only what changed. Category and city are replaced, never cleared; the texts and the end take
 * null to clear them (SPEC-004 §5, SPEC-015 §6).
 */
export interface UpdateEventInput {
  name?: string;
  category?: EventCategory;
  startsAt?: string;
  endsAt?: string | null;
  capacity?: number;
  venueName?: string | null;
  cityCode?: number;
  address?: string | null;
  description?: string | null;
  refundPolicy?: string | null;
}

export interface CreateTicketTypeInput {
  name: string;
  description?: string;
  priceCents: number;
  quantity: number;
}

export interface UpdateTicketTypeInput {
  name?: string;
  description?: string | null;
  priceCents?: number;
  quantity?: number;
}

export type CoverContentType = "image/jpeg" | "image/png" | "image/webp";

/** A presigned PUT straight to R2, valid for 10 minutes, with the Content-Type signed (D-30). */
export interface CoverUpload {
  uploadUrl: string;
  key: string;
  expiresAt: string;
}

const eventPath = (eventId: string) => `/events/${encodeURIComponent(eventId)}`;

/** "Criar rascunho": the draft, before the verification is approved (SPEC-004 §8). */
export function createEvent(token: string, input: CreateEventInput): Promise<EventDetail> {
  return apiRequest<EventDetail>("/events", { method: "POST", token, body: input });
}

/** 404 `event_not_found` for an event that is not the producer's. */
export function getEvent(token: string, eventId: string): Promise<EventDetail> {
  return apiRequest<EventDetail>(eventPath(eventId), { token });
}

/**
 * 422 `event_starts_in_past`, `event_ends_before_start` or `ticket_quantity_exceeds_capacity`; 400
 * `invalid_event` with the `fields`; 409 `event_cancelled`.
 */
export function updateEvent(
  token: string,
  eventId: string,
  changes: UpdateEventInput,
): Promise<EventDetail> {
  return apiRequest<EventDetail>(eventPath(eventId), { method: "PATCH", token, body: changes });
}

/**
 * 409 `producer_not_ready`; 422 `event_not_publishable` (with `missing`),
 * `event_without_ticket_types`, `event_starts_in_past`, `ticket_quantity_exceeds_capacity`.
 */
export function publishEvent(token: string, eventId: string): Promise<EventDetail> {
  return apiRequest<EventDetail>(`${eventPath(eventId)}/publish`, { method: "POST", token });
}

/** 422 `ticket_price_below_minimum` (with `minimumCents`) or `ticket_quantity_exceeds_capacity`. */
export function createTicketType(
  token: string,
  eventId: string,
  input: CreateTicketTypeInput,
): Promise<TicketType> {
  return apiRequest<TicketType>(`${eventPath(eventId)}/ticket-types`, {
    method: "POST",
    token,
    body: input,
  });
}

/** Also 409 `ticket_quantity_below_committed`: never below what was sold or reserved. */
export function updateTicketType(
  token: string,
  eventId: string,
  ticketTypeId: string,
  changes: UpdateTicketTypeInput,
): Promise<TicketType> {
  return apiRequest<TicketType>(
    `${eventPath(eventId)}/ticket-types/${encodeURIComponent(ticketTypeId)}`,
    { method: "PATCH", token, body: changes },
  );
}

/** The URL to send the cover to; 503 `cover_storage_unavailable` without R2 configured. */
export function requestCoverUpload(
  token: string,
  eventId: string,
  contentType: CoverContentType,
): Promise<CoverUpload> {
  return apiRequest<CoverUpload>(`${eventPath(eventId)}/cover/upload-url`, {
    method: "POST",
    token,
    body: { contentType },
  });
}

/** Confirms the object sent to R2 as the cover; 422 `invalid_cover` when R2 refuses it. */
export function confirmCover(token: string, eventId: string, key: string): Promise<EventDetail> {
  return apiRequest<EventDetail>(`${eventPath(eventId)}/cover`, {
    method: "PUT",
    token,
    body: { key },
  });
}

/** Up to 10 cities by the start of the name or of a word, without accents; 2 letters at least. */
export function searchCities(token: string, query: string, signal?: AbortSignal): Promise<City[]> {
  return apiRequest<City[]>(`/cities?query=${encodeURIComponent(query)}`, {
    token,
    ...(signal === undefined ? {} : { signal }),
  });
}

/** The upload to R2 did not go: refused, expired or cut off. */
export class CoverUploadError extends Error {
  constructor(readonly status: number) {
    super(`The cover upload failed with ${status}.`);
    this.name = "CoverUploadError";
  }
}

/**
 * Sends the image straight to R2 with the presigned PUT, reporting the progress from 0 to 100
 * (fetch has no upload progress). The Content-Type is the one the URL was signed for.
 */
export function uploadCover(
  uploadUrl: string,
  file: Blob,
  contentType: CoverContentType,
  onProgress: (percent: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", uploadUrl);
    request.setRequestHeader("Content-Type", contentType);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
      }
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(100);
        resolve();
      } else {
        reject(new CoverUploadError(request.status));
      }
    };
    request.onerror = () => reject(new CoverUploadError(0));
    request.onabort = () => reject(new DOMException("The upload was aborted.", "AbortError"));
    signal?.addEventListener("abort", () => request.abort(), { once: true });
    request.send(file);
  });
}
