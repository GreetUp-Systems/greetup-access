import { type ApiConfig } from "@access/config";
import { PrismaModule } from "@access/database";
import { RedisModule } from "@access/redis";
import { DynamicModule, Module } from "@nestjs/common";

import { HealthModule } from "./health/health.module";

@Module({})
export class AppModule {
  static forRoot(config: ApiConfig): DynamicModule {
    return {
      module: AppModule,
      imports: [
        PrismaModule.forRoot(config.databaseUrl),
        RedisModule.forRoot(config.redisUrl),
        HealthModule.forRoot(config.healthCheckTimeoutMs),
      ],
    };
  }
}
