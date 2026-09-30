import { type ApiConfig } from "@access/config";
import { PrismaModule } from "@access/database";
import { RedisModule } from "@access/redis";
import { DynamicModule, Module } from "@nestjs/common";

import { AuthModule } from "./auth/auth.module";
import { PrivyModule } from "./common/privy/privy.module";
import { HealthModule } from "./health/health.module";

@Module({})
export class AppModule {
  static forRoot(config: ApiConfig): DynamicModule {
    return {
      module: AppModule,
      imports: [
        PrismaModule.forRoot(config.databaseUrl),
        RedisModule.forRoot(config.redisUrl),
        PrivyModule.forRoot(config),
        AuthModule,
        HealthModule.forRoot(config.healthCheckTimeoutMs),
      ],
    };
  }
}
