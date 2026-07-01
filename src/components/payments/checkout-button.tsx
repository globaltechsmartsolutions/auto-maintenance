"use client";

import * as React from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { useDemo } from "@/components/demo/demo-provider";
import { Button } from "@/components/ui/button";

export function CheckoutButton({
  priceEnv,
  label = "Suscribirse",
}: {
  priceEnv: string;
  label?: string;
}) {
  const [loading, setLoading] = React.useState(false);
  const { notify } = useDemo();

  async function handleCheckout() {
    setLoading(true);
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceEnv }),
      });
      const payload = (await response.json()) as { error?: string; url?: string };

      if (!response.ok) {
        notify("No se pudo abrir Stripe", payload.error ?? "Revisa la configuración.");
        return;
      }

      if (payload.url?.includes("checkout=demo")) {
        notify("Checkout Stripe simulado", "El cambio de plan queda validado para la demo local.");
        return;
      }

      if (payload.url) {
        window.location.href = payload.url;
        return;
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button className="w-full" onClick={handleCheckout} disabled={loading}>
      {loading ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}
      {label}
    </Button>
  );
}
