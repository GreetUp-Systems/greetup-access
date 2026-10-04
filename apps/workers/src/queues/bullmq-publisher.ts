import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import { type JobsOptions, Queue } from "bullmq";

import { type QueuePublisher } from "./queues";

// Retries cover transient failures; exhausted jobs stay in the failed set as the alert (D-15).
// Completed jobs are kept for a day so a republished jobId is still recognized.
export const defaultJobOptions: JobsOptions = {
  attempts: 8,
  backoff: { type: "exponential", delay: 5_000 },
  removeOnComplete: { age: 24 * 60 * 60 },
  removeOnFail: false,
};

@Injectable()
export class BullMqPublisher implements QueuePublisher, OnModuleDestroy {
  private readonly queues = new Map<string, Queue>();

  constructor(private readonly redisUrl: string) {}

  async publish(queue: string, jobName: string, data: object, jobId: string): Promise<void> {
    await this.queueFor(queue).add(jobName, data, { ...defaultJobOptions, jobId });
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([...this.queues.values()].map((queue) => queue.close()));
  }

  private queueFor(name: string): Queue {
    let queue = this.queues.get(name);
    if (queue === undefined) {
      queue = new Queue(name, { connection: { url: this.redisUrl } });
      this.queues.set(name, queue);
    }
    return queue;
  }
}
