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
      title="Acceso a LimpiaPro"
      description="Gestiona clientes, servicios, cobros y equipos desde un único panel."
      icon={LogIn}
      action={signInAction}
      submitLabel="Entrar"
      error={params.error}
      message={params.message === "reset-sent" ? "Revisa tu correo." : undefined}
      fields={[
        {
          name: "email",
          label: "Correo electrónico",
          type: "email",
          placeholder: "admin@empresa.es",
          defaultValue: "demo@limpiapro.es",
        },
        {
          name: "password",
          label: "Contraseña",
          type: "password",
          placeholder: "********",
          defaultValue: "demo-local",
        },
      ]}
      footerText="¿No tienes cuenta?"
      footerLabel="Crear cuenta"
      footerHref="/register"
    />
  );
}
