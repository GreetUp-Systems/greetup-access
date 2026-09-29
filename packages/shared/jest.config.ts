import type { Config } from "jest";

const config: Config = {
  preset: "../../jest.preset.cjs",
  displayName: "shared",
  roots: ["<rootDir>/src"],
};

export default config;
