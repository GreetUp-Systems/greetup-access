import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { type Job, UnrecoverableError, Worker } from "bullmq";

import {
  NOTIFICATIONS_QUEUE,
  SEND_TICKETS_READY_JOB,
  type SendTicketsReadyJobData,
} from "../queues/queues";
import { NotifyService } from "./notify.service";

/** Consumes the notifications queue (D-15). Logs carry ids only, never the recipient. */
@Injectable()
export class NotifyWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotifyWorker.name);
  private worker: Worker | undefined;

  constructor(
    private readonly redisUrl: string,
    private readonly notify: NotifyService,
  ) {}

  onModuleInit(): void {
    this.worker = new Worker(NOTIFICATIONS_QUEUE, (job) => this.process(job), {
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
    if (job.name !== SEND_TICKETS_READY_JOB) {
      throw new UnrecoverableError(`unknown_job:${job.name}`);
    }
    const data = job.data as Partial<SendTicketsReadyJobData>;
    if (typeof data.ticketId !== "string") {
      throw new UnrecoverableError("invalid_job_data");
    }
    return this.notify.ticketsReady(data.ticketId);
  }
}
