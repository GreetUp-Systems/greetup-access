import { DynamicModule, Module } from "@nestjs/common";

import { BullMqPublisher } from "../queues/bullmq-publisher";
import { QUEUE_PUBLISHER } from "../queues/queues";
import { OutboxRelayRunner } from "./outbox-relay.runner";
import { OutboxRelayService } from "./outbox-relay.service";

@Module({})
export class OutboxModule {
  static forRoot(redisUrl: string): DynamicModule {
    return {
      module: OutboxModule,
      providers: [
        { provide: QUEUE_PUBLISHER, useFactory: () => new BullMqPublisher(redisUrl) },
        OutboxRelayService,
        OutboxRelayRunner,
      ],
    };
  }
}
