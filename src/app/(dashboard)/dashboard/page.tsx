"use client";

import * as React from "react";
import {
  AlertTriangle,
  CalendarPlus,
  CheckCircle2,
  ClipboardCheck,
  Euro,
  FileClock,
  Handshake,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { DashboardCharts } from "@/components/dashboard/dashboard-charts";
import { MetricCard } from "@/components/dashboard/metric-card";
import {
  DemoActionButton,
  DemoDashboardInvoicesList,
  DemoDashboardServicesTable,
} from "@/components/demo/demo-widgets";
import { useDemo } from "@/components/demo/demo-provider";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";

const metricIcons = [Euro, ClipboardCheck, Users, FileClock, Sparkles, TrendingUp];
const briefIcons = [AlertTriangle, CheckCircle2, Handshake];

export default function DashboardPage() {
  const { customers, employees, invoices, leads, portalRequests, services } = useDemo();
  const dashboardMetrics = React.useMemo(() => {
    const activeServices = services.filter((service) => service.status !== "Cancelado");
    const completedServices = services.filter((service) => service.status === "Completado");
    const paidRevenue = invoices
      .filter((invoice) => invoice.status === "Pagada")
      .reduce((total, invoice) => total + invoice.total, 0);
    const projectedRevenue = activeServices.reduce(
      (total, service) => total + service.price * (1 + service.vatRate / 100),
      0
    );
    const pendingInvoices = invoices.filter((invoice) => invoice.status !== "Pagada");
    const pendingInvoiceTotal = pendingInvoices.reduce(
      (total, invoice) => total + invoice.total,
      0
    );
    const activeCustomers = customers.filter((customer) => customer.status === "Activo");
    const newLeads = leads.filter((lead) => lead.status === "Nuevo");
    const sla =
      activeServices.length > 0
        ? Math.round((completedServices.length / activeServices.length) * 1000) / 10
        : 100;

    return [
      {
        label: "Ingresos mes",
        displayValue: formatCurrency(Math.max(paidRevenue, projectedRevenue)),
        delta: `+${formatCurrency(projectedRevenue)}`,
        helper: "pipeline operativo actualizado",
      },
      {
        label: "Servicios activos",
        displayValue: activeServices.length.toString(),
        delta: `+${portalRequests.length}`,
        helper: "incluye reservas web",
      },
      {
        label: "Clientes activos",
        displayValue: activeCustomers.length.toString(),
        delta: `+${customers.length - activeCustomers.length}`,
        helper: "clientes y leads sincronizados",
      },
      {
        label: "Facturas pendientes",
        displayValue: formatCurrency(pendingInvoiceTotal),
        delta: `${pendingInvoices.length}`,
        helper: "documentos por cobrar",
      },
      {
        label: "Nuevos leads",
        displayValue: newLeads.length.toString(),
        delta: `+${leads.length}`,
        helper: "pipeline comercial vivo",
      },
      {
        label: "SLA completado",
        displayValue: `${sla.toLocaleString("es-ES")} %`,
        delta: `${completedServices.length}`,
        helper: "servicios completados",
      },
    ];
  }, [customers, invoices, leads, portalRequests.length, services]);

  const operationsBrief = React.useMemo(() => {
    const pendingInvoice = invoices.find((invoice) => invoice.status !== "Pagada");
    const unassignedService = services.find((service) =>
      service.team.includes("Equipo por asignar")
    );
    const latestRequest = portalRequests[0];

    return [
      {
        title: pendingInvoice ? "Cerrar factura pendiente" : "Cobros al día",
        customer: pendingInvoice?.customer ?? "Sin incidencias",
        status: pendingInvoice?.status ?? "Completado",
        impact: pendingInvoice ? formatCurrency(pendingInvoice.total) : "Sin deuda crítica",
        helper: pendingInvoice
          ? `Revisar ${pendingInvoice.number} antes del vencimiento.`
          : "La cartera no tiene facturas vencidas relevantes.",
      },
      {
        title: unassignedService ? "Asignar equipo pendiente" : "Equipo cubierto",
        customer: unassignedService?.customer ?? "Operación estable",
        status: unassignedService?.status ?? "Programado",
        impact: unassignedService
          ? `${unassignedService.title} requiere responsable`
          : "Todos los servicios tienen equipo",
        helper: unassignedService
          ? "Usar la recomendación inteligente antes de confirmar al cliente."
          : "No hay servicios sin empleado asignado.",
      },
      {
        title: latestRequest ? "Confirmar reserva web" : "Captación preparada",
        customer: latestRequest?.customer ?? "Portal cliente",
        status: latestRequest?.status ?? "Programado",
        impact: latestRequest
          ? `${latestRequest.title} entra en CRM y calendario`
          : "Formulario público listo para nuevas solicitudes",
        helper: latestRequest
          ? "La solicitud está enlazada a lead, calendario y equipo."
          : "Al enviar una reserva aparecerá aquí automáticamente.",
      },
    ];
  }, [invoices, portalRequests, services]);

  const employeePerformance = React.useMemo(
    () =>
      [...employees]
        .sort((first, second) => second.score - first.score)
        .slice(0, 5)
        .map((employee) => ({
          name: employee.name,
          score: employee.score,
          services: employee.jobs,
        })),
    [employees]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Operación de hoy</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-normal">
            Dashboard ejecutivo
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <DemoActionButton action="export-dashboard" variant="outline">
            <FileClock className="size-4" />
            Exportar
          </DemoActionButton>
          <DemoActionButton action="new-service">
            <CalendarPlus className="size-4" />
            Nuevo servicio
          </DemoActionButton>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {dashboardMetrics.map((metric, index) => {
          const Icon = metricIcons[index] ?? TrendingUp;
          return (
            <MetricCard
              key={metric.label}
              label={metric.label}
              value={metric.displayValue}
              delta={metric.delta}
              helper={metric.helper}
              icon={Icon}
              tone={index === 3 ? "warning" : index === 5 ? "success" : "default"}
            />
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {operationsBrief.map((item, index) => {
          const Icon = briefIcons[index] ?? Sparkles;

          return (
            <Card key={item.title} className="h-full min-h-[218px] border-border/70 bg-card/85 shadow-sm">
              <CardHeader className="min-h-[52px] pb-3">
                <CardTitle className="flex items-start gap-2 text-base">
                  <Icon className="size-4 text-primary" />
                  {item.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col">
                <div className="flex min-h-7 flex-wrap items-center gap-2">
                  <StatusBadge status={item.status} />
                  <span className="text-sm text-muted-foreground">{item.customer}</span>
                </div>
                <p className="mt-3 min-h-5 text-sm font-medium">{item.impact}</p>
                <p className="mt-3 text-sm text-muted-foreground">{item.helper}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <DashboardCharts />

      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <Card className="border-border/70 bg-card/85 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Servicios próximos</CardTitle>
          </CardHeader>
          <CardContent>
            <DemoDashboardServicesTable />
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card className="border-border/70 bg-card/85 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Rendimiento del equipo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {employeePerformance.map((employee) => (
                <div key={employee.name}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{employee.name}</span>
                    <span className="text-muted-foreground">
                      {employee.score}/100 · {employee.services} servicios
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${employee.score}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/85 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Cobros sensibles</CardTitle>
            </CardHeader>
            <CardContent>
              <DemoDashboardInvoicesList />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
