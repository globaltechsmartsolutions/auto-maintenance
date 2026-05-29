export const roles = ["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE"] as const;

export type Role = (typeof roles)[number];

const permissions = {
  SUPER_ADMIN: [
    "platform:read",
    "platform:write",
    "company:read",
    "company:write",
    "billing:write",
  ],
  ADMIN: ["company:read", "company:write", "billing:write"],
  MANAGER: ["company:read", "company:write"],
  EMPLOYEE: ["company:read"],
} satisfies Record<Role, string[]>;

export function can(role: Role, permission: string) {
  return permissions[role].includes(permission);
}

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && roles.includes(value as Role);
}
