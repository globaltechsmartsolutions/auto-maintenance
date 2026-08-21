export const roles = ["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE"] as const;

export type Role = (typeof roles)[number];

/**
 * Authorisation is not expressed here.
 *
 * Every route states the roles it accepts, explicitly, at its own entry point
 * (`requireWiaApiContext([...])`), and every service function re-checks the
 * rule it cares about. That is deliberately more repetitive than a central
 * permission table, and deliberately harder to get silently wrong: a reader of
 * any endpoint can see who may call it without holding a second file in their
 * head, and a new capability cannot inherit access by accident.
 *
 * This module only answers "is this string one of our four roles".
 */
export function isRole(value: unknown): value is Role {
  return typeof value === "string" && roles.includes(value as Role);
}
