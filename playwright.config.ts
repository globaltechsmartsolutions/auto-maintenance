import { config } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

config({ path: ".env.local" });
config();

/**
 * Playwright E2E configuration (playbook Section 16, browser end-to-end layer).
 *
 * These tests run against a REAL, non-demo environment (staging) with real
 * Supabase accounts — they are not compatible with NEXT_PUBLIC_DEMO_MODE=true.
 * Required environment variables are documented in `e2e/README.md`.
 *
 * These are intentionally NOT part of `npm run preprod:verify`: they need a
 * reachable staging database and live test accounts, which CI does not have
 * configured by default. Run them explicitly with `npm run test:e2e` against
 * a staging deployment, or point PLAYWRIGHT_BASE_URL at a local `npm run dev`
 * that is already connected to staging Supabase/Postgres.
 */
export default defineConfig({
    testDir: "./e2e",
    fullyParallel: false, // tests share staging data; avoid cross-test races
    forbidOnly: !!process.env.CI,
    // This staging environment has a known intermittent network issue
    // (documented in the Stage 1 record as "local network TLS interception")
    // that occasionally makes individual database calls take much longer
    // than normal. One retry helps distinguish a real failure from that
    // known, already-tracked slowness rather than making every run flaky.
    retries: 1,
    workers: 1,
    reporter: [["html", { open: "never" }], ["list"]],
    timeout: 60_000,
    expect: {
        timeout: 20_000,
    },
    use: {
        baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
        trace: "on-first-retry",
        screenshot: "only-on-failure",
    },
    projects: [
        {
            name: "desktop-chromium",
            use: { ...devices["Desktop Chrome"] },
        },
        {
            name: "mobile-chromium",
            use: { ...devices["Pixel 7"] },
        },
    ],
});
