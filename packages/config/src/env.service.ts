import { type z } from "zod";

import {
  apiEnvironmentSchema,
  infrastructureEnvironmentSchema,
  workerEnvironmentSchema,
} from "./env.schema";

export type AppEnvironment = "development" | "test" | "production";

export interface InfrastructureConfig {
  nodeEnv: AppEnvironment;
  databaseUrl: string;
  databaseDirectUrl: string;
  redisUrl: string;
}

export interface WorkerConfig {
  nodeEnv: AppEnvironment;
  databaseWorkerUrl: string;
  redisUrl: string;
  stellarNetwork: "testnet";
  stellarRpcUrl: "https://soroban-testnet.stellar.org";
  stellarSponsorPublicKey: string;
  stellarSponsorSecretKey: string | undefined;
  stellarTicketContractId: string;
  /** Undefined when e-mail is off (development only). */
  email: WorkerEmailConfig | undefined;
}

export interface WorkerEmailConfig {
  resendApiKey: string;
  from: string;
  appPublicUrl: string;
}

export interface ApiConfig extends InfrastructureConfig {
  apiPort: number;
  healthCheckTimeoutMs: number;
  privyAppId: string;
  privyAppSecret: string;
  privyJwtVerificationKey: string;
  privyApiTimeoutMs: number;
  databaseBlindPayWebhookUrl: string | undefined;
  blindPayApiKey: string;
  blindPayInstanceId: string;
  blindPayBaseUrl: string;
  blindPayWebhookSecret: string | undefined;
  blindPayApiTimeoutMs: number;
  blindPayAllowedRedirectOrigins: string[];
  /** Empty disables CORS (development without the web app). */
  corsOrigins: string[];
  blindPayPartnerFeeId: string | undefined;
  /** Minimum price of a ticket type in BRL cents; covers the Pix minimum with a margin (D-26). */
  ticketMinPriceCents: number;
  /** Ceiling of an order's subtotal in BRL cents; below the Pix maximum with a margin (D-26). */
  purchaseMaxTotalCents: number;
  stellarNetwork: "testnet";
  stellarRpcUrl: "https://soroban-testnet.stellar.org";
  stellarHorizonUrl: "https://horizon-testnet.stellar.org";
  stellarAssetCode: "USDB";
  stellarAssetIssuer: string;
  stellarUsdcAssetIssuer: string;
  stellarSponsorPublicKey: string;
  stellarSponsorSecretKey: string | undefined;
  stellarTicketContractId: string;
  ticketQrSecret: string;
}

function parseEnvironment<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  environment: NodeJS.ProcessEnv,
): z.infer<TSchema> {
  const result = schema.safeParse(environment);

  if (!result.success) {
    const fields = [
      ...new Set(result.error.issues.map((issue) => issue.path.join(".") || "environment")),
    ];

    throw new Error(`Invalid environment variables: ${fields.join(", ")}`);
  }

  return result.data;
}

export function loadInfrastructureConfig(
  environment: NodeJS.ProcessEnv = process.env,
): InfrastructureConfig {
  const parsed = parseEnvironment(infrastructureEnvironmentSchema, environment);

  return {
    nodeEnv: parsed.NODE_ENV,
    databaseUrl: parsed.DATABASE_URL,
    databaseDirectUrl: parsed.DATABASE_URL_DIRECT,
    redisUrl: parsed.REDIS_URL,
  };
}

export function loadApiConfig(environment: NodeJS.ProcessEnv = process.env): ApiConfig {
  const parsed = parseEnvironment(apiEnvironmentSchema, environment);
  const blindPayAllowedRedirectOrigins = [
    ...new Set(
      parsed.BLINDPAY_ALLOWED_REDIRECT_ORIGINS.split(",").map(
        (value) => new URL(value.trim()).origin,
      ),
    ),
  ];

  return {
    nodeEnv: parsed.NODE_ENV,
    apiPort: parsed.API_PORT,
    databaseUrl: parsed.DATABASE_URL,
    databaseDirectUrl: parsed.DATABASE_URL_DIRECT,
    redisUrl: parsed.REDIS_URL,
    healthCheckTimeoutMs: parsed.HEALTH_CHECK_TIMEOUT_MS,
    privyAppId: parsed.PRIVY_APP_ID,
    privyAppSecret: parsed.PRIVY_APP_SECRET,
    privyJwtVerificationKey: parsed.PRIVY_JWT_VERIFICATION_KEY,
    privyApiTimeoutMs: parsed.PRIVY_API_TIMEOUT_MS,
    databaseBlindPayWebhookUrl: parsed.DATABASE_URL_BLINDPAY_WEBHOOK || undefined,
    blindPayApiKey: parsed.BLINDPAY_API_KEY,
    blindPayInstanceId: parsed.BLINDPAY_INSTANCE_ID,
    blindPayBaseUrl: parsed.BLINDPAY_BASE_URL.replace(/\/$/, ""),
    blindPayWebhookSecret: parsed.BLINDPAY_WEBHOOK_SECRET || undefined,
    blindPayApiTimeoutMs: parsed.BLINDPAY_API_TIMEOUT_MS,
    blindPayAllowedRedirectOrigins,
    corsOrigins: parsed.API_CORS_ORIGINS
      ? [
          ...new Set(
            parsed.API_CORS_ORIGINS.split(",").map((value) => new URL(value.trim()).origin),
          ),
        ]
      : [],
    blindPayPartnerFeeId: parsed.BLINDPAY_PARTNER_FEE_ID || undefined,
    ticketMinPriceCents: parsed.TICKET_MIN_PRICE_CENTS,
    purchaseMaxTotalCents: parsed.PURCHASE_MAX_TOTAL_CENTS,
    stellarNetwork: parsed.STELLAR_NETWORK,
    stellarRpcUrl: parsed.STELLAR_RPC_URL,
    stellarHorizonUrl: parsed.STELLAR_HORIZON_URL,
    stellarAssetCode: parsed.STELLAR_ASSET_CODE,
    stellarAssetIssuer: parsed.STELLAR_ASSET_ISSUER,
    stellarUsdcAssetIssuer: parsed.STELLAR_USDC_ASSET_ISSUER,
    stellarSponsorPublicKey: parsed.STELLAR_SPONSOR_PUBLIC_KEY,
    stellarSponsorSecretKey: parsed.STELLAR_SPONSOR_SECRET_KEY,
    stellarTicketContractId: parsed.STELLAR_TICKET_CONTRACT_ID,
    ticketQrSecret: parsed.TICKET_QR_SECRET,
  };
}

export function loadWorkerConfig(environment: NodeJS.ProcessEnv = process.env): WorkerConfig {
  const parsed = parseEnvironment(workerEnvironmentSchema, environment);

  return {
    nodeEnv: parsed.NODE_ENV,
    databaseWorkerUrl: parsed.DATABASE_URL_WORKER,
    redisUrl: parsed.REDIS_URL,
    stellarNetwork: parsed.STELLAR_NETWORK,
    stellarRpcUrl: parsed.STELLAR_RPC_URL,
    stellarSponsorPublicKey: parsed.STELLAR_SPONSOR_PUBLIC_KEY,
    stellarSponsorSecretKey: parsed.STELLAR_SPONSOR_SECRET_KEY,
    stellarTicketContractId: parsed.STELLAR_TICKET_CONTRACT_ID,
    email:
      parsed.RESEND_API_KEY && parsed.EMAIL_FROM && parsed.APP_PUBLIC_URL
        ? {
            resendApiKey: parsed.RESEND_API_KEY,
            from: parsed.EMAIL_FROM,
            appPublicUrl: parsed.APP_PUBLIC_URL.replace(/\/$/, ""),
          }
        : undefined,
  };
}
