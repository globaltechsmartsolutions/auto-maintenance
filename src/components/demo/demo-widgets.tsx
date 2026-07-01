"use client";

import * as React from "react";
import {
  AlertTriangle,
  Bot,
  CalendarCheck2,
  ClipboardList,
  Download,
  FileText,
  Mail,
  MessageSquareText,
  Pencil,
  RefreshCw,
  Star,
  Trash2,
  UserRoundCheck,
  ShieldCheck,
} from "lucide-react";
import { DemoActionButton, useDemo } from "@/components/demo/demo-provider";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatDate } from "@/lib/format";

const serviceStatuses = ["Pendiente", "Programado", "En curso", "Completado", "Cancelado"];
const requestStatuses = ["Pendiente", "Programado", "Autoasignado", "Completado", "Cancelado"];
const employeeStatuses = ["Disponible", "Asignado", "Vacaciones", "Baja"];

function inputDateFromIso(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }

  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}

function inputTimeFromIso(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value.slice(11, 16) || "09:00";
  }

  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(11, 16);
}

export function DemoConfirmActionButton({
  children,
  className,
  confirmLabel = "Borrar",
  description,
  label,
  onConfirm,
  size = "icon-sm",
  title,
  variant = "ghost",
}: React.ComponentProps<typeof Button> & {
  confirmLabel?: string;
  description: string;
  label: string;
  onConfirm: () => void;
  title: string;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          aria-label={label}
          title={label}
          variant={variant}
          size={size}
          className={className}
        >
          {children}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function NativeSelect({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: string[];
  value: string;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-8 rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

export function DemoDashboardServicesTable() {
  const { services } = useDemo();

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Servicio</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Equipo</TableHead>
            <TableHead className="text-right">Importe</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {services.slice(0, 6).map((service) => (
            <TableRow key={service.id}>
              <TableCell>
                <div className="font-medium">{service.title}</div>
                <div className="text-xs text-muted-foreground">
                  {formatDate(service.start)} · {service.city}
                </div>
              </TableCell>
              <TableCell>{service.customer}</TableCell>
              <TableCell>
                <StatusBadge status={service.status} />
              </TableCell>
              <TableCell className="text-muted-foreground">{service.team.join(", ")}</TableCell>
              <TableCell className="text-right font-medium">
                {formatCurrency(service.price)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function DemoDashboardInvoicesList() {
  const { invoices } = useDemo();

  return (
    <div className="space-y-3">
      {invoices.slice(0, 4).map((invoice) => (
        <div
          key={invoice.id}
          className="flex items-center justify-between gap-3 rounded-md border border-border/70 bg-background/50 p-3"
        >
          <div>
            <p className="text-sm font-medium">{invoice.customer}</p>
            <p className="text-xs text-muted-foreground">
              {invoice.number} · vence {formatDate(invoice.dueDate)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium">{formatCurrency(invoice.total)}</p>
            <StatusBadge status={invoice.status} className="mt-1" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DemoPendingWebRequestsPanel() {
  const {
    assignServiceTeam,
    deletePortalRequest,
    employees,
    getAssignmentRecommendation,
    leads,
    openDialog,
    portalRequests,
    services,
    updatePortalRequestStatus,
  } = useDemo();
  const employeeOptions = ["Seleccionar empleado", ...employees.map((employee) => employee.name)];
  const pendingRequests = portalRequests
    .map((request) => ({
      lead: leads.find((lead) => lead.id === request.leadId),
      request,
      service: services.find((service) => service.id === request.serviceId),
    }))
    .filter(({ request, service }) =>
      Boolean(service) &&
      (request.status === "Pendiente" || service?.team.includes("Equipo por asignar"))
    );

  if (pendingRequests.length === 0) {
    return (
      <Card className="border-border/70 bg-card/85 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarCheck2 className="size-4 text-primary" />
            Reservas web pendientes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Cuando entre una solicitud desde Reserva web, aparecerá aquí para asignarla.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/30 bg-primary/10 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarCheck2 className="size-4 text-primary" />
          Reservas web pendientes de asignar
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {pendingRequests.map(({ lead, request, service }) => {
          if (!service) return null;
          const recommendation =
            getAssignmentRecommendation(service.id) ?? request.assignmentRecommendation;
          const canAssignRecommendation = Boolean(
            recommendation && recommendation.employeeName !== "Equipo por asignar"
          );

          return (
            <div
              key={request.id}
              className="grid items-stretch gap-4 rounded-lg border border-primary/20 bg-background/70 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-start gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{request.title}</p>
                      <StatusBadge status={request.status} />
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {request.customer} · {formatDate(service.start)} · {service.city} ·{" "}
                      {formatCurrency(service.price)}
                    </p>
                  </div>
                  <div className="ml-auto flex shrink-0 gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Editar reserva web ${request.title}`}
                      title="Editar reserva"
                      onClick={() =>
                        openDialog("request", {
                          address: service.address ?? "",
                          city: service.city,
                          contactName: lead?.contactName ?? "",
                          customer: request.customer,
                          description: service.description ?? request.description,
                          email: lead?.email ?? "",
                          estimatedPrice: String(service.price),
                          id: request.id,
                          phone: lead?.phone ?? "",
                          preferredDate: request.preferredDate,
                          preferredTime: inputTimeFromIso(request.scheduledAt ?? service.start),
                          status: request.status,
                          title: request.title,
                        })
                      }
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <DemoConfirmActionButton
                      label={`Borrar reserva web ${request.title}`}
                      title="¿Borrar esta reserva web?"
                      description="Se eliminará la solicitud web y también su lead y servicio de calendario asociados."
                      onConfirm={() => deletePortalRequest(request.id)}
                    >
                      <Trash2 className="size-4" />
                    </DemoConfirmActionButton>
                  </div>
                </div>
                {recommendation ? (
                  <div className="mt-4 grid gap-3 rounded-md border border-border/70 bg-card/65 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="rounded-md">
                        {recommendation.state}
                      </Badge>
                      <span className="text-sm font-semibold">
                        {recommendation.employeeName}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {recommendation.summary}
                    </p>
                    <div className="grid gap-2 text-sm">
                      {recommendation.reasons.slice(0, 3).map((reason) => (
                        <div key={reason} className="flex gap-2">
                          <UserRoundCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                          <span>{reason}</span>
                        </div>
                      ))}
                    </div>
                    {recommendation.learningSignals.length > 0 ? (
                      <div className="rounded-md border border-primary/20 bg-primary/10 p-3">
                        <p className="flex items-center gap-2 text-sm font-medium">
                          <Bot className="size-4 text-primary" />
                          Aprendizaje aplicado
                        </p>
                        <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
                          {recommendation.learningSignals.map((signal) => (
                            <span key={signal}>{signal}</span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {recommendation.warnings.length > 0 ? (
                      <div className="grid gap-1 text-xs text-amber-500">
                        {recommendation.warnings.map((warning) => (
                          <span key={warning}>{warning}</span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="flex h-full flex-col gap-3 rounded-md border border-border/70 bg-card/75 p-3">
                <div>
                  <p className="text-xs font-medium text-primary">Acción recomendada</p>
                  <p className="mt-1 text-sm font-semibold">
                    {recommendation?.employeeName ?? "Revisar disponibilidad"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Confirmar aquí actualiza calendario, servicio y aprendizaje.
                  </p>
                </div>
                <Button
                  type="button"
                  disabled={!canAssignRecommendation || !recommendation}
                  onClick={() => {
                    if (!recommendation || recommendation.employeeName === "Equipo por asignar") {
                      return;
                    }

                    assignServiceTeam(service.id, recommendation.employeeName);
                  }}
                  className="mt-auto gap-2"
                >
                  <UserRoundCheck className="size-4" />
                  {recommendation?.state === "Lista para autoasignar"
                    ? "Autoasignar ahora"
                    : "Asignar recomendada"}
                </Button>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Estado de la solicitud
                  </p>
                  <NativeSelect
                    label={`Estado de la reserva ${request.title}`}
                    value={request.status}
                    options={requestStatuses}
                    onChange={(status) => updatePortalRequestStatus(request.id, status)}
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Elegir otra persona
                  </p>
                  <select
                    aria-label={`Asignar reserva pendiente ${request.title}`}
                    value={
                      service.team[0] === "Equipo por asignar"
                        ? "Seleccionar empleado"
                        : service.team[0]
                    }
                    onChange={(event) => {
                      const employeeName = event.target.value;
                      if (employeeName !== "Seleccionar empleado") {
                        assignServiceTeam(service.id, employeeName);
                      }
                    }}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {employeeOptions.map((employeeName) => (
                      <option key={employeeName} value={employeeName}>
                        {employeeName}
                      </option>
                    ))}
                  </select>
                </div>
                {recommendation?.alternatives.length ? (
                  <div className="space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
                    <p className="font-medium text-foreground">Alternativas</p>
                    {recommendation.alternatives.map((alternative) => (
                      <p key={alternative.employeeName}>
                        {alternative.employeeName}: {alternative.reason}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export function DemoServiceHealthCards() {
  const { employees, services } = useDemo();
  const activeServices = services.filter((service) => service.status !== "Cancelado");
  const availableEmployees = employees.filter((employee) => employee.status === "Disponible");
  const pendingAssignments = services.filter(
    (service) => service.status === "Pendiente" || service.team.includes("Equipo por asignar")
  );
  const cards = [
    {
      helper: "servicios no cancelados en calendario",
      icon: ClipboardList,
      label: "Servicios activos",
      status: "Programado",
      value: activeServices.length.toString(),
    },
    {
      helper: "personas disponibles para nuevas visitas",
      icon: ShieldCheck,
      label: "Equipos con margen",
      status: "Activo",
      value: availableEmployees.length.toString(),
    },
    {
      helper: "requieren asignación, confirmación o seguimiento",
      icon: AlertTriangle,
      label: "Pendientes operativos",
      status: pendingAssignments.length > 0 ? "En seguimiento" : "Completado",
      value: pendingAssignments.length.toString(),
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {cards.map((item) => {
        const Icon = item.icon;

        return (
          <Card key={item.label} className="border-border/70 bg-card/85 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Icon className="size-4 text-primary" />
                {item.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-2xl font-semibold">{item.value}</p>
                <StatusBadge status={item.status} />
              </div>
              <p className="text-sm text-muted-foreground">{item.helper}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export function DemoServicesTable() {
  const {
    assignServiceTeam,
    deleteService,
    employees,
    openDialog,
    services,
    updateServiceStatus,
  } = useDemo();
  const [filter, setFilter] = React.useState("Todos");
  const visibleServices =
    filter === "Todos" ? services : services.filter((service) => service.status === filter);
  const teamOptions = ["Equipo por asignar", ...employees.map((employee) => employee.name)];

  return (
    <Card className="border-border/70 bg-card/85 shadow-sm">
      <CardHeader className="gap-4 md:flex-row md:items-center md:justify-between">
        <CardTitle className="text-base">Listado de servicios</CardTitle>
        <NativeSelect
          label="Filtrar servicios por estado"
          value={filter}
          onChange={setFilter}
          options={["Todos", ...serviceStatuses]}
        />
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Servicio</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Recurrencia</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Equipo</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleServices.map((service) => (
                <TableRow key={service.id}>
                  <TableCell>
                    <div className="font-medium">{service.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(service.start)} · {service.city}
                    </div>
                  </TableCell>
                  <TableCell>{service.customer}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{service.recurrence}</Badge>
                  </TableCell>
                  <TableCell>
                    <NativeSelect
                      label={`Estado de ${service.title}`}
                      value={service.status}
                      options={serviceStatuses}
                      onChange={(status) => updateServiceStatus(service.id, status)}
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <NativeSelect
                      label={`Asignar empleado a ${service.title}`}
                      value={service.team[0] ?? "Equipo por asignar"}
                      options={teamOptions}
                      onChange={(employeeName) =>
                        assignServiceTeam(
                          service.id,
                          employeeName === "Equipo por asignar" ? "" : employeeName
                        )
                      }
                    />
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(service.price * (1 + service.vatRate / 100))}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Editar servicio ${service.title}`}
                        title="Editar servicio"
                        onClick={() =>
                          openDialog("service", {
                            city: service.city,
                            customer: service.customer,
                            date: inputDateFromIso(service.start),
                            id: service.id,
                            price: String(service.price),
                            recurrence: service.recurrence,
                            status: service.status,
                            team: service.team.join(", "),
                            time: inputTimeFromIso(service.start),
                            title: service.title,
                          })
                        }
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <DemoConfirmActionButton
                        label={`Borrar servicio ${service.title}`}
                        title="¿Borrar este servicio?"
                        description="Se eliminará de Servicios y, si nació desde una reserva web, también se retirará esa solicitud y su lead vinculado."
                        onConfirm={() => deleteService(service.id)}
                      >
                        <Trash2 className="size-4" />
                      </DemoConfirmActionButton>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {visibleServices.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No hay servicios con este estado.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function DemoEmployeesTable() {
  const { deleteEmployee, employees, openDialog, updateEmployeeStatus } = useDemo();

  return (
    <Card className="border-border/70 bg-card/85 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Equipo de campo</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empleado</TableHead>
                <TableHead>Disponibilidad</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Servicios</TableHead>
                <TableHead>Rendimiento</TableHead>
                <TableHead className="text-right">Ingresos</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell>
                    <div className="font-medium">{employee.name}</div>
                    <div className="text-xs text-muted-foreground">{employee.role}</div>
                  </TableCell>
                  <TableCell>{employee.availability}</TableCell>
                  <TableCell>
                    <NativeSelect
                      label={`Estado de ${employee.name}`}
                      value={employee.status}
                      options={employeeStatuses}
                      onChange={(status) => updateEmployeeStatus(employee.id, status)}
                    />
                  </TableCell>
                  <TableCell>{employee.jobs}</TableCell>
                  <TableCell className="min-w-36">
                    <div className="flex items-center gap-3">
                      <Progress value={employee.score} className="h-2" />
                      <span className="text-xs text-muted-foreground">{employee.score}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(employee.revenue)}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Editar empleado ${employee.name}`}
                        title="Editar empleado"
                        onClick={() =>
                          openDialog("employee", {
                            availability: employee.availability,
                            id: employee.id,
                            name: employee.name,
                            notes: employee.notes,
                            role: employee.role,
                            status: employee.status,
                          })
                        }
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <DemoConfirmActionButton
                        label={`Borrar empleado ${employee.name}`}
                        title="¿Borrar este empleado?"
                        description="Se retirará del equipo y cualquier servicio que se quede sin equipo volverá a pendiente."
                        onConfirm={() => deleteEmployee(employee.id)}
                      >
                        <Trash2 className="size-4" />
                      </DemoConfirmActionButton>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export function DemoInvoicesWorkspace() {
  const { convertQuoteToService, downloadDocument, invoices, quotes } = useDemo();

  return (
    <div className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
      <Card className="border-border/70 bg-card/85 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Historial de facturas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead>IVA</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">{invoice.number}</TableCell>
                    <TableCell>{invoice.customer}</TableCell>
                    <TableCell>
                      <StatusBadge status={invoice.status} />
                    </TableCell>
                    <TableCell>{formatDate(invoice.dueDate)}</TableCell>
                    <TableCell>{formatCurrency(invoice.vat)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(invoice.total)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Descargar PDF ${invoice.number}`}
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/85 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Presupuestos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {quotes.map((quote) => (
            <div key={quote.id} className="rounded-md border border-border/70 bg-background/50 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{quote.number}</p>
                  <p className="text-xs text-muted-foreground">{quote.customer}</p>
                </div>
                <StatusBadge status={quote.status} />
              </div>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  válido hasta {formatDate(quote.validUntil)}
                </span>
                <span className="font-medium">{formatCurrency(quote.total)}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => convertQuoteToService(quote.id)}>
                  <RefreshCw className="size-3.5" />
                  Convertir
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    downloadDocument({
                      number: quote.number,
                      customer: quote.customer,
                      status: quote.status,
                    })
                  }
                >
                  <Download className="size-3.5" />
                  PDF
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

const triggerIcons = {
  SERVICE_REMINDER: Bot,
  SERVICE_CONFIRMATION: Mail,
  FOLLOW_UP: MessageSquareText,
  REVIEW_REQUEST: Star,
  FAILED_PAYMENT: Mail,
} as const;

export function DemoAutomationsWorkspace() {
  const { automations, toggleAutomation } = useDemo();

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-4">
        {automations.map((automation) => {
          const Icon = triggerIcons[automation.trigger as keyof typeof triggerIcons] ?? Bot;
          const active = automation.status === "Activo";

          return (
            <Card key={automation.id} className="border-border/70 bg-card/85">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon className="size-4 text-primary" />
                  {automation.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <StatusBadge status={automation.status} />
                  <Switch
                    checked={active}
                    onCheckedChange={(checked) => toggleAutomation(automation.id, checked)}
                    aria-label={`${active ? "Pausar" : "Activar"} ${automation.name}`}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-md border border-border/70 bg-background/50 p-3">
                    <p className="text-muted-foreground">Envíos</p>
                    <p className="mt-1 font-semibold">{automation.sent}</p>
                  </div>
                  <div className="rounded-md border border-border/70 bg-background/50 p-3">
                    <p className="text-muted-foreground">Conversión</p>
                    <p className="mt-1 font-semibold">{automation.conversion}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-border/70 bg-card/85 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Reglas activas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Disparador</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Conversión</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {automations.map((automation) => (
                  <TableRow key={automation.id}>
                    <TableCell className="font-medium">{automation.name}</TableCell>
                    <TableCell>{automation.trigger}</TableCell>
                    <TableCell>{automation.channel}</TableCell>
                    <TableCell>
                      <StatusBadge status={automation.status} />
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {automation.conversion}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

export function DemoPortalWorkspace() {
  const { deletePortalRequest, downloadDocument, invoices, leads, openDialog, portalRequests, services } = useDemo();

  return (
    <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
      <Card className="border-border/70 bg-card/85 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="size-4 text-primary" />
            Acceso cliente
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Cliente</p>
            <p className="text-xl font-semibold">Atrium Labs</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-md border border-border/70 bg-background/50 p-3">
              <p className="text-muted-foreground">Facturas</p>
              <p className="mt-1 text-lg font-semibold">{invoices.length}</p>
            </div>
            <div className="rounded-md border border-border/70 bg-background/50 p-3">
              <p className="text-muted-foreground">Servicios</p>
              <p className="mt-1 text-lg font-semibold">{services.length}</p>
            </div>
          </div>
          <div className="rounded-md border border-primary/20 bg-primary/10 p-3 text-sm text-primary">
            {portalRequests.length} solicitudes registradas desde el portal.
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border/70 bg-card/85 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Servicios visibles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {services.slice(0, 4).map((service) => (
              <div key={service.id} className="rounded-md border border-border/70 bg-background/50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">{service.title}</p>
                  <StatusBadge status={service.status} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{formatDate(service.start)}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/85 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Documentos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {invoices.map((invoice) => (
              <div
                key={invoice.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border/70 bg-background/50 p-3"
              >
                <div className="flex items-center gap-3">
                  <FileText className="size-4 text-primary" />
                  <div>
                    <p className="text-sm font-medium">{invoice.number}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(invoice.total)}
                    </p>
                  </div>
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
          </CardContent>
        </Card>

        {portalRequests.length > 0 ? (
          <Card className="border-border/70 bg-card/85 shadow-sm md:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Solicitudes recientes</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {portalRequests.map((request) => {
                const service = services.find((item) => item.id === request.serviceId);
                const lead = leads.find((item) => item.id === request.leadId);

                return (
                <div key={request.id} className="rounded-md border border-border/70 bg-background/50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">{request.title}</p>
                    <div className="flex shrink-0 items-center gap-1">
                      <StatusBadge status={request.status} />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Editar solicitud ${request.title}`}
                        title="Editar solicitud"
                        onClick={() =>
                          openDialog("request", {
                            address: service?.address ?? "",
                            city: service?.city ?? "Madrid",
                            contactName: lead?.contactName ?? "",
                            customer: request.customer,
                            description: service?.description ?? request.description,
                            email: lead?.email ?? "",
                            estimatedPrice: String(service?.price ?? lead?.value ?? 680),
                            id: request.id,
                            phone: lead?.phone ?? "",
                            preferredDate: request.preferredDate,
                            preferredTime: inputTimeFromIso(request.scheduledAt ?? service?.start ?? ""),
                            status: request.status,
                            title: request.title,
                          })
                        }
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <DemoConfirmActionButton
                        label={`Borrar solicitud ${request.title}`}
                        title="¿Borrar esta solicitud?"
                        description="Se eliminará la solicitud web y también su lead y servicio asociados si existen."
                        onConfirm={() => deletePortalRequest(request.id)}
                      >
                        <Trash2 className="size-4" />
                      </DemoConfirmActionButton>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {request.customer} · {formatDate(request.preferredDate)}
                  </p>
                  {request.assignedTeam?.length ? (
                    <div className="mt-3 grid gap-2 rounded-md border border-primary/20 bg-primary/10 p-2 text-xs">
                      <p className="flex items-center gap-2 text-primary">
                        <UserRoundCheck className="size-3.5" />
                        {request.assignedTeam.join(", ")}
                      </p>
                      <p className="flex items-center gap-2 text-muted-foreground">
                        <CalendarCheck2 className="size-3.5" />
                        Servicio en calendario y lead en CRM
                      </p>
                    </div>
                  ) : null}
                  <p className="mt-2 text-sm text-muted-foreground">{request.description}</p>
                </div>
                );
              })}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

export function DemoCustomerNotes({ customerName }: { customerName: string }) {
  const { addNote, notes } = useDemo();
  const noteRef = React.useRef<HTMLTextAreaElement>(null);
  const customerNotes = notes.filter((note) => note.customer === customerName);

  return (
    <div className="space-y-3">
      <Textarea
        ref={noteRef}
        placeholder="Añadir nota comercial u operativa"
        className="min-h-28"
      />
      <Button
        className="w-full"
        onClick={() => {
          addNote(customerName, noteRef.current?.value ?? "");
          if (noteRef.current) {
            noteRef.current.value = "";
          }
        }}
      >
        <MessageSquareText className="size-4" />
        Guardar nota
      </Button>
      {customerNotes.length > 0 ? (
        <div className="space-y-2">
          {customerNotes.map((note) => (
            <div key={note.id} className="rounded-md border border-border/70 bg-background/50 p-3 text-sm">
              <p>{note.body}</p>
              <p className="mt-2 text-xs text-muted-foreground">{formatDate(note.createdAt)}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export { DemoActionButton };
