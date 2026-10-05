import type { Config } from "jest";

const config: Config = {
  displayName: "web",
  testEnvironment: "node",
  roots: ["<rootDir>/app"],
  setupFiles: ["<rootDir>/jest.setup.ts"],
  moduleFileExtensions: ["js", "json", "ts", "tsx"],
  transform: {
    "^.+\.tsx?$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.test.json" }],
  },
};

export default config;
