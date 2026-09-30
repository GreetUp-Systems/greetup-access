import { loadApiConfig, loadInfrastructureConfig } from "../src";

const validEnvironment: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  API_PORT: "3001",
  DATABASE_URL: "postgresql://test:test@localhost:5433/access_test",
  DATABASE_URL_DIRECT: "postgresql://test:test@localhost:5433/access_test",
  REDIS_URL: "redis://localhost:6380",
  HEALTH_CHECK_TIMEOUT_MS: "500",
  PRIVY_APP_ID: "test-app-id",
  PRIVY_APP_SECRET: "test-app-secret",
  PRIVY_JWT_VERIFICATION_KEY: "test-verification-key",
  PRIVY_API_TIMEOUT_MS: "5000",
};

describe("environment configuration", () => {
  it("loads infrastructure configuration without API-only variables", () => {
    const environment = { ...validEnvironment };
    delete environment.API_PORT;
    delete environment.HEALTH_CHECK_TIMEOUT_MS;
    delete environment.PRIVY_APP_ID;
    delete environment.PRIVY_APP_SECRET;
    delete environment.PRIVY_JWT_VERIFICATION_KEY;
    delete environment.PRIVY_API_TIMEOUT_MS;

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
      privyApiTimeoutMs: 5000,
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
    ["PRIVY_API_TIMEOUT_MS", "99"],
    ["PRIVY_API_TIMEOUT_MS", "not-a-number"],
  ])("rejects invalid %s", (key, value) => {
    expect(() => loadApiConfig({ ...validEnvironment, [key]: value })).toThrow(key);
  });

  it.each(["PRIVY_APP_ID", "PRIVY_APP_SECRET", "PRIVY_JWT_VERIFICATION_KEY"])(
    "requires %s for the API",
    (key) => {
      const environment = { ...validEnvironment };
      delete environment[key];

      expect(() => loadApiConfig(environment)).toThrow(key);
    },
  );
});
