import { AlertTriangle, CreditCard, Landmark, ShieldCheck } from "lucide-react";
import { CheckoutButton } from "@/components/payments/checkout-button";
import { StatusBadge } from "@/components/shared/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { invoices, subscriptionPlans } from "@/lib/mock-data";
import { formatCurrency } from "@/lib/format";

export default function PaymentsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Stripe y suscripciones</p>
          <h1 className="mt-1 text-3xl font-semibold">Pagos</h1>
        </div>
        <Button variant="outline">
          <Landmark className="size-4" />
          Portal de facturación
        </Button>
      </div>

      <Alert className="border-warning/35 bg-warning/10">
        <AlertTriangle className="size-4 text-warning" />
        <AlertTitle>Pago fallido detectado</AlertTitle>
        <AlertDescription>
          EcoHogar Madrid tiene una renovación pendiente. La automatización de
          recuperación está pausada.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 lg:grid-cols-3">
        {subscriptionPlans.map((plan) => (
          <Card
            key={plan.name}
            className="border-border/70 bg-card/85 shadow-sm data-[highlighted=true]:border-primary/50"
            data-highlighted={plan.highlighted}
          >
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-lg">{plan.name}</CardTitle>
                {plan.highlighted ? <Badge>Actual</Badge> : null}
              </div>
              <div>
                <span className="text-3xl font-semibold">{plan.price}</span>
                <span className="text-sm text-muted-foreground">/mes</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{plan.description}</p>
              <Separator />
              <ul className="space-y-2 text-sm">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2">
                    <ShieldCheck className="size-4 text-primary" />
                    {feature}
                  </li>
                ))}
              </ul>
              <CheckoutButton
                priceEnv={plan.priceEnv}
                label={plan.highlighted ? "Gestionar plan" : "Cambiar plan"}
              />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/70 bg-card/85 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="size-4 text-primary" />
            Historial de pagos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {invoices.map((invoice) => (
            <div
              key={invoice.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border/70 bg-background/50 p-3"
            >
              <div>
                <p className="text-sm font-medium">{invoice.customer}</p>
                <p className="text-xs text-muted-foreground">{invoice.number}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">
                  {formatCurrency(invoice.total)}
                </p>
                <StatusBadge status={invoice.status} className="mt-1" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
