import { DynamicModule, Global, Module } from "@nestjs/common";

import { REDIS_URL } from "./redis.constants";
import { RedisService } from "./redis.service";

@Global()
@Module({})
export class RedisModule {
  static forRoot(redisUrl: string): DynamicModule {
    return {
      module: RedisModule,
      providers: [
        {
          provide: REDIS_URL,
          useValue: redisUrl,
        },
        RedisService,
      ],
      exports: [RedisService],
    };
  }
}
