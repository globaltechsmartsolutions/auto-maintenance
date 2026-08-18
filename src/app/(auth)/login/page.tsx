import { LogIn } from "lucide-react";
import { AuthCard } from "@/components/auth/auth-card";
import { signInAction } from "@/app/actions/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const params = await searchParams;

  return (
    <AuthCard
      title="Sign in to WIA Control"
      description="Manage customers, services, payments, and teams from one workspace."
      icon={LogIn}
      action={signInAction}
      submitLabel="Sign in"
      error={params.error}
      message={params.message === "reset-sent" ? "Check your email." : undefined}
      fields={[
        {
          name: "email",
          label: "Email address",
          type: "email",
          placeholder: "admin@company.com",
        },
        {
          name: "password",
          label: "Password",
          type: "password",
          placeholder: "********",
        },
      ]}
      secondaryLink={{ label: "Forgot password?", href: "/reset-password" }}
      footerText="Don't have an account?"
      footerLabel="Create account"
      footerHref="/register"
    />
  );
}