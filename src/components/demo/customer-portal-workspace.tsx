"use client";

import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CalendarCheck2,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  MapPin,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
  WalletCards,
} from "lucide-react";
import { DemoActionButton, useDemo } from "@/components/demo/demo-provider";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/format";

const portalSteps = [
  {
    title: "Solicitud recibida",
    description: "El cliente envía una petición desde su zona privada.",
  },
  {
    title: "Lead creado",
    description: "La oportunidad entra en el CRM con datos de contacto y valor.",
  },
  {
    title: "Calendario actualizado",
    description: "El servicio queda programado para la fecha solicitada.",
  },
  {
    title: "Equipo asignado",
    description: "El sistema selecciona empleados disponibles para ejecutarlo.",
  },
];

export function CustomerPortalWorkspace() {
  const { downloadDocument, invoices, portalRequests, services } = useDemo();
  const portalCustomer = "Atrium Labs";
  const customerServices = services.filter((service) => service.customer === portalCustomer);
  const customerInvoices = invoices.filter((invoice) => invoice.customer === portalCustomer);
  const customerRequests = portalRequests.filter(
    (request) => request.customer === portalCustomer
  );
  const nextServices = customerServices.slice(0, 3);
  const nextService = nextServices[0];
  const latestRequest = customerRequests[0];
  const pendingInvoices = customerInvoices.filter((invoice) => invoice.status !== "Pagada");
  const totalPending = pendingInvoices.reduce((sum, invoice) => sum + invoice.total, 0);

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-lg border border-border/70 bg-card shadow-sm">
        <div className="grid min-h-[360px] lg:grid-cols-[1.35fr_0.65fr]">
          <div className="flex flex-col justify-between gap-8 border-b border-border/70 p-5 sm:p-6 lg:border-b-0 lg:border-r">
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex h-7 items-center gap-2 rounded-md border border-primary/25 bg-primary/10 px-2.5 text-xs font-medium text-primary">
                  <ShieldCheck className="size-3.5" />
                  Portal privado cliente
                </span>
                <span className="inline-flex h-7 items-center rounded-md border border-border/70 bg-background/60 px-2.5 text-xs text-muted-foreground">
                  Datos sincronizados con CRM
                </span>
              </div>

              <div className="max-w-3xl space-y-3">
                <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Building2 className="size-4 text-primary" />
                  Atrium Labs
                </p>
                <h1 className="text-3xl font-semibold tracking-normal text-foreground sm:text-4xl">
                  Zona privada para gestionar servicios, facturas y nuevas solicitudes.
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                  El cliente ve su operativa limpia y cada petición que envía actualiza la
                  pipeline comercial, el calendario y la asignación de empleados de la empresa.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <DemoActionButton action="request-service" size="lg" className="h-10">
                <Sparkles className="size-4" />
                Solicitar nuevo servicio
              </DemoActionButton>
              <Button asChild variant="outline" size="lg" className="h-10">
                <Link href="/reserva">
                  <ArrowRight className="size-4" />
                  Ver reserva pública
                </Link>
              </Button>
            </div>
          </div>

          <aside className="flex flex-col justify-between gap-5 bg-background/45 p-5 sm:p-6">
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase text-muted-foreground">
                Próxima intervención
              </p>
              <div className="rounded-lg border border-primary/25 bg-primary/10 p-4">
                <div className="flex items-start justify-between gap-3">
                  <CalendarCheck2 className="mt-1 size-5 text-primary" />
                  <StatusBadge status={nextService?.status ?? "Programado"} />
                </div>
                <p className="mt-5 text-xl font-semibold">
                  {nextService?.title ?? "Servicio pendiente de programar"}
                </p>
                <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                  <p className="flex items-center gap-2">
                    <Clock3 className="size-4" />
                    {nextService ? formatDate(nextService.start) : "Sin fecha asignada"}
                  </p>
                  <p className="flex items-center gap-2">
                    <MapPin className="size-4" />
                    {nextService?.city ?? "Madrid"}
                  </p>
                  <p className="flex items-center gap-2">
                    <UserRoundCheck className="size-4" />
                    {nextService?.team.join(", ") ?? "Equipo pendiente"}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <PortalMetric label="Servicios" value={customerServices.length.toString()} />
              <PortalMetric label="Facturas" value={customerInvoices.length.toString()} />
              <PortalMetric label="Solicitudes" value={customerRequests.length.toString()} />
              <PortalMetric label="Pendiente" value={formatCurrency(totalPending)} />
            </div>
          </aside>
        </div>
      </section>

      <section className="grid items-stretch gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-lg border border-border/70 bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Servicios activos</p>
              <h2 className="mt-1 text-xl font-semibold">Calendario del cliente</h2>
            </div>
            <Button asChild variant="outline">
              <Link href="/calendar">
                <CalendarCheck2 className="size-4" />
                Ver calendario CRM
              </Link>
            </Button>
          </div>

          <div className="mt-5 grid gap-3">
            {nextServices.map((service) => (
              <div
                key={service.id}
                className="grid gap-4 rounded-lg border border-border/70 bg-background/55 p-4 sm:grid-cols-[1fr_auto]"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{service.title}</p>
                    <StatusBadge status={service.status} />
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {formatDate(service.start)} · {service.recurrence} · {service.city}
                  </p>
                  <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                    <UserRoundCheck className="size-4 text-primary" />
                    {service.team.join(", ")}
                  </p>
                </div>
                <div className="flex items-end justify-between gap-3 sm:block sm:text-right">
                  <p className="text-xs text-muted-foreground">Importe estimado</p>
                  <p className="text-lg font-semibold">{formatCurrency(service.price)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border/70 bg-card p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Sincronización automática</p>
              <h2 className="mt-1 text-xl font-semibold">Qué ocurre al pedir un servicio</h2>
            </div>
            <CheckCircle2 className="size-5 text-primary" />
          </div>

          <div className="mt-5 space-y-3">
            {portalSteps.map((step, index) => (
              <div
                key={step.title}
                className="grid grid-cols-[2rem_1fr] gap-3 rounded-lg border border-border/70 bg-background/55 p-3"
              >
                <span className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-sm font-semibold text-primary">
                  {index + 1}
                </span>
                <div>
                  <p className="font-medium">{step.title}</p>
                  <p className="mt-1 text-sm leading-5 text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid items-start gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-lg border border-border/70 bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Solicitudes del portal</p>
              <h2 className="mt-1 text-xl font-semibold">Seguimiento visible para el cliente</h2>
            </div>
            <DemoActionButton action="request-service" variant="outline">
              <MessageSquareText className="size-4" />
              Nueva solicitud
            </DemoActionButton>
          </div>

          <div className="mt-5 grid gap-3">
            {customerRequests.length > 0 ? (
              customerRequests.map((request) => (
                <div key={request.id} className="rounded-lg border border-border/70 bg-background/55 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{request.title}</p>
                        <StatusBadge status={request.status} />
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {request.customer} · {formatDate(request.preferredDate)}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-primary">
                      {request.scheduledAt ? formatDate(request.scheduledAt) : "Pendiente"}
                    </p>
                  </div>

                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {request.description}
                  </p>

                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    <TracePill label="CRM" value={request.leadId ? "Lead creado" : "Pendiente"} />
                    <TracePill
                      label="Calendario"
                      value={request.serviceId ? "Servicio creado" : "Pendiente"}
                    />
                    <TracePill
                      label="Equipo"
                      value={request.assignedTeam?.join(", ") ?? "Pendiente"}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-border bg-background/40 p-6 text-center">
                <p className="font-medium">Aún no hay solicitudes nuevas.</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Crea una petición para enseñar cómo entra en CRM, calendario y equipo.
                </p>
                <DemoActionButton action="request-service" className="mt-4">
                  <Sparkles className="size-4" />
                  Crear solicitud demo
                </DemoActionButton>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-border/70 bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Documentos</p>
                <h2 className="mt-1 text-xl font-semibold">Facturas y descargas</h2>
              </div>
              <FileText className="size-5 text-primary" />
            </div>

            <div className="mt-5 space-y-3">
              {customerInvoices.slice(0, 4).map((invoice) => (
                <div
                  key={invoice.id}
                  className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg border border-border/70 bg-background/55 p-3"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{invoice.number}</p>
                      <StatusBadge status={invoice.status} />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Vence {formatDate(invoice.dueDate)} · {formatCurrency(invoice.total)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Descargar ${invoice.number}`}
                    onClick={() =>
                      downloadDocument({
                        id: invoice.id,
                        number: invoice.number,
                        customer: invoice.customer,
                        status: invoice.status,
                      })
                    }
                  >
                    <Download className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border/70 bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Estado de cuenta</p>
                <h2 className="mt-1 text-xl font-semibold">Resumen operativo</h2>
              </div>
              <WalletCards className="size-5 text-primary" />
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <AccountTile label="Contrato" value="Activo" />
              <AccountTile label="Facturas pendientes" value={pendingInvoices.length.toString()} />
              <AccountTile label="Última solicitud" value={latestRequest?.title ?? "Sin solicitudes"} wide />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function PortalMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-h-20 rounded-lg border border-border/70 bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 break-words text-xl font-semibold">{value}</p>
    </div>
  );
}

function TracePill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-primary/20 bg-primary/10 p-3">
      <p className="text-xs font-medium text-primary">{label}</p>
      <p className="mt-1 truncate text-sm text-foreground">{value}</p>
    </div>
  );
}

function AccountTile({
  label,
  value,
  wide,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "col-span-2 rounded-lg border border-border/70 bg-background/55 p-3" : "rounded-lg border border-border/70 bg-background/55 p-3"}>
      <p className="text-muted-foreground">{label}</p>
      <p className="mt-1 truncate font-semibold">{value}</p>
    </div>
  );
}
