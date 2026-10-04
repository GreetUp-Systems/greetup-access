import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common";

import { OutboxRelayService } from "./outbox-relay.service";

const idleDelayMs = 1_000;

/** Drives the relay: drains full batches immediately and waits a second when idle. */
@Injectable()
export class OutboxRelayRunner implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(OutboxRelayRunner.name);
  private running = false;
  private loop: Promise<void> | undefined;
  private wake: (() => void) | undefined;

  constructor(private readonly relay: OutboxRelayService) {}

  onApplicationBootstrap(): void {
    this.running = true;
    this.loop = this.run();
  }

  async onApplicationShutdown(): Promise<void> {
    this.running = false;
    this.wake?.();
    await this.loop;
  }

  private async run(): Promise<void> {
    while (this.running) {
      let published = 0;
      try {
        published = await this.relay.relayOnce();
      } catch (error) {
        this.logger.error(`Outbox relay iteration failed: ${(error as Error).name}`);
      }
      if (published === 0 && this.running) {
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, idleDelayMs);
          this.wake = () => {
            clearTimeout(timer);
            resolve();
          };
        });
      }
    }
  }
}
