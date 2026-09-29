import type { Config } from "jest";

const config: Config = {
  preset: "../../jest.preset.cjs",
  displayName: "database",
  roots: ["<rootDir>/src", "<rootDir>/test"],
  testMatch: ["**/*.spec.ts"],
  testPathIgnorePatterns: ["\\.integration\\.spec\\.ts$"],
};

export default config;
