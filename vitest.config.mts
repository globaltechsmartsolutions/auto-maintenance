import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./src/test/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      /**
       * Everything that decides something: domain rules, tenant scoping,
       * authorisation, the AI gate, the assignment engine, and the HTTP error
       * contract. Thin adapters over an external SDK are excluded below rather
       * than tested with mocks that only assert the mock.
       */
      include: [
        "src/lib/wia-control/**/*.ts",
        "src/lib/ai/**/*.ts",
        "src/lib/assignment/**/*.ts",
        "src/lib/auth/**/*.ts",
        "src/lib/http/**/*.ts",
        "src/lib/observability.ts",
        "src/lib/utils.ts",
        "src/lib/demo-mode.ts",
        "src/lib/offline-clock-queue.ts",
      ],
      exclude: [
        "src/**/*.test.ts",
        // Browser-only IndexedDB adapter; covered by the Playwright offline spec.
        "src/lib/offline-clock-queue-db.ts",
      ],
      thresholds: {
        statements: 75,
        branches: 62,
        functions: 78,
        lines: 75,
      },
    },
  },
});
