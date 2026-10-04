import "reflect-metadata";

import { loadApiConfig } from "@access/config";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";
import { configureApplication } from "./app.setup";

async function bootstrap(): Promise<void> {
  const config = loadApiConfig();
  const app = await NestFactory.create(AppModule.forRoot(config));

  configureApplication(app, { corsOrigins: config.corsOrigins });
  await app.listen(config.apiPort);
}

void bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown bootstrap error";
  Logger.error(message, undefined, "ApiBootstrap");
  process.exitCode = 1;
});
