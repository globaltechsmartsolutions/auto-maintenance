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
      title="Crear empresa"
      description="Configura tu cuenta administradora y activa el espacio de trabajo."
      icon={Building2}
      action={signUpAction}
      submitLabel="Crear workspace"
      error={params.error}
      fields={[
        {
          name: "companyName",
          label: "Empresa",
          placeholder: "Limpiezas Demo SL",
        },
        {
          name: "fullName",
          label: "Nombre completo",
          placeholder: "Alejandro Martín",
        },
        {
          name: "email",
          label: "Correo electrónico",
          type: "email",
          placeholder: "admin@empresa.es",
        },
        {
          name: "password",
          label: "Contraseña",
          type: "password",
          placeholder: "Mínimo 8 caracteres",
        },
      ]}
      footerText="¿Ya tienes cuenta?"
      footerLabel="Entrar"
      footerHref="/login"
    />
  );
}
