"use client";

import * as React from "react";
import Link from "next/link";
import { Filter, Plus, Tag } from "lucide-react";
import { LeadPipeline } from "@/components/crm/lead-pipeline";
import { DemoActionButton } from "@/components/demo/demo-widgets";
import { useDemo, type DemoCustomer } from "@/components/demo/demo-provider";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, formatDate } from "@/lib/format";

function buildSegment(
  name: string,
  customers: DemoCustomer[],
  predicate: (customer: DemoCustomer) => boolean,
  action: string,
  description: string
) {
  const segmentCustomers = customers.filter(predicate);
  const revenue = segmentCustomers.reduce(
    (total, customer) => total + customer.lifetimeValue,
    0
  );
  const active = segmentCustomers.filter((customer) => customer.status === "Activo").length;
  const conversion =
    segmentCustomers.length > 0
      ? `${Math.round((active / segmentCustomers.length) * 100)} %`
      : "0 %";

  return {
    action,
    conversion,
    count: segmentCustomers.length,
    description,
    name,
    revenue,
  };
}

export default function CrmPage() {
  const { customers } = useDemo();
  const customerSegments = React.useMemo(
    () => [
      buildSegment(
        "Premium B2B",
        customers,
        (customer) =>
          customer.tags.includes("Premium") ||
          customer.tags.includes("B2B") ||
          customer.lifetimeValue >= 40000,
        "Priorizar renovaciones y ampliaciones de contrato.",
        "Cuentas con alto valor, oficinas y operaciones recurrentes."
      ),
      buildSegment(
        "Alta prioridad",
        customers,
        (customer) => customer.risk !== "Bajo" || customer.status === "En seguimiento",
        "Revisar seguimiento comercial y cobros pendientes.",
        "Clientes con riesgo, oportunidades abiertas o trabajo pendiente."
      ),
      buildSegment(
        "Comunidades",
        customers,
        (customer) =>
          customer.type === "Comunidad" ||
          customer.tags.includes("Comunidad") ||
          customer.name.toLowerCase().includes("residencial"),
        "Ofrecer cristales, garaje y mantenimiento estacional.",
        "Administradores de fincas y servicios mensuales."
      ),
      buildSegment(
        "Solicitudes web",
        customers,
        (customer) => customer.tags.includes("Reserva web"),
        "Confirmar disponibilidad y convertir en cliente recurrente.",
        "Clientes creados o actualizados desde el formulario público."
      ),
    ],
    [customers]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Ventas y relación cliente</p>
          <h1 className="mt-1 text-3xl font-semibold">CRM comercial</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <DemoActionButton action="filters" variant="outline">
            <Filter className="size-4" />
            Filtros
          </DemoActionButton>
          <DemoActionButton action="new-lead">
            <Plus className="size-4" />
            Nuevo lead
          </DemoActionButton>
        </div>
      </div>

      <Tabs defaultValue="pipeline" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="customers">Clientes</TabsTrigger>
          <TabsTrigger value="segments">Segmentos</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="space-y-4">
          <LeadPipeline />
        </TabsContent>

        <TabsContent value="customers">
          <Card className="border-border/70 bg-card/85 shadow-sm">
            <CardHeader className="gap-4 md:flex-row md:items-center md:justify-between">
              <CardTitle className="text-base">Base de clientes</CardTitle>
              <Input
                placeholder="Buscar por nombre, ciudad, etiqueta..."
                className="max-w-sm"
              />
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Etiquetas</TableHead>
                      <TableHead>Próximo servicio</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customers.map((customer) => (
                      <TableRow key={customer.id}>
                        <TableCell>
                          <Link
                            href={`/crm/${customer.id}`}
                            className="font-medium text-foreground hover:text-primary"
                          >
                            {customer.name}
                          </Link>
                          <div className="text-xs text-muted-foreground">
                            {customer.contact} · {customer.phone}
                          </div>
                        </TableCell>
                        <TableCell>{customer.type}</TableCell>
                        <TableCell>
                          <StatusBadge status={customer.status} />
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {customer.tags.map((tag) => (
                              <Badge key={tag} variant="secondary">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                      <TableCell>
                        {customer.nextService ? formatDate(customer.nextService) : "Pendiente"}
                      </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(customer.lifetimeValue)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="segments">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {customerSegments.map((segment) => (
              <Card
                key={segment.name}
                className="border-border/70 bg-card/85 shadow-sm"
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Tag className="size-4 text-primary" />
                    {segment.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">{segment.description}</p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-md border border-border/70 bg-background/50 p-3">
                      <p className="text-muted-foreground">Clientes</p>
                      <p className="mt-1 font-semibold">{segment.count}</p>
                    </div>
                    <div className="rounded-md border border-border/70 bg-background/50 p-3">
                      <p className="text-muted-foreground">Conversión</p>
                      <p className="mt-1 font-semibold">{segment.conversion}</p>
                    </div>
                  </div>
                  <div className="rounded-md border border-border/70 bg-background/50 p-3 text-sm">
                    <p className="text-muted-foreground">Valor estimado</p>
                    <p className="mt-1 font-semibold">{formatCurrency(segment.revenue)}</p>
                  </div>
                  <div className="rounded-md border border-primary/20 bg-primary/10 p-3 text-sm text-primary">
                    {segment.action}
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
