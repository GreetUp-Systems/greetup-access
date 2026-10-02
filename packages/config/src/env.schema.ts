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
  });
