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
  DATABASE_URL_BLINDPAY_WEBHOOK:
    "postgresql://access_blindpay_webhook_login:test@localhost:5433/access_test",
  BLINDPAY_API_KEY: "blindpay-test-key",
  BLINDPAY_INSTANCE_ID: "in_test",
  BLINDPAY_BASE_URL: "https://api.blindpay.com/v1/",
  BLINDPAY_WEBHOOK_SECRET: "whsec_dGVzdA==",
  BLINDPAY_API_TIMEOUT_MS: "5000",
  BLINDPAY_ALLOWED_REDIRECT_ORIGINS: "http://localhost:3000, https://app.example.com/path",
  STELLAR_NETWORK: "testnet",
  STELLAR_RPC_URL: "https://soroban-testnet.stellar.org",
  STELLAR_HORIZON_URL: "https://horizon-testnet.stellar.org",
  STELLAR_ASSET_CODE: "USDB",
  STELLAR_ASSET_ISSUER: "GCQSSIMOW5OCGULZATDXKU5MOJBOMFX6G65X6CXZDQ7AIB3SKFUZ67NX",
  STELLAR_USDC_ASSET_ISSUER: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
  STELLAR_SPONSOR_PUBLIC_KEY: `G${"A".repeat(55)}`,
  STELLAR_SPONSOR_SECRET_KEY: `S${"A".repeat(55)}`,
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
      blindPayApiTimeoutMs: 5000,
      blindPayBaseUrl: "https://api.blindpay.com/v1",
      blindPayAllowedRedirectOrigins: ["http://localhost:3000", "https://app.example.com"],
      stellarNetwork: "testnet",
      stellarAssetCode: "USDB",
      stellarUsdcAssetIssuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
    });
  });

  it("allows the BlindPay webhook to remain disabled in development", () => {
    const environment: NodeJS.ProcessEnv = { ...validEnvironment, NODE_ENV: "development" };
    delete environment.DATABASE_URL_BLINDPAY_WEBHOOK;
    delete environment.BLINDPAY_WEBHOOK_SECRET;

    expect(loadApiConfig(environment)).toMatchObject({
      databaseBlindPayWebhookUrl: undefined,
      blindPayWebhookSecret: undefined,
    });
  });

  it("requires both webhook settings when either one is configured", () => {
    const withoutSecret: NodeJS.ProcessEnv = { ...validEnvironment, NODE_ENV: "development" };
    delete withoutSecret.BLINDPAY_WEBHOOK_SECRET;
    expect(() => loadApiConfig(withoutSecret)).toThrow("BLINDPAY_WEBHOOK_SECRET");

    const withoutDatabase: NodeJS.ProcessEnv = {
      ...validEnvironment,
      NODE_ENV: "development",
    };
    delete withoutDatabase.DATABASE_URL_BLINDPAY_WEBHOOK;
    expect(() => loadApiConfig(withoutDatabase)).toThrow("DATABASE_URL_BLINDPAY_WEBHOOK");
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
    ["BLINDPAY_API_TIMEOUT_MS", "99"],
    ["BLINDPAY_API_TIMEOUT_MS", "not-a-number"],
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

  it.each([
    "DATABASE_URL_BLINDPAY_WEBHOOK",
    "BLINDPAY_API_KEY",
    "BLINDPAY_INSTANCE_ID",
    "BLINDPAY_BASE_URL",
    "BLINDPAY_WEBHOOK_SECRET",
    "BLINDPAY_ALLOWED_REDIRECT_ORIGINS",
    "STELLAR_NETWORK",
    "STELLAR_RPC_URL",
    "STELLAR_HORIZON_URL",
    "STELLAR_ASSET_CODE",
    "STELLAR_ASSET_ISSUER",
    "STELLAR_USDC_ASSET_ISSUER",
    "STELLAR_SPONSOR_PUBLIC_KEY",
    "STELLAR_SPONSOR_SECRET_KEY",
  ])("requires %s for the API", (key) => {
    const environment = { ...validEnvironment };
    delete environment[key];

    expect(() => loadApiConfig(environment)).toThrow(key);
  });

  it("rejects Pubnet, a different asset or issuer and a local production signer", () => {
    expect(() => loadApiConfig({ ...validEnvironment, STELLAR_NETWORK: "public" })).toThrow(
      "STELLAR_NETWORK",
    );
    expect(() => loadApiConfig({ ...validEnvironment, STELLAR_ASSET_CODE: "USDC" })).toThrow(
      "STELLAR_ASSET_CODE",
    );
    expect(() =>
      loadApiConfig({
        ...validEnvironment,
        STELLAR_USDC_ASSET_ISSUER: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      }),
    ).toThrow("STELLAR_USDC_ASSET_ISSUER");
    expect(() => loadApiConfig({ ...validEnvironment, NODE_ENV: "production" })).toThrow(
      "STELLAR_SPONSOR_SECRET_KEY",
    );
  });
});
