import { KeyRound } from "lucide-react";
import { resetPasswordAction } from "@/app/actions/auth";
import { AuthCard } from "@/components/auth/auth-card";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <AuthCard
      title="Reset password"
      description="We will send you a secure link to restore access."
      icon={KeyRound}
      action={resetPasswordAction}
      submitLabel="Send link"
      error={params.error}
      fields={[
        {
          name: "email",
          label: "Email address",
          type: "email",
          placeholder: "admin@company.com",
        },
      ]}
      footerText="Remember it?"
      footerLabel="Back to sign in"
      footerHref="/login"
    />
  );
}
