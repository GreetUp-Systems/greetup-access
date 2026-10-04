// Queues and jobs fed by the OutboxRelay (SPEC-005 §10, D-15).
export const TICKETS_QUEUE = "tickets";
export const MINT_TICKET_JOB = "MintTicketJob";

export interface MintTicketJobData {
  purchaseId: string;
  outboxEventId: string;
}

export interface QueuePublisher {
  /** Publishing twice with the same jobId must not create a second job. */
  publish(queue: string, jobName: string, data: object, jobId: string): Promise<void>;
}

export const QUEUE_PUBLISHER = Symbol("QUEUE_PUBLISHER");
