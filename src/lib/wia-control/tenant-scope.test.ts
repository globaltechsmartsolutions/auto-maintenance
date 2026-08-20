import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  employee: { findUnique: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ getPrisma: () => ({ employee: mocks.employee }) }));

import { resolveWiaActor } from "@/lib/wia-control/api-actor";
import { companyScope, resolveCompanyId, type ApiProfile } from "@/lib/auth/api-auth";

/**
 * How a request becomes a tenant-scoped actor. This is the single point where
 * "which company am I acting on" is decided, so it is tested on its own rather
 * than through a route.
 */

function profile(overrides: Partial<ApiProfile> = {}): ApiProfile {
  return { id: "user-1", companyId: "company-1", role: "MANAGER", status: "ACTIVE", ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.employee.findUnique.mockResolvedValue(null);
});

describe("actor resolution", () => {
  it("binds an ordinary user to their own company, ignoring any requested one", async () => {
    const actor = await resolveWiaActor(profile(), "company-someone-else");
    expect(actor).toEqual({
      companyId: "company-1",
      userId: "user-1",
      employeeId: undefined,
      role: "MANAGER",
    });
  });

  it("lets a super admin act on the company they asked for", async () => {
    const actor = await resolveWiaActor(profile({ role: "SUPER_ADMIN", companyId: null }), "company-2");
    expect(actor.companyId).toBe("company-2");
  });

  it("refuses a super admin who named no company, rather than guessing one", async () => {
    await expect(
      resolveWiaActor(profile({ role: "SUPER_ADMIN", companyId: null }))
    ).rejects.toThrow(/Select a company/);
  });

  it("attaches the employee profile, which is what limits a field worker to their own shifts", async () => {
    mocks.employee.findUnique.mockResolvedValue({ id: "employee-9" });
    const actor = await resolveWiaActor(profile({ role: "EMPLOYEE" }));
    expect(actor.employeeId).toBe("employee-9");
    expect(mocks.employee.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1" } })
    );
  });

  it("falls back to the demo actor only when there is no profile at all", async () => {
    expect(await resolveWiaActor(null)).toEqual({
      companyId: "demo-company",
      role: "ADMIN",
      userId: "demo-user",
    });
  });
});

describe("company scoping helpers", () => {
  it("scopes an ordinary user to their company and leaves a super admin unscoped", () => {
    expect(companyScope(profile())).toEqual({ companyId: "company-1" });
    expect(companyScope(profile({ role: "SUPER_ADMIN" }))).toEqual({});
    expect(companyScope(null)).toEqual({});
  });

  it("never resolves to an empty scope for a user with no company", () => {
    expect(companyScope(profile({ companyId: null }))).toEqual({ companyId: "__missing_company__" });
    expect(resolveCompanyId(profile({ companyId: null }), "company-2")).toBe("__missing_company__");
  });

  it("honours a requested company only for a super admin", () => {
    expect(resolveCompanyId(profile(), "company-2")).toBe("company-1");
    expect(resolveCompanyId(profile({ role: "SUPER_ADMIN" }), "company-2")).toBe("company-2");
  });
});
