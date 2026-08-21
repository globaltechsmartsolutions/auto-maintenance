import { resetPasswordAction } from "@/app/actions/auth";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { readableRecoveryError } from "@/lib/auth/recovery-errors";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; error_code?: string; error_description?: string }>;
}) {
  const params = await searchParams;

  return (
    <ResetPasswordForm
      requestAction={resetPasswordAction}
      initialError={readableRecoveryError(
        params.error_code,
        params.error_description,
        params.error
      )}
    />
  );
}
