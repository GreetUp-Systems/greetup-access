import { Inject, Injectable, OnModuleDestroy } from "@nestjs/common";
import Redis from "ioredis";

import { REDIS_URL } from "./redis.constants";

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;

  constructor(@Inject(REDIS_URL) redisUrl: string) {
    this.client = new Redis(redisUrl, {
      connectTimeout: 2_000,
      enableOfflineQueue: false,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });
    this.client.on("error", () => undefined);
  }

  async ping(): Promise<void> {
    if (this.client.status === "wait") {
      await this.client.connect();
    }

    await this.client.ping();
  }

  async quit(): Promise<void> {
    if (this.client.status !== "ready") {
      this.client.disconnect();
      return;
    }

    await this.client.quit();
  }

  async onModuleDestroy(): Promise<void> {
    await this.quit();
  }
}
