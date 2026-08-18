import { resetPasswordAction } from "@/app/actions/auth";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return <ResetPasswordForm requestAction={resetPasswordAction} initialError={params.error} />;
}
