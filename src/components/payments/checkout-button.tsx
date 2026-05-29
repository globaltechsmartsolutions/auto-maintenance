"use client";

import * as React from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CheckoutButton({
  priceEnv,
  label = "Suscribirse",
}: {
  priceEnv: string;
  label?: string;
}) {
  const [loading, setLoading] = React.useState(false);

  async function handleCheckout() {
    setLoading(true);
    const response = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceEnv }),
    });
    const payload = (await response.json()) as { url?: string };

    if (payload.url) {
      window.location.href = payload.url;
      return;
    }

    setLoading(false);
  }

  return (
    <Button className="w-full" onClick={handleCheckout} disabled={loading}>
      {loading ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}
      {label}
    </Button>
  );
}
