import { describe, expect, it } from "vitest";
import { can, isRole } from "@/lib/auth/roles";

describe("roles and permissions", () => {
  it("limits company writes to coordinators and administrators", () => {
    expect(can("MANAGER", "company:write")).toBe(true);
    expect(can("EMPLOYEE", "company:write")).toBe(false);
  });

  it("reserves platform management for the super administrator", () => {
    expect(can("SUPER_ADMIN", "platform:write")).toBe(true);
    expect(can("ADMIN", "platform:write")).toBe(false);
  });

  it("rejects unknown roles", () => {
    expect(isRole("OWNER")).toBe(false);
    expect(isRole("EMPLOYEE")).toBe(true);
  });
});
