import type { Config } from "jest";

// @stellar/stellar-sdk pulls ESM-only dependencies; they are transpiled like in the API.
const config: Config = {
  preset: "../../jest.preset.cjs",
  displayName: "workers",
  roots: ["<rootDir>/src"],
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.json" }],
    "^.+\\.js$": "<rootDir>/../../jest.esm-dependency-transformer.cjs",
  },
  transformIgnorePatterns: [
    "node_modules/(?!(@noble|uint8array-extras|smol-toml|commander|eventsource|feaxios|\\.pnpm/(?:@noble\\+|uint8array-extras@|smol-toml@|commander@|eventsource@|feaxios@)))",
  ],
};

export default config;
