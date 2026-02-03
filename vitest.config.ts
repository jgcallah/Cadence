import { defineConfig } from "vitest/config";
import * as path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@cadence/core": path.resolve(__dirname, "./packages/core/src/index.ts"),
      "@cadence/cli": path.resolve(__dirname, "./packages/cli/src/index.ts"),
      "@cadence/mcp": path.resolve(__dirname, "./packages/mcp/src/index.ts"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    testTimeout: 10000, // Increase timeout for slow module imports
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "dist/",
        "**/*.config.ts",
        "**/*.d.ts",
        "**/index.ts",
      ],
    },
    projects: [
      {
        test: {
          name: "unit",
          include: ["packages/**/*.{test,spec}.ts"],
          exclude: [
            "**/node_modules/**",
            "**/dist/**",
            "**/*.integration.{test,spec}.ts",
          ],
        },
      },
      {
        test: {
          name: "integration",
          include: ["packages/**/*.integration.{test,spec}.ts"],
          exclude: ["**/node_modules/**", "**/dist/**"],
        },
      },
    ],
  },
});
