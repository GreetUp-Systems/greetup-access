import type { Config } from "jest";

const config: Config = {
  preset: "../../jest.preset.cjs",
  displayName: "redis",
  roots: ["<rootDir>/src"],
};

export default config;
