import { spawnSync } from "node:child_process";

const testDatabaseUrl = "postgresql://test:test@localhost:5433/access_test";
const testRuntimeDatabaseUrl =
  "postgresql://access_runtime:test_runtime@localhost:5433/access_test";
const executable = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const environment = {
  ...process.env,
  DATABASE_URL: testDatabaseUrl,
  DATABASE_URL_DIRECT: testDatabaseUrl,
};

const commands = [
  {
    args: [
      "--dir",
      "../../packages/database",
      "exec",
      "prisma",
      "migrate",
      "deploy",
      "--schema",
      "prisma/schema.prisma",
    ],
    databaseUrl: testDatabaseUrl,
  },
  {
    args: [
      "exec",
      "jest",
      "--config",
      "jest.integration.config.ts",
      "--runInBand",
      "--detectOpenHandles",
    ],
    databaseUrl: testRuntimeDatabaseUrl,
  },
];

for (const { args, databaseUrl } of commands) {
  const result = spawnSync(executable, args, {
    cwd: new URL("..", import.meta.url),
    env: { ...environment, DATABASE_URL: databaseUrl },
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
