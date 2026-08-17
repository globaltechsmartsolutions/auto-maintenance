"use client";

import * as React from "react";
import {
  AlertTriangle,
  CreditCard,
  Landmark,
  ReceiptText,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { DemoActionButton } from "@/components/demo/demo-widgets";
import { useDemo } from "@/components/demo/demo-provider";
import { CheckoutButton } from "@/components/payments/checkout-button";
import { StatusBadge } from "@/components/shared/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { subscriptionPlans } from "@/lib/mock-data";
import { formatCurrency } from "@/lib/format";

export default function PaymentsPage() {
  const { invoices } = useDemo();
  const { collected, overdue, pending } = React.useMemo(
    () => ({
      collected: invoices
        .filter((invoice) => invoice.status === "Paid")
        .reduce((total, invoice) => total + invoice.total, 0),
      pending: invoices
        .filter((invoice) => invoice.status === "Pending")
        .reduce((total, invoice) => total + invoice.total, 0),
      overdue: invoices
        .filter((invoice) => invoice.status === "Overdue")
        .reduce((total, invoice) => total + invoice.total, 0),
    }),
    [invoices]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Payments, Stripe, and billing</p>
          <h1 className="mt-1 text-3xl font-semibold">Payments</h1>
        </div>
      </div>

      <Tabs defaultValue="customer-payments" className="space-y-4">
        <TabsList>
          <TabsTrigger value="customer-payments">Customer payments</TabsTrigger>
          <TabsTrigger value="subscription">SaaS subscription</TabsTrigger>
        </TabsList>

        <TabsContent value="customer-payments" className="space-y-4">
          <Alert className="border-warning/35 bg-warning/10">
            <AlertTriangle className="size-4 text-warning" />
            <AlertTitle>Failed payment detected</AlertTitle>
            <AlertDescription>
              EcoHogar Madrid has a pending renewal. The payment recovery
              automation is paused.
            </AlertDescription>
          </Alert>

          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-border/70 bg-card/85 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <WalletCards className="size-4 text-primary" />
                  Collected
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{formatCurrency(collected)}</p>
                <p className="text-sm text-muted-foreground">paid invoices</p>
              </CardContent>
            </Card>
            <Card className="border-border/70 bg-card/85 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ReceiptText className="size-4 text-primary" />
                  Pending
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{formatCurrency(pending)}</p>
                <p className="text-sm text-muted-foreground">awaiting payment</p>
              </CardContent>
            </Card>
            <Card className="border-border/70 bg-card/85 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="size-4 text-warning" />
                  Overdue
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{formatCurrency(overdue)}</p>
                <p className="text-sm text-muted-foreground">requires follow-up</p>
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/70 bg-card/85 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CreditCard className="size-4 text-primary" />
                Payment history
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
                    <p className="text-sm font-medium">{formatCurrency(invoice.total)}</p>
                    <StatusBadge status={invoice.status} className="mt-1" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subscription" className="space-y-4">
          <Card className="border-border/70 bg-card/85 shadow-sm">
            <CardHeader className="gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="text-base">WIA Control subscription</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  SaaS plan management, plan changes, and billing portal.
                </p>
              </div>
              <DemoActionButton action="billing-portal" variant="outline">
                <Landmark className="size-4" />
                Portal Stripe
              </DemoActionButton>
            </CardHeader>
          </Card>

          <div className="grid gap-4 lg:grid-cols-3">
            {subscriptionPlans.map((plan) => (
              <Card
                key={plan.name}
                className="flex h-full flex-col border-border/70 bg-card/85 shadow-sm data-[highlighted=true]:border-primary/50"
                data-highlighted={plan.highlighted}
              >
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                    {plan.highlighted ? <Badge>Current</Badge> : null}
                  </div>
                  <div>
                    <span className="text-3xl font-semibold">{plan.price}</span>
                    <span className="text-sm text-muted-foreground">/month</span>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col space-y-4">
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
                  <div className="mt-auto pt-2">
                    <CheckoutButton
                      plan={plan.code}
                      label={plan.highlighted ? "Manage plan" : "Change plan"}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
