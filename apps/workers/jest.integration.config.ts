import type { Config } from "jest";

const config: Config = {
  preset: "../../jest.preset.cjs",
  displayName: "workers-integration",
  roots: ["<rootDir>/test"],
  testMatch: ["**/*.integration.spec.ts"],
};

export default config;
