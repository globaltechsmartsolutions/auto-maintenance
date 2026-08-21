import { describe, expect, it } from "vitest";
import { readableRecoveryError } from "@/lib/auth/recovery-errors";

/**
 * Checklist check 6 of the QA round: a suspended account following a recovery
 * link. The refusal itself belongs to Supabase and is correct; what is tested
 * here is that a person is told what happened rather than shown a code.
 */
describe("password recovery messages", () => {
  it("tells a suspended account that an administrator has to act, not that the link failed", () => {
    const message = readableRecoveryError(
      "user_banned",
      "User is banned",
      "access_denied"
    );
    expect(message).toMatch(/suspended/i);
    expect(message).toMatch(/administrator/i);
    expect(message).not.toMatch(/access_denied|user_banned/);
  });

  it("distinguishes an expired link from a suspended account, because the remedies differ", () => {
    expect(readableRecoveryError("otp_expired", "Email link is invalid or has expired")).toMatch(
      /expired/i
    );
    expect(readableRecoveryError(undefined, "Email link has expired")).toMatch(/expired/i);
  });

  it("gives a plain answer for a link that is merely no longer valid", () => {
    const message = readableRecoveryError("access_denied", undefined, "access_denied");
    expect(message).toMatch(/no longer valid/i);
    expect(message).not.toMatch(/access_denied/);
  });

  it("never reveals whether the address has an account", () => {
    for (const code of ["user_banned", "otp_expired", "access_denied"]) {
      const message = readableRecoveryError(code, undefined, code) ?? "";
      expect(message).not.toMatch(/no account|not found|does not exist|unknown user/i);
    }
  });

  it("prefers the sentence Supabase wrote over the identifier, for a code it does not know", () => {
    expect(readableRecoveryError("some_new_code", "Something specific went wrong")).toBe(
      "Something specific went wrong"
    );
  });

  it("says nothing when there is nothing to say", () => {
    expect(readableRecoveryError()).toBeUndefined();
  });
});
