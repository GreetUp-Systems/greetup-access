import { PrismaService } from "@access/database";
import { Inject, Injectable, Logger } from "@nestjs/common";

import {
  MINT_TICKET_JOB,
  type MintTicketJobData,
  QUEUE_PUBLISHER,
  type QueuePublisher,
  TICKETS_QUEUE,
} from "../queues/queues";

interface OutboxRow {
  id: string;
  event_type: string;
  payload: unknown;
  attempts: number;
}

interface Route {
  queue: string;
  job: string;
  data(eventId: string, payload: unknown): object | undefined;
}

// Only events with a consumer are routed; the others stay pending until one exists (SPEC-005 §10).
const routes: Record<string, Route> = {
  "payment.confirmed": {
    queue: TICKETS_QUEUE,
    job: MINT_TICKET_JOB,
    data: (outboxEventId, payload): MintTicketJobData | undefined => {
      const purchaseId =
        typeof payload === "object" && payload !== null
          ? (payload as Record<string, unknown>).purchaseId
          : undefined;
      return typeof purchaseId === "string" ? { purchaseId, outboxEventId } : undefined;
    },
  },
};
const routedEventTypes = Object.keys(routes);

const batchSize = 50;
const maxBackoffMs = 5 * 60 * 1_000;

@Injectable()
export class OutboxRelayService {
  private readonly logger = new Logger(OutboxRelayService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(QUEUE_PUBLISHER) private readonly publisher: QueuePublisher,
  ) {}

  /**
   * Publishes one batch. Rows are locked with SKIP LOCKED, so concurrent relays never take the
   * same event, and the outbox id is the job id, so a republication is harmless.
   */
  relayOnce(): Promise<number> {
    return this.prisma.$transaction(
      async (transaction) => {
        const events = await transaction.$queryRaw<OutboxRow[]>`
          SELECT "id", "event_type", "payload", "attempts"
          FROM "outbox_events"
          WHERE "status" = 'pending'
            AND "available_at" <= (now() AT TIME ZONE 'UTC')
            AND "event_type" = ANY(${routedEventTypes})
          ORDER BY "created_at"
          LIMIT ${batchSize}
          FOR UPDATE SKIP LOCKED
        `;

        for (const event of events) {
          const route = routes[event.event_type];
          const data = route?.data(event.id, event.payload);
          if (route === undefined || data === undefined) {
            await transaction.outboxEvent.update({
              where: { id: event.id },
              data: { status: "FAILED", lastError: "invalid_outbox_payload" },
            });
            this.logger.error(`Outbox event ${event.id} has an invalid payload.`);
            continue;
          }

          try {
            await this.publisher.publish(route.queue, route.job, data, event.id);
            await transaction.outboxEvent.update({
              where: { id: event.id },
              data: { status: "PROCESSED", processedAt: new Date(), lastError: null },
            });
          } catch (error) {
            const attempts = event.attempts + 1;
            await transaction.outboxEvent.update({
              where: { id: event.id },
              data: {
                attempts,
                availableAt: new Date(Date.now() + this.backoffMs(attempts)),
                lastError: (error instanceof Error ? error.name : "publish_failed").slice(0, 80),
              },
            });
            this.logger.warn(
              `Outbox event ${event.id} could not be published (attempt ${attempts}).`,
            );
          }
        }

        return events.length;
      },
      { timeout: 30_000 },
    );
  }

  private backoffMs(attempts: number): number {
    return Math.min(1_000 * 2 ** attempts, maxBackoffMs);
  }
}
