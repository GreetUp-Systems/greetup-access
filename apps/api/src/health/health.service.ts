import { PrismaService } from "@access/database";
import { RedisService } from "@access/redis";
import { Inject, Injectable } from "@nestjs/common";

import { HEALTH_CHECK_TIMEOUT_MS } from "./health.constants";
import {
  type DependencyStatus,
  type LivenessResponse,
  type ReadinessResponse,
} from "./health.types";

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    @Inject(HEALTH_CHECK_TIMEOUT_MS) private readonly timeoutMs: number,
  ) {}

  liveness(): LivenessResponse {
    return {
      status: "alive",
      timestamp: new Date().toISOString(),
    };
  }

  async readiness(): Promise<ReadinessResponse> {
    const [database, redis] = await Promise.all([
      this.check(() => this.prisma.ping()),
      this.check(() => this.redis.ping()),
    ]);

    return {
      status: database === "up" && redis === "up" ? "ready" : "not_ready",
      checks: { database, redis },
      timestamp: new Date().toISOString(),
    };
  }

  private async check(operation: () => Promise<void>): Promise<DependencyStatus> {
    let timer: NodeJS.Timeout | undefined;

    try {
      await Promise.race([
        operation(),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => reject(new Error("Health check timed out")), this.timeoutMs);
        }),
      ]);
      return "up";
    } catch {
      return "down";
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }
}
