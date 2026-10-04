import { type WorkerConfig } from "@access/config";
import { DynamicModule, Module } from "@nestjs/common";

import { BullMqPublisher } from "../queues/bullmq-publisher";
import { QUEUE_PUBLISHER } from "../queues/queues";
import { buildOutboxRoutes, OUTBOX_ROUTES } from "./outbox-routes";
import { OutboxRelayRunner } from "./outbox-relay.runner";
import { OutboxRelayService } from "./outbox-relay.service";

@Module({})
export class OutboxModule {
  static forRoot(config: WorkerConfig): DynamicModule {
    return {
      module: OutboxModule,
      providers: [
        { provide: QUEUE_PUBLISHER, useFactory: () => new BullMqPublisher(config.redisUrl) },
        {
          provide: OUTBOX_ROUTES,
          useValue: buildOutboxRoutes({ notifications: config.email !== undefined }),
        },
        OutboxRelayService,
        OutboxRelayRunner,
      ],
    };
  }
}
