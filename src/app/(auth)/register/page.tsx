import { Building2 } from "lucide-react";
import { signUpAction } from "@/app/actions/auth";
import { AuthCard } from "@/components/auth/auth-card";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <AuthCard
      title="Create company"
      description="Set up your administrator account and activate the workspace."
      icon={Building2}
      action={signUpAction}
      submitLabel="Create workspace"
      error={params.error}
      fields={[
        {
          name: "companyName",
          label: "Company",
          placeholder: "CleanWorks Demo Ltd",
        },
        {
          name: "fullName",
          label: "Full name",
          placeholder: "Alejandro Martín",
        },
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
          placeholder: "At least 8 characters",
        },
      ]}
      footerText="Already have an account?"
      footerLabel="Sign in"
      footerHref="/login"
    />
  );
}
