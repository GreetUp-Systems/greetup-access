import type { Config } from "jest";

const config: Config = {
  preset: "../../jest.preset.cjs",
  displayName: "api",
  roots: ["<rootDir>/src", "<rootDir>/test"],
  testMatch: ["**/*.spec.ts"],
  testPathIgnorePatterns: ["\\.integration\\.spec\\.ts$"],
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.json" }],
    "^.+\\.js$": "<rootDir>/test/jest-esm-dependency-transformer.cjs",
  },
  transformIgnorePatterns: [
    "node_modules/(?!(@noble|uint8array-extras|smol-toml|commander|eventsource|feaxios|\\.pnpm/(?:@noble\\+|uint8array-extras@|smol-toml@|commander@|eventsource@|feaxios@)))",
  ],
};

export default config;
