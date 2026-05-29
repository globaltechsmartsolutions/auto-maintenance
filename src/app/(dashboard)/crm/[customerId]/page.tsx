import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  FileText,
  Lightbulb,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  customerPlaybook,
  customers,
  invoices,
  services,
} from "@/lib/mock-data";
import { formatCurrency, formatDate } from "@/lib/format";

export default async function CustomerProfilePage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;
  const customer = customers.find((item) => item.id === customerId);

  if (!customer) {
    notFound();
  }

  const customerServices = services.filter(
    (service) => service.customer === customer.name
  );
  const customerInvoices = invoices.filter(
    (invoice) => invoice.customer === customer.name
  );
  const playbook = customerPlaybook[customer.id as keyof typeof customerPlaybook];

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
            {customer.type} · riesgo {customer.risk}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline">
            <FileText className="size-4" />
            Presupuesto
          </Button>
          <Button>
            <Plus className="size-4" />
            Servicio
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-border/70 bg-card/85 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Ficha del cliente</CardTitle>
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
              <p className="text-xs uppercase text-muted-foreground">
                Valor histórico
              </p>
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
              Siguiente mejor acción
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {playbook ? (
              <div className="space-y-3 rounded-md border border-border/70 bg-background/50 p-3 text-sm">
                <div>
                  <p className="text-xs uppercase text-muted-foreground">
                    Acción recomendada
                  </p>
                  <p className="mt-1 font-medium">{playbook.nextAction}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">
                      Oportunidad
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      {playbook.opportunity}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">
                      Riesgo
                    </p>
                    <p className="mt-1 text-muted-foreground">{playbook.risk}</p>
                  </div>
                </div>
                <p className="text-muted-foreground">{playbook.internalNote}</p>
              </div>
            ) : null}
            <Textarea
              placeholder="Añadir nota comercial u operativa"
              className="min-h-28"
            />
            <Button className="w-full">
              <MessageSquare className="size-4" />
              Guardar nota
            </Button>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="history" className="space-y-4">
        <TabsList>
          <TabsTrigger value="history">Historial</TabsTrigger>
          <TabsTrigger value="services">Servicios</TabsTrigger>
          <TabsTrigger value="invoices">Facturas</TabsTrigger>
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
                  <p className="font-medium">{formatCurrency(service.price)}</p>
                </CardContent>
              </Card>
            ))}
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
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
