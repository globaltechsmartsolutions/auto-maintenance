import { resetPasswordAction } from "@/app/actions/auth";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

/**
 * Supabase sends a person back here with its own machine-readable codes in the
 * query string. Showing those verbatim produced screens that said nothing but
 * `access_denied`, which tells somebody neither what happened nor what to do.
 *
 * Each case below is a real state a person can reach, phrased as what they
 * should do next. Nothing here reveals whether an address has an account: a
 * banned user only sees this after following a link that already proves it.
 */
function readableError(code?: string, description?: string, error?: string) {
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

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; error_code?: string; error_description?: string }>;
}) {
  const params = await searchParams;

  return (
    <ResetPasswordForm
      requestAction={resetPasswordAction}
      initialError={readableError(params.error_code, params.error_description, params.error)}
    />
  );
}
