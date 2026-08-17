"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  FileText,
  Lightbulb,
  Mail,
  MapPin,
  Phone,
  Plus,
} from "lucide-react";
import { DemoActionButton, DemoCustomerNotes } from "@/components/demo/demo-widgets";
import { useDemo } from "@/components/demo/demo-provider";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { customerPlaybook } from "@/lib/mock-data";
import { formatCurrency, formatDate } from "@/lib/format";

export function DemoCustomerProfile({ customerId }: { customerId: string }) {
  const { customers, invoices, services } = useDemo();
  const customer = customers.find((item) => item.id === customerId);

  if (!customer) {
    return (
      <Card className="border-border/70 bg-card/85 shadow-sm">
        <CardContent className="flex min-h-56 flex-col items-center justify-center gap-3 text-center">
          <p className="text-lg font-semibold">Customer not found</p>
          <p className="max-w-md text-sm text-muted-foreground">
            The lead, service, or booking that created this profile may have been deleted.
          </p>
          <Button asChild>
            <Link href="/crm">
              <ArrowLeft className="size-4" />
              Back to CRM
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const customerServices = services.filter((service) => service.customer === customer.name);
  const customerInvoices = invoices.filter((invoice) => invoice.customer === customer.name);
  const playbook =
    customerPlaybook[customer.id as keyof typeof customerPlaybook] ?? {
      nextAction: "Confirm availability and convert the request into a recurring service.",
      opportunity: `Recorded operational value: ${formatCurrency(customer.lifetimeValue)}.`,
      risk: `${customer.risk} risk based on invoices, services, and open requests.`,
      internalNote: "Profile generated automatically from live demo data.",
    };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <Button variant="ghost" asChild className="mb-3 px-0">
            <Link href="/crm">
              <ArrowLeft className="size-4" />
              CRM
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold">{customer.name}</h1>
            <StatusBadge status={customer.status} />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {customer.type} · risk {customer.risk}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <DemoActionButton
            action="new-quote"
            variant="outline"
            payload={{ customer: customer.name }}
          >
            <FileText className="size-4" />
            Quote
          </DemoActionButton>
          <DemoActionButton action="new-service" payload={{ customer: customer.name }}>
            <Plus className="size-4" />
            Service
          </DemoActionButton>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-border/70 bg-card/85 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Customer profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="size-4 text-muted-foreground" />
                {customer.email}
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Phone className="size-4 text-muted-foreground" />
                {customer.phone}
              </div>
              <div className="flex items-center gap-2 text-sm sm:col-span-2">
                <MapPin className="size-4 text-muted-foreground" />
                {customer.address}
              </div>
            </div>
            <Separator />
            <div className="flex flex-wrap gap-2">
              {customer.tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">{customer.notes}</p>
            <div className="rounded-md border border-border/70 bg-background/50 p-3">
              <p className="text-xs uppercase text-muted-foreground">Recorded value</p>
              <p className="mt-1 text-2xl font-semibold">
                {formatCurrency(customer.lifetimeValue)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/85 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lightbulb className="size-4 text-primary" />
              Next best action
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-3 rounded-md border border-border/70 bg-background/50 p-3 text-sm">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Recommended action</p>
                <p className="mt-1 font-medium">{playbook.nextAction}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Opportunity</p>
                  <p className="mt-1 text-muted-foreground">{playbook.opportunity}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Risk</p>
                  <p className="mt-1 text-muted-foreground">{playbook.risk}</p>
                </div>
              </div>
              <p className="text-muted-foreground">{playbook.internalNote}</p>
            </div>
            <DemoCustomerNotes customerName={customer.name} />
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="history" className="space-y-4">
        <TabsList>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
        </TabsList>

        <TabsContent value="history">
          <Card className="border-border/70 bg-card/85 shadow-sm">
            <CardContent className="space-y-3 p-4">
              {customer.serviceHistory.map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-3 rounded-md border border-border/70 bg-background/50 p-3 text-sm"
                >
                  <CalendarDays className="size-4 text-primary" />
                  {item}
                </div>
              ))}
              {customer.serviceHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground">No operational history yet.</p>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="services">
          <div className="grid gap-4 lg:grid-cols-2">
            {customerServices.map((service) => (
              <Card key={service.id} className="border-border/70 bg-card/85">
                <CardHeader>
                  <CardTitle className="text-base">{service.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <StatusBadge status={service.status} />
                  <p className="text-muted-foreground">
                    {formatDate(service.start)} · {service.team.join(", ")}
                  </p>
                  <p className="font-medium">
                    {formatCurrency(service.price * (1 + service.vatRate / 100))}
                  </p>
                </CardContent>
              </Card>
            ))}
            {customerServices.length === 0 ? (
              <p className="text-sm text-muted-foreground">No linked services.</p>
            ) : null}
          </div>
        </TabsContent>

        <TabsContent value="invoices">
          <div className="grid gap-4 lg:grid-cols-2">
            {customerInvoices.map((invoice) => (
              <Card key={invoice.id} className="border-border/70 bg-card/85">
                <CardHeader>
                  <CardTitle className="text-base">{invoice.number}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <StatusBadge status={invoice.status} />
                  <p className="text-muted-foreground">
                    Vencimiento {formatDate(invoice.dueDate)}
                  </p>
                  <p className="font-medium">{formatCurrency(invoice.total)}</p>
                </CardContent>
              </Card>
            ))}
            {customerInvoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">No linked invoices.</p>
            ) : null}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
