"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[520px] items-center justify-center">
      <div className="max-w-md text-center">
        <div className="mx-auto flex size-11 items-center justify-center rounded-lg border border-destructive/30 bg-destructive/10 text-destructive">
          <AlertTriangle className="size-5" />
        </div>
        <h2 className="mt-4 text-2xl font-semibold">Algo ha fallado</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Reintenta la carga o revisa la configuración del entorno.
        </p>
        <Button onClick={reset} className="mt-6">
          Reintentar
        </Button>
      </div>
    </div>
  );
}
