import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Integration tests: the guarantees that only a real PostgreSQL can prove.
 *
 * Kept in a separate project so `npm test` stays fast and needs no services,
 * and so these can never be skipped quietly — the suite refuses to start
 * without TEST_DATABASE_URL rather than reporting a green run it did not do.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./src/test/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
    // One connection, shared fixtures, truncation between tests.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
