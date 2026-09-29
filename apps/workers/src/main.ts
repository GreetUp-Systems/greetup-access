import "reflect-metadata";

import { loadInfrastructureConfig } from "@access/config";
import { PrismaService } from "@access/database";
import { RedisService } from "@access/redis";
import { Logger, type INestApplicationContext } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { WorkersModule } from "./workers.module";

async function bootstrap(): Promise<void> {
  const config = loadInfrastructureConfig();
  let app: INestApplicationContext | undefined;

  try {
    app = await NestFactory.createApplicationContext(WorkersModule.forRoot(config));
    app.enableShutdownHooks();

    const prisma = app.get(PrismaService);
    const redis = app.get(RedisService);
    await Promise.all([prisma.ping(), redis.ping()]);

    Logger.log("Worker process is ready", "WorkersBootstrap");
  } catch (error) {
    if (app) {
      await app.close();
    }
    throw error;
  }
}

void bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown bootstrap error";
  Logger.error(message, undefined, "WorkersBootstrap");
  process.exitCode = 1;
});
