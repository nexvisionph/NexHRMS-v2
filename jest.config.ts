import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

const config: Config = {
  testEnvironment: "node",
  setupFilesAfterEnv: ["<rootDir>/src/__tests__/setup.ts"],
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" },
  testMatch: ["<rootDir>/src/__tests__/**/*.test.ts"],
  collectCoverageFrom: [
    "src/lib/**/*.ts",
    "src/services/**/*.ts",
    "src/store/**/*.ts",
    "src/app/api/**/*.ts",
    "!src/**/*.d.ts",
  ],
  coverageThreshold: {
    global: {
      branches: 8,
      functions: 15,
      lines: 10,
      statements: 10,
    },
  },
  // Test timeout for async operations
  testTimeout: 10000,
  // Clear mocks between tests
  clearMocks: true,
  // Verbose output for debugging
  verbose: true,
};

export default createJestConfig(config);
