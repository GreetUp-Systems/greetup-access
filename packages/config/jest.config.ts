import type { Config } from "jest";

const config: Config = {
  preset: "../../jest.preset.cjs",
  displayName: "config",
  roots: ["<rootDir>/src", "<rootDir>/test"],
  testMatch: ["**/*.spec.ts"],
};

export default config;
