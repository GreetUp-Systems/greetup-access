import { type InfrastructureConfig } from "@access/config";
import { PrismaModule } from "@access/database";
import { RedisModule } from "@access/redis";
import { DynamicModule, Module } from "@nestjs/common";

@Module({})
export class WorkersModule {
  static forRoot(config: InfrastructureConfig): DynamicModule {
    return {
      module: WorkersModule,
      imports: [PrismaModule.forRoot(config.databaseUrl), RedisModule.forRoot(config.redisUrl)],
    };
  }
}
