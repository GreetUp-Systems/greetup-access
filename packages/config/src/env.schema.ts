import { z } from "zod";

function isHttpOriginList(value: string): boolean {
  try {
    const origins = value.split(",").map((item) => new URL(item.trim()));
    return origins.length > 0 && origins.every((url) => ["http:", "https:"].includes(url.protocol));
  } catch {
    return false;
  }
}

export const infrastructureEnvironmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  DATABASE_URL: z.string().url(),
  DATABASE_URL_DIRECT: z.string().url(),
  REDIS_URL: z
    .string()
    .url()
    .refine((value) => value.startsWith("redis://") || value.startsWith("rediss://"), {
      message: "must use the redis or rediss protocol",
    }),
});

const optionalWebhookDatabaseUrl = z.union([z.string().url(), z.literal("")]).optional();
const optionalWebhookSecret = z.union([z.string().startsWith("whsec_"), z.literal("")]).optional();
const stellarPublicKey = z.string().regex(/^G[A-Z2-7]{55}$/);
const stellarSecretKey = z.string().regex(/^S[A-Z2-7]{55}$/);
const stellarTestnetUsdbIssuer = "GCQSSIMOW5OCGULZATDXKU5MOJBOMFX6G65X6CXZDQ7AIB3SKFUZ67NX";
const stellarTestnetUsdcIssuer = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

export const apiEnvironmentSchema = infrastructureEnvironmentSchema
  .extend({
    API_PORT: z.coerce.number().int().min(1).max(65_535),
    HEALTH_CHECK_TIMEOUT_MS: z.coerce.number().int().min(100).max(30_000),
    PRIVY_APP_ID: z.string().min(1),
    PRIVY_APP_SECRET: z.string().min(1),
    PRIVY_JWT_VERIFICATION_KEY: z.string().min(1),
    PRIVY_API_TIMEOUT_MS: z.coerce.number().int().min(100).max(30_000),
    DATABASE_URL_BLINDPAY_WEBHOOK: optionalWebhookDatabaseUrl,
    BLINDPAY_API_KEY: z.string().min(1),
    BLINDPAY_INSTANCE_ID: z.string().startsWith("in_"),
    BLINDPAY_BASE_URL: z.string().url(),
    BLINDPAY_WEBHOOK_SECRET: optionalWebhookSecret,
    BLINDPAY_API_TIMEOUT_MS: z.coerce.number().int().min(100).max(30_000),
    BLINDPAY_ALLOWED_REDIRECT_ORIGINS: z.string().min(1).refine(isHttpOriginList),
    BLINDPAY_PARTNER_FEE_ID: z.union([z.string().startsWith("pf_"), z.literal("")]).optional(),
    STELLAR_NETWORK: z.literal("testnet"),
    STELLAR_RPC_URL: z.literal("https://soroban-testnet.stellar.org"),
    STELLAR_HORIZON_URL: z.literal("https://horizon-testnet.stellar.org"),
    STELLAR_ASSET_CODE: z.literal("USDB"),
    STELLAR_ASSET_ISSUER: z.literal(stellarTestnetUsdbIssuer),
    STELLAR_USDC_ASSET_ISSUER: z.literal(stellarTestnetUsdcIssuer),
    STELLAR_SPONSOR_PUBLIC_KEY: stellarPublicKey,
    STELLAR_SPONSOR_SECRET_KEY: stellarSecretKey.optional(),
  })
  .superRefine((environment, context) => {
    const databaseConfigured = Boolean(environment.DATABASE_URL_BLINDPAY_WEBHOOK);
    const secretConfigured = Boolean(environment.BLINDPAY_WEBHOOK_SECRET);
    const webhookRequired = environment.NODE_ENV !== "development";

    if ((webhookRequired || secretConfigured) && !databaseConfigured) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["DATABASE_URL_BLINDPAY_WEBHOOK"],
        message: "is required when the BlindPay webhook is enabled",
      });
    }

    if ((webhookRequired || databaseConfigured) && !secretConfigured) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["BLINDPAY_WEBHOOK_SECRET"],
        message: "is required when the BlindPay webhook is enabled",
      });
    }

    if (environment.NODE_ENV === "production" && environment.STELLAR_SPONSOR_SECRET_KEY) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["STELLAR_SPONSOR_SECRET_KEY"],
        message: "is forbidden in production",
      });
    }

    if (environment.NODE_ENV !== "production" && !environment.STELLAR_SPONSOR_SECRET_KEY) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["STELLAR_SPONSOR_SECRET_KEY"],
        message: "is required outside production",
      });
    }
  });

// Worker processes connect with their own restricted role and mint as the platform account
// (SPEC-005 §13–14). The local signer follows the same fail-closed rules as the API (ADR-010).
export const workerEnvironmentSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]),
    DATABASE_URL_WORKER: z.string().url(),
    REDIS_URL: infrastructureEnvironmentSchema.shape.REDIS_URL,
    STELLAR_NETWORK: z.literal("testnet"),
    STELLAR_RPC_URL: z.literal("https://soroban-testnet.stellar.org"),
    STELLAR_SPONSOR_PUBLIC_KEY: stellarPublicKey,
    STELLAR_SPONSOR_SECRET_KEY: stellarSecretKey.optional(),
    STELLAR_TICKET_CONTRACT_ID: z.string().regex(/^C[A-Z2-7]{55}$/),
  })
  .superRefine((environment, context) => {
    if (environment.NODE_ENV === "production" && environment.STELLAR_SPONSOR_SECRET_KEY) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["STELLAR_SPONSOR_SECRET_KEY"],
        message: "is forbidden in production",
      });
    }
    if (environment.NODE_ENV !== "production" && !environment.STELLAR_SPONSOR_SECRET_KEY) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["STELLAR_SPONSOR_SECRET_KEY"],
        message: "is required outside production",
      });
    }
  });
