import { type z } from "zod";

import { apiEnvironmentSchema, infrastructureEnvironmentSchema } from "./env.schema";

export type AppEnvironment = "development" | "test" | "production";

export interface InfrastructureConfig {
  nodeEnv: AppEnvironment;
  databaseUrl: string;
  databaseDirectUrl: string;
  redisUrl: string;
}

export interface ApiConfig extends InfrastructureConfig {
  apiPort: number;
  healthCheckTimeoutMs: number;
  privyAppId: string;
  privyAppSecret: string;
  privyJwtVerificationKey: string;
  privyApiTimeoutMs: number;
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
  };
}
