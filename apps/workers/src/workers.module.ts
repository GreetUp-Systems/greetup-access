import { type WorkerConfig } from "@access/config";
import { PrismaModule } from "@access/database";
import { RedisModule } from "@access/redis";
import { DynamicModule, Module } from "@nestjs/common";

import { OutboxModule } from "./outbox/outbox.module";
import { TicketsModule } from "./tickets/tickets.module";

@Module({})
export class WorkersModule {
  static forRoot(config: WorkerConfig): DynamicModule {
    return {
      module: WorkersModule,
      imports: [
        PrismaModule.forRoot(config.databaseWorkerUrl, {
          requireRestrictedRole: true,
          restrictedRole: "access_worker",
        }),
        RedisModule.forRoot(config.redisUrl),
        OutboxModule.forRoot(config.redisUrl),
        TicketsModule.forRoot(config),
      ],
    };
  }
}
