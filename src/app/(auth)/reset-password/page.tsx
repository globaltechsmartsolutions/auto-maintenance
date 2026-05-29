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
      title="Recuperar contraseña"
      description="Te enviaremos un enlace seguro para restablecer el acceso."
      icon={KeyRound}
      action={resetPasswordAction}
      submitLabel="Enviar enlace"
      error={params.error}
      fields={[
        {
          name: "email",
          label: "Correo electrónico",
          type: "email",
          placeholder: "admin@empresa.es",
        },
      ]}
      footerText="¿La recuerdas?"
      footerLabel="Volver al login"
      footerHref="/login"
    />
  );
}
