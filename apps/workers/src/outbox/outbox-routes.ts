import {
  MINT_TICKET_JOB,
  type MintTicketJobData,
  NOTIFICATIONS_QUEUE,
  SEND_TICKETS_READY_JOB,
  type SendTicketsReadyJobData,
  TICKETS_QUEUE,
} from "../queues/queues";

export interface OutboxRoute {
  queue: string;
  job: string;
  data(eventId: string, payload: unknown): object | undefined;
}

export type OutboxRoutes = Record<string, OutboxRoute>;

export const OUTBOX_ROUTES = Symbol("OUTBOX_ROUTES");

function stringField(payload: unknown, key: string): string | undefined {
  const value =
    typeof payload === "object" && payload !== null
      ? (payload as Record<string, unknown>)[key]
      : undefined;
  return typeof value === "string" ? value : undefined;
}

/**
 * Only events with a consumer are routed; the others stay pending until one exists
 * (SPEC-005 §10). ticket.issued is routed only while e-mail is on (SPEC-008 §8).
 */
export function buildOutboxRoutes(options: { notifications: boolean }): OutboxRoutes {
  const routes: OutboxRoutes = {
    "payment.confirmed": {
      queue: TICKETS_QUEUE,
      job: MINT_TICKET_JOB,
      data: (outboxEventId, payload): MintTicketJobData | undefined => {
        const purchaseId = stringField(payload, "purchaseId");
        return purchaseId === undefined ? undefined : { purchaseId, outboxEventId };
      },
    },
  };

  if (options.notifications) {
    routes["ticket.issued"] = {
      queue: NOTIFICATIONS_QUEUE,
      job: SEND_TICKETS_READY_JOB,
      data: (outboxEventId, payload): SendTicketsReadyJobData | undefined => {
        const ticketId = stringField(payload, "ticketId");
        return ticketId === undefined ? undefined : { ticketId, outboxEventId };
      },
    };
  }

  return routes;
}
