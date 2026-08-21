import { describe, expect, it } from "vitest";
import { isRole, roles } from "@/lib/auth/roles";

describe("roles", () => {
  it("recognises exactly the four roles the product defines", () => {
    expect([...roles]).toEqual(["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE"]);
    expect(roles.every((role) => isRole(role))).toBe(true);
  });

  it("rejects anything else, including a plausible-looking role", () => {
    expect(isRole("OWNER")).toBe(false);
    expect(isRole("admin")).toBe(false);
    expect(isRole(undefined)).toBe(false);
    expect(isRole({ role: "ADMIN" })).toBe(false);
  });
});
