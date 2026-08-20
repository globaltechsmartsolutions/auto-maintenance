import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  findUnique: vi.fn(),
}));

vi.mock("@/lib/demo-mode", () => ({
  hasSupabaseConfig: () => true,
  isDemoMode: () => false,
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: mocks.getUser },
  }),
}));
vi.mock("@/lib/prisma", () => ({
  getPrisma: () => ({ user: { findUnique: mocks.findUnique } }),
}));

import { requireApiRole } from "@/lib/auth/api-auth";

describe("requireApiRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "supabase-user" } }, error: null });
  });

  it("rejects a disabled profile even when its Supabase session is still valid", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "user-1",
      companyId: "company-1",
      role: "EMPLOYEE",
      status: "DISABLED",
    });

    const result = await requireApiRole(["EMPLOYEE"]);

    expect(result.response?.status).toBe(403);
  });

  it("allows an active profile with an authorised role", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "user-1",
      companyId: "company-1",
      role: "EMPLOYEE",
      status: "ACTIVE",
    });

    const result = await requireApiRole(["EMPLOYEE"]);

    expect(result).toMatchObject({ profile: { id: "user-1", status: "ACTIVE" } });
  });
});
