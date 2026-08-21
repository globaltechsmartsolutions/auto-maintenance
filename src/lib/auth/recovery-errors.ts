/**
 * Turning Supabase's recovery codes into something a person can act on.
 *
 * Supabase sends somebody back to the reset screen with machine-readable codes
 * in the query string. Showing those verbatim produced a screen that said
 * nothing but `access_denied`, which tells a person neither what happened nor
 * what to do about it.
 *
 * Two rules hold across every case below. Refusing a suspended account is
 * correct and stays: a suspension that a password reset can undo is not a
 * suspension. And nothing here reveals whether an address has an account —
 * these messages are only ever reached by following a link that already
 * proves it.
 */
export function readableRecoveryError(
  code?: string,
  description?: string,
  error?: string
): string | undefined {
  if (code === "user_banned") {
    return "This account is suspended, so its password cannot be reset. An administrator has to restore access first.";
  }
  if (code === "otp_expired" || description?.toLowerCase().includes("expired")) {
    return "That link has expired. Request a new one below and use the most recent email.";
  }
  if (code === "access_denied" || error === "access_denied") {
    return "That link is no longer valid. Request a new one below.";
  }
  // An unrecognised code is still better read than shown: prefer the sentence
  // Supabase wrote over the identifier it wrote it for.
  return description ?? error;
}
