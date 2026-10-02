import "reflect-metadata";

import { type ApiConfig } from "@access/config";
import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";

import { AppModule } from "../src/app.module";
import { configureApplication } from "../src/app.setup";
import { stellarTestConfig } from "./test-stellar-config";

const baseConfig: ApiConfig = {
  nodeEnv: "test",
  apiPort: 0,
  databaseUrl: "postgresql://access_runtime:test_runtime@localhost:5433/access_test",
  databaseDirectUrl: "postgresql://test:test@localhost:5433/access_test",
  redisUrl: "redis://localhost:6380",
  healthCheckTimeoutMs: 250,
  privyAppId: "test-app-id",
  privyAppSecret: "test-app-secret",
  privyJwtVerificationKey: "test-verification-key",
  privyApiTimeoutMs: 500,
  databaseBlindPayWebhookUrl: undefined,
  blindPayApiKey: "blindpay-test-key",
  blindPayInstanceId: "in_test",
  blindPayBaseUrl: "https://api.blindpay.com/v1",
  blindPayWebhookSecret: undefined,
  blindPayApiTimeoutMs: 500,
  blindPayAllowedRedirectOrigins: ["http://localhost:3000"],
  ...stellarTestConfig,
};

async function createApp(config: ApiConfig): Promise<INestApplication> {
  const module = await Test.createTestingModule({
    imports: [AppModule.forRoot(config)],
  }).compile();
  const app = module.createNestApplication();
  configureApplication(app);
  await app.init();
  return app;
}

describe("health endpoints", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp(baseConfig);
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns liveness without dependency details", async () => {
    const response = await request(app.getHttpServer()).get("/api/health/live").expect(200);

    expect(response.body).toEqual({
      status: "alive",
      timestamp: expect.any(String),
    });
  });

  it("does not expose the BlindPay webhook while it is disabled", async () => {
    await request(app.getHttpServer()).post("/api/webhooks/blindpay").send({}).expect(404);
  });

  it("returns readiness when PostgreSQL and Redis answer", async () => {
    const response = await request(app.getHttpServer()).get("/api/health/ready").expect(200);

    expect(response.body).toEqual({
      status: "ready",
      checks: { database: "up", redis: "up" },
      timestamp: expect.any(String),
    });
  });

  it("returns 503 without leaking connection details when Redis is unavailable", async () => {
    const unavailableApp = await createApp({
      ...baseConfig,
      redisUrl: "redis://localhost:6399",
      healthCheckTimeoutMs: 100,
    });

    try {
      const response = await request(unavailableApp.getHttpServer())
        .get("/api/health/ready")
        .expect(503);

      expect(response.body).toEqual({
        status: "not_ready",
        checks: { database: "up", redis: "down" },
        timestamp: expect.any(String),
      });
      expect(JSON.stringify(response.body)).not.toContain("6399");
    } finally {
      await unavailableApp.close();
    }
  });
});
