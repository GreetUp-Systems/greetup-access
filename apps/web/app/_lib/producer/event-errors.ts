import { ApiError } from "../api/client";
import { eventMessages } from "./event-form";
import { scheduleMessages } from "./event-schedule";
import { ticketTypeMessages, type TicketTypeField } from "./ticket-types";

// The API's errors of the event as the screen's states (SPEC-015 §6, "Erros da API → tela"): the
// field's error, the event or the producer read again, the cover's Erro no arquivo, or the error
// toast with "Tentar de novo" for the network, 5xx and 503 cover_storage_unavailable.

const isApiError = (error: unknown, status: number, code?: string): error is ApiError =>
  error instanceof ApiError &&
  error.status === status &&
  (code === undefined || error.code === code);

/** The fields of the event forms an error can point at. */
export type EventFormField =
  | "name"
  | "category"
  | "startDate"
  | "endDate"
  | "capacity"
  | "venueName"
  | "city"
  | "address"
  | "description"
  | "refundPolicy";

export type EventSaveProblem =
  { kind: "field"; field: EventFormField; message: string } | { kind: "gone" } | { kind: "failed" };

/** The API's field names of `400 invalid_event`, as the screen's fields and their messages. */
const invalidEventFields: Record<string, { field: EventFormField; message: string }> = {
  name: { field: "name", message: eventMessages.name },
  category: { field: "category", message: eventMessages.category },
  startsAt: { field: "startDate", message: scheduleMessages.date },
  endsAt: { field: "endDate", message: scheduleMessages.date },
  capacity: { field: "capacity", message: eventMessages.capacity },
};

function fieldsOf(error: ApiError): string[] {
  const body = error.body;
  const fields =
    typeof body === "object" && body !== null && "fields" in body ? body.fields : undefined;
  return Array.isArray(fields) ? fields.filter((field) => typeof field === "string") : [];
}

/**
 * `POST /events` and `PATCH /events/:id`. `seats` is the seats of the types, said when a published
 * event's capacity goes below them (422 ticket_quantity_exceeds_capacity).
 */
export function eventSaveProblem(error: unknown, seats = 0): EventSaveProblem {
  if (isApiError(error, 422, "event_starts_in_past")) {
    return { kind: "field", field: "startDate", message: scheduleMessages.past };
  }
  if (isApiError(error, 422, "event_ends_before_start")) {
    return { kind: "field", field: "endDate", message: scheduleMessages.endBeforeStart };
  }
  if (isApiError(error, 422, "ticket_quantity_exceeds_capacity")) {
    return { kind: "field", field: "capacity", message: eventMessages.capacityBelowTypes(seats) };
  }
  if (isApiError(error, 400, "invalid_event")) {
    for (const name of fieldsOf(error)) {
      const known = invalidEventFields[name];
      if (known !== undefined) {
        return { kind: "field", ...known };
      }
    }
  }
  if (isApiError(error, 404, "event_not_found")) {
    return { kind: "gone" };
  }
  return { kind: "failed" };
}

export type TicketTypeSaveProblem =
  { kind: "field"; field: TicketTypeField; message: string } | { kind: "failed" };

/**
 * `POST` and `PATCH .../ticket-types`: the minimum the API answers, what fits in the capacity
 * (`fits`), the quantity already sold or reserved, and the fields of `400 invalid_ticket_type`.
 */
export function ticketTypeSaveProblem(
  error: unknown,
  { minimumCents, fits }: { minimumCents: number; fits: number },
): TicketTypeSaveProblem {
  if (isApiError(error, 422, "ticket_price_below_minimum")) {
    const body = error.body;
    const answered =
      typeof body === "object" && body !== null && "minimumCents" in body
        ? body.minimumCents
        : undefined;
    const minimum = typeof answered === "number" ? answered : minimumCents;
    return { kind: "field", field: "price", message: ticketTypeMessages.minimum(minimum) };
  }
  if (isApiError(error, 422, "ticket_quantity_exceeds_capacity")) {
    return { kind: "field", field: "quantity", message: ticketTypeMessages.capacity(fits) };
  }
  if (isApiError(error, 409, "ticket_quantity_below_committed")) {
    return { kind: "field", field: "quantity", message: ticketTypeMessages.committed };
  }
  if (isApiError(error, 400, "invalid_ticket_type")) {
    const fields = fieldsOf(error);
    if (fields.includes("name")) {
      return { kind: "field", field: "name", message: ticketTypeMessages.name };
    }
    if (fields.includes("priceCents")) {
      return { kind: "field", field: "price", message: ticketTypeMessages.minimum(minimumCents) };
    }
    if (fields.includes("quantity")) {
      return { kind: "field", field: "quantity", message: ticketTypeMessages.required };
    }
  }
  return { kind: "failed" };
}

/**
 * `POST /events/:id/publish`: an event that misses something is read again and shows what is
 * missing; a producer not ready is read again and the publication is blocked; the rest is a toast.
 */
export type PublishProblem = "event" | "producer" | "failed";

export function publishProblem(error: unknown): PublishProblem {
  if (isApiError(error, 409, "producer_not_ready")) {
    return "producer";
  }
  if (
    isApiError(error, 422, "event_not_publishable") ||
    isApiError(error, 422, "event_without_ticket_types") ||
    isApiError(error, 422, "event_starts_in_past") ||
    isApiError(error, 422, "ticket_quantity_exceeds_capacity")
  ) {
    return "event";
  }
  return "failed";
}

/**
 * The cover's calls (`.../cover/upload-url` and `PUT .../cover`): the image refused is Erro no
 * arquivo; the network, 5xx and 503 cover_storage_unavailable are the toast with "Tentar de novo".
 */
export function coverProblem(error: unknown): "refused" | "failed" {
  return isApiError(error, 422, "invalid_cover") || isApiError(error, 400, "invalid_cover_request")
    ? "refused"
    : "failed";
}
