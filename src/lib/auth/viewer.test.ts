import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  signOut: vi.fn(),
  findUnique: vi.fn(),
  redirect: vi.fn((target: string) => {
    // Next's redirect throws to abort rendering; the tests rely on that so a
    // rejected profile can never fall through to the return value below it.
    throw new Error(`REDIRECT:${target}`);
  }),
  isDemoMode: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("react", async () => {
  const react = await vi.importActual<typeof import("react")>("react");
  return { ...react, cache: <T,>(fn: T) => fn };
});
vi.mock("@/lib/demo-mode", () => ({ isDemoMode: mocks.isDemoMode }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: mocks.getUser, signOut: mocks.signOut },
  }),
}));
vi.mock("@/lib/prisma", () => ({
  getPrisma: () => ({ user: { findUnique: mocks.findUnique } }),
}));

import { getDashboardViewer } from "@/lib/auth/viewer";

/**
 * The dashboard's own gate. It has to refuse exactly what the API layer
 * refuses: a session is not enough, the profile behind it has to be usable.
 */

const company = { id: "company-1", name: "Northstar Facilities", crmEnabled: false };

function profile(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-1",
    role: "MANAGER",
    status: "ACTIVE",
    firstName: "Rosa",
    lastName: "Gil",
    company,
    companyId: "company-1",
    ...overrides,
  };
}

const originalEnvironment = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isDemoMode.mockReturnValue(false);
  mocks.getUser.mockResolvedValue({ data: { user: { id: "auth-1" } } });
  mocks.findUnique.mockResolvedValue(profile());
});

afterEach(() => {
  process.env = { ...originalEnvironment };
});

describe("dashboard viewer", () => {
  it("admits a coordinator with an active profile in a company", async () => {
    await expect(getDashboardViewer()).resolves.toEqual({
      id: "user-1",
      role: "MANAGER",
      userName: "Rosa Gil",
      companyId: "company-1",
      companyName: "Northstar Facilities",
      crmEnabled: false,
    });
  });

  it("admits the platform administrator, who legitimately has no company", async () => {
    mocks.findUnique.mockResolvedValue(
      profile({ role: "SUPER_ADMIN", company: null, companyId: null })
    );

    await expect(getDashboardViewer()).resolves.toEqual(
      expect.objectContaining({ role: "SUPER_ADMIN", companyId: undefined, companyName: "WIA Administration" })
    );
  });

  it("refuses anybody else who belongs to no company, as the API layer already does", async () => {
    for (const role of ["ADMIN", "MANAGER", "EMPLOYEE"]) {
      mocks.findUnique.mockResolvedValue(profile({ role, company: null, companyId: null }));

      await expect(getDashboardViewer()).rejects.toThrow(/REDIRECT:\/login/);
      expect(mocks.signOut).toHaveBeenCalled();
      mocks.signOut.mockClear();
    }
  });

  it("refuses a session with no profile, an unknown role, or a disabled account", async () => {
    const cases = [null, profile({ role: "OWNER" }), profile({ status: "DISABLED" })];

    for (const record of cases) {
      mocks.findUnique.mockResolvedValue(record);
      await expect(getDashboardViewer()).rejects.toThrow(/REDIRECT:\/login/);
    }
  });

  it("signs the session out before redirecting, so login cannot bounce back", async () => {
    mocks.findUnique.mockResolvedValue(null);

    await expect(getDashboardViewer()).rejects.toThrow(/REDIRECT/);
    expect(mocks.signOut).toHaveBeenCalledOnce();
  });

  it("sends an unauthenticated visitor to log in without touching the database", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });

    await expect(getDashboardViewer()).rejects.toThrow(/REDIRECT:\/login/);
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("only uses the configured demo role in demo mode, never a real lookup", async () => {
    mocks.isDemoMode.mockReturnValue(true);
    process.env.DEMO_ROLE = "MANAGER";

    await expect(getDashboardViewer()).resolves.toEqual(
      expect.objectContaining({ role: "MANAGER", companyName: "CleanWorks Demo Ltd" })
    );
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("falls back to ADMIN when the configured demo role is not a real role", async () => {
    mocks.isDemoMode.mockReturnValue(true);
    process.env.DEMO_ROLE = "OWNER";

    await expect(getDashboardViewer()).resolves.toEqual(expect.objectContaining({ role: "ADMIN" }));
  });
});
