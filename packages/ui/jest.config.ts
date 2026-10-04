import type { Config } from "jest";

const config: Config = {
  displayName: "ui",
  testEnvironment: "node",
  roots: ["<rootDir>/tokens", "<rootDir>/src"],
  moduleFileExtensions: ["js", "json", "ts", "tsx"],
  transform: {
    "^.+\.tsx?$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.test.json" }],
  },
};

export default config;
