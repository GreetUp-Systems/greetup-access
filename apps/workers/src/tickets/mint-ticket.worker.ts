import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { type Job, UnrecoverableError, Worker } from "bullmq";

import { MINT_TICKET_JOB, type MintTicketJobData, TICKETS_QUEUE } from "../queues/queues";
import { MintTicketsService } from "./mint-tickets.service";

/**
 * Consumes the tickets queue. Concurrency 1: every mint is signed by the same platform account,
 * so serial submissions avoid sequence-number conflicts.
 */
@Injectable()
export class MintTicketWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MintTicketWorker.name);
  private worker: Worker | undefined;

  constructor(
    private readonly redisUrl: string,
    private readonly mintTickets: MintTicketsService,
  ) {}

  onModuleInit(): void {
    this.worker = new Worker(TICKETS_QUEUE, (job) => this.process(job), {
      connection: { url: this.redisUrl, maxRetriesPerRequest: null },
      concurrency: 1,
    });
    this.worker.on("failed", (job, error) => {
      this.logger.error(
        `${job?.name ?? "job"} ${job?.id ?? ""} failed (attempt ${job?.attemptsMade ?? 0}): ${error.message}`,
      );
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  async process(job: Job): Promise<string> {
    if (job.name !== MINT_TICKET_JOB) {
      throw new UnrecoverableError(`unknown_job:${job.name}`);
    }
    const data = job.data as Partial<MintTicketJobData>;
    if (typeof data.purchaseId !== "string") {
      throw new UnrecoverableError("invalid_job_data");
    }
    return this.mintTickets.mintPurchase(data.purchaseId);
  }
}
