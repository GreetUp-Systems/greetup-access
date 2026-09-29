import { spawnSync } from "node:child_process";

const testDatabaseUrl = "postgresql://test:test@localhost:5433/access_test";
const executable = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const environment = {
  ...process.env,
  DATABASE_URL: testDatabaseUrl,
  DATABASE_URL_DIRECT: testDatabaseUrl,
};

for (const args of [
  [
    "--dir",
    "../../packages/database",
    "exec",
    "prisma",
    "migrate",
    "deploy",
    "--schema",
    "prisma/schema.prisma",
  ],
  [
    "exec",
    "jest",
    "--config",
    "jest.integration.config.ts",
    "--runInBand",
    "--detectOpenHandles",
  ],
]) {
  const result = spawnSync(executable, args, {
    cwd: new URL("..", import.meta.url),
    env: environment,
    shell: process.platform === "win32",
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
