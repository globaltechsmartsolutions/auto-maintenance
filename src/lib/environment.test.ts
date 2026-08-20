import { afterEach, describe, expect, it } from "vitest";
import { cn, getUtcOffsetString, toIsoWithTimezone } from "@/lib/utils";
import {
  hasDatabaseConfig,
  hasStripeConfig,
  hasSupabaseConfig,
  isDemoMode,
} from "@/lib/demo-mode";

/**
 * The switches that decide whether this deployment is a demo or a real
 * workspace, and the timezone helpers every scheduled time passes through.
 * Both are small and both are load-bearing: a wrong answer here either exposes
 * demo behaviour in production or writes a shift an hour off.
 */

const originalEnvironment = { ...process.env };
afterEach(() => {
  process.env = { ...originalEnvironment };
});

describe("deployment mode", () => {
  it("treats either demo flag as demo, and everything else as production", () => {
    delete process.env.NEXT_PUBLIC_DEMO_MODE;
    delete process.env.DEMO_MODE;
    expect(isDemoMode()).toBe(false);

    process.env.DEMO_MODE = "true";
    expect(isDemoMode()).toBe(true);

    process.env.DEMO_MODE = "false";
    process.env.NEXT_PUBLIC_DEMO_MODE = "true";
    expect(isDemoMode()).toBe(true);

    process.env.NEXT_PUBLIC_DEMO_MODE = "1";
    process.env.DEMO_MODE = "yes";
    // Only the exact string "true" counts: an ambiguous value must not
    // accidentally put a real workspace into demo behaviour.
    expect(isDemoMode()).toBe(false);
  });

  it("reports each external dependency as configured only when it really is", () => {
    delete process.env.DATABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.STRIPE_SECRET_KEY;
    expect([hasDatabaseConfig(), hasSupabaseConfig(), hasStripeConfig()]).toEqual([false, false, false]);

    process.env.DATABASE_URL = "postgresql://localhost/wia";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    // Supabase needs both halves: a URL with no key is not usable auth.
    expect([hasDatabaseConfig(), hasSupabaseConfig(), hasStripeConfig()]).toEqual([true, false, true]);

    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    expect(hasSupabaseConfig()).toBe(true);
  });
});

describe("timezone helpers", () => {
  it("reads the real offset for a zone at a given moment, on both sides of a DST change", () => {
    expect(getUtcOffsetString(new Date("2026-01-15T12:00:00Z"), "Europe/Madrid")).toBe("+01:00");
    expect(getUtcOffsetString(new Date("2026-07-15T12:00:00Z"), "Europe/Madrid")).toBe("+02:00");
    expect(getUtcOffsetString(new Date("2026-07-15T12:00:00Z"), "America/New_York")).toBe("-04:00");
  });

  it("falls back to UTC rather than throwing on an unusable zone", () => {
    expect(getUtcOffsetString(new Date("2026-07-15T12:00:00Z"), "Not/AZone")).toBe("+00:00");
  });

  it("converts a wall-clock time in the company's zone to the right instant", () => {
    expect(toIsoWithTimezone("2026-07-15", "09:00", "Europe/Madrid")).toBe("2026-07-15T07:00:00.000Z");
    expect(toIsoWithTimezone("2026-01-15", "09:00", "Europe/Madrid")).toBe("2026-01-15T08:00:00.000Z");
  });

  it("merges class names, keeping the last conflicting utility", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-sm", false && "hidden", undefined, "font-medium")).toBe("text-sm font-medium");
  });
});
