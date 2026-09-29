import { type PrismaService } from "@access/database";
import { type RedisService } from "@access/redis";

import { HealthService } from "./health.service";

function createService(
  databasePing: () => Promise<void> = async () => undefined,
  redisPing: () => Promise<void> = async () => undefined,
  timeoutMs = 100,
): HealthService {
  const prisma = { ping: databasePing } as PrismaService;
  const redis = { ping: redisPing } as RedisService;
  return new HealthService(prisma, redis, timeoutMs);
}

describe("HealthService", () => {
  it("reports liveness without consulting dependencies", () => {
    const databasePing = jest.fn(async () => undefined);
    const redisPing = jest.fn(async () => undefined);
    const service = createService(databasePing, redisPing);

    expect(service.liveness()).toEqual({
      status: "alive",
      timestamp: expect.any(String),
    });
    expect(databasePing).not.toHaveBeenCalled();
    expect(redisPing).not.toHaveBeenCalled();
  });

  it("reports ready when both dependencies answer", async () => {
    await expect(createService().readiness()).resolves.toEqual({
      status: "ready",
      checks: { database: "up", redis: "up" },
      timestamp: expect.any(String),
    });
  });

  it("reports the failed dependency without exposing its error", async () => {
    const service = createService(async () => undefined, async () => {
      throw new Error("redis://user:secret@internal-host:6379");
    });

    await expect(service.readiness()).resolves.toEqual({
      status: "not_ready",
      checks: { database: "up", redis: "down" },
      timestamp: expect.any(String),
    });
  });

  it("marks a dependency down when its timeout expires", async () => {
    const neverCompletes = (): Promise<void> => new Promise(() => undefined);
    const result = await createService(neverCompletes, async () => undefined, 10).readiness();

    expect(result).toMatchObject({
      status: "not_ready",
      checks: { database: "down", redis: "up" },
    });
  });
});
