"use client";

import * as React from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { useDemo } from "@/components/demo/demo-provider";
import { Button } from "@/components/ui/button";

export function CheckoutButton({
  plan,
  label = "Suscribirse",
}: {
  plan: "STARTER" | "GROWTH" | "SCALE";
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
        body: JSON.stringify({ plan }),
      });
      const payload = (await response.json()) as { error?: string; url?: string };

      if (!response.ok) {
        notify("Unable to open Stripe", payload.error ?? "Review the configuration.");
        return;
      }

      if (payload.url?.includes("checkout=demo")) {
        notify("Stripe Checkout simulated", "The plan change has been validated for the local demo.");
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
