import { loadApiConfig, loadInfrastructureConfig } from "../src";

const validEnvironment: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  API_PORT: "3001",
  DATABASE_URL: "postgresql://test:test@localhost:5433/access_test",
  DATABASE_URL_DIRECT: "postgresql://test:test@localhost:5433/access_test",
  REDIS_URL: "redis://localhost:6380",
  HEALTH_CHECK_TIMEOUT_MS: "500",
};

describe("environment configuration", () => {
  it("loads infrastructure configuration without API-only variables", () => {
    const environment = { ...validEnvironment };
    delete environment.API_PORT;
    delete environment.HEALTH_CHECK_TIMEOUT_MS;

    expect(loadInfrastructureConfig(environment)).toEqual({
      nodeEnv: "test",
      databaseUrl: validEnvironment.DATABASE_URL,
      databaseDirectUrl: validEnvironment.DATABASE_URL_DIRECT,
      redisUrl: validEnvironment.REDIS_URL,
    });
  });

  it("coerces API port and health timeout to numbers", () => {
    expect(loadApiConfig(validEnvironment)).toMatchObject({
      apiPort: 3001,
      healthCheckTimeoutMs: 500,
    });
  });

  it("reports missing variable names without exposing another variable value", () => {
    const environment = { ...validEnvironment };
    const secretUrl = environment.DATABASE_URL_DIRECT;
    delete environment.DATABASE_URL;

    expect(() => loadInfrastructureConfig(environment)).toThrow("DATABASE_URL");

    try {
      loadInfrastructureConfig(environment);
    } catch (error) {
      expect(String(error)).not.toContain(secretUrl);
    }
  });

  it.each([
    ["API_PORT", "0"],
    ["API_PORT", "65536"],
    ["HEALTH_CHECK_TIMEOUT_MS", "99"],
    ["HEALTH_CHECK_TIMEOUT_MS", "not-a-number"],
  ])("rejects invalid %s", (key, value) => {
    expect(() => loadApiConfig({ ...validEnvironment, [key]: value })).toThrow(key);
  });
});
