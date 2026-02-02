import { defineConfig } from "vitest/config";
import summaryReporter from "./tests/config/vitest-reporter-summary.js";

export default defineConfig({
  test: {
    include: ["tests/**/*.{test,spec}.js"],
    exclude: ["tests/e2e/**"],
    environment: "node",
    reporters: ["basic", summaryReporter],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "./coverage"
    }
  }
});
