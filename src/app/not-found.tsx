import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="text-sm text-muted-foreground">404</p>
        <h1 className="mt-2 text-3xl font-semibold">Página no encontrada</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          La ruta solicitada no existe o no está disponible para tu rol.
        </p>
        <Button asChild className="mt-6">
          <Link href="/dashboard">Volver al dashboard</Link>
        </Button>
      </div>
    </main>
  );
}
