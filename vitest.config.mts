import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

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
    // Integration tests need a live database; they run as their own project.
    exclude: [...configDefaults.exclude, "src/**/*.integration.test.ts"],
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
      /**
       * A ratchet, not a target. Each number sits one point under what the
       * suite actually reaches, so coverage can only be raised deliberately
       * and cannot rot quietly: deleting or weakening a test fails CI on the
       * pull request that does it, rather than months later.
       *
       * When the real figures rise, raise these with them in the same commit.
       * Never lower one to make a build pass.
       */
      thresholds: {
        statements: 86,
        branches: 74,
        functions: 88,
        lines: 86,
      },
    },
  },
});
