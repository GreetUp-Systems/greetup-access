import { type INestApplication } from "@nestjs/common";
import { json, urlencoded } from "express";

export function configureApplication(app: INestApplication): void {
  app.setGlobalPrefix("api");
  app.use(json({ limit: "1mb" }));
  app.use(urlencoded({ extended: true, limit: "1mb" }));
  app.enableShutdownHooks();
}
