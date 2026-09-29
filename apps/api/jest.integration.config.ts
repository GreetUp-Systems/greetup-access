import type { Config } from "jest";

const config: Config = {
  preset: "../../jest.preset.cjs",
  displayName: "api-integration",
  roots: ["<rootDir>/test"],
  testMatch: ["**/*.integration.spec.ts"],
};

export default config;
