import { z } from "zod";

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

export const apiEnvironmentSchema = infrastructureEnvironmentSchema.extend({
  API_PORT: z.coerce.number().int().min(1).max(65_535),
  HEALTH_CHECK_TIMEOUT_MS: z.coerce.number().int().min(100).max(30_000),
  PRIVY_APP_ID: z.string().min(1),
  PRIVY_APP_SECRET: z.string().min(1),
  PRIVY_JWT_VERIFICATION_KEY: z.string().min(1),
  PRIVY_API_TIMEOUT_MS: z.coerce.number().int().min(100).max(30_000),
});
