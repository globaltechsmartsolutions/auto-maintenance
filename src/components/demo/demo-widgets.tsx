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

const serviceStatuses = ["Pending", "Scheduled", "In progress", "Completed", "Cancelled"];
const requestStatuses = ["Pending", "Scheduled", "Autoasignado", "Completed", "Cancelled"];
const employeeStatuses = ["Available", "Assigned", "Holiday", "Sick leave"];

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
  confirmLabel = "Delete",
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
          <AlertDialogCancel>Cancel</AlertDialogCancel>
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
            <TableHead>Service</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Team</TableHead>
            <TableHead className="text-right">Amount</TableHead>
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
  const employeeOptions = ["Select employee", ...employees.map((employee) => employee.name)];
  const pendingRequests = portalRequests
    .map((request) => ({
      lead: leads.find((lead) => lead.id === request.leadId),
      request,
      service: services.find((service) => service.id === request.serviceId),
    }))
    .filter(({ request, service }) =>
      Boolean(service) &&
      (request.status === "Pending" || service?.team.includes("Unassigned team"))
    );

  if (pendingRequests.length === 0) {
    return (
      <Card className="border-border/70 bg-card/85 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarCheck2 className="size-4 text-primary" />
            Pending web bookings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            A request received from web booking will appear here for assignment.
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
          Web bookings awaiting assignment
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {pendingRequests.map(({ lead, request, service }) => {
          if (!service) return null;
          const recommendation =
            getAssignmentRecommendation(service.id) ?? request.assignmentRecommendation;
          const canAssignRecommendation = Boolean(
            recommendation && recommendation.employeeName !== "Unassigned team"
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
                      aria-label={`Edit web booking ${request.title}`}
                      title="Edit booking"
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
                      label={`Delete web booking ${request.title}`}
                      title="Delete this web booking?"
                      description="The web request and its linked lead and calendar service will be deleted."
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
                          Learning applied
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
                  <p className="text-xs font-medium text-primary">Recommended action</p>
                  <p className="mt-1 text-sm font-semibold">
                    {recommendation?.employeeName ?? "Review availability"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Confirming updates the calendar, service, and learning record.
                  </p>
                </div>
                <Button
                  type="button"
                  disabled={!canAssignRecommendation || !recommendation}
                  onClick={() => {
                    if (!recommendation || recommendation.employeeName === "Unassigned team") {
                      return;
                    }

                    assignServiceTeam(service.id, recommendation.employeeName);
                  }}
                  className="mt-auto gap-2"
                >
                  <UserRoundCheck className="size-4" />
                  {recommendation?.state === "Ready for auto-assignment"
                    ? "Auto-assign now"
                    : "Assign recommendation"}
                </Button>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Request status
                  </p>
                  <NativeSelect
                    label={`Status of booking ${request.title}`}
                    value={request.status}
                    options={requestStatuses}
                    onChange={(status) => updatePortalRequestStatus(request.id, status)}
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Choose another person
                  </p>
                  <select
                    aria-label={`Assign pending booking ${request.title}`}
                    value={
                      service.team[0] === "Unassigned team"
                        ? "Select employee"
                        : service.team[0]
                    }
                    onChange={(event) => {
                      const employeeName = event.target.value;
                      if (employeeName !== "Select employee") {
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
  const activeServices = services.filter((service) => service.status !== "Cancelled");
  const availableEmployees = employees.filter((employee) => employee.status === "Available");
  const pendingAssignments = services.filter(
    (service) => service.status === "Pending" || service.team.includes("Unassigned team")
  );
  const cards = [
    {
      helper: "non-cancelled services in the calendar",
      icon: ClipboardList,
      label: "Active services",
      status: "Scheduled",
      value: activeServices.length.toString(),
    },
    {
      helper: "people available for new visits",
      icon: ShieldCheck,
      label: "Teams with capacity",
      status: "Active",
      value: availableEmployees.length.toString(),
    },
    {
      helper: "require assignment, confirmation, or follow-up",
      icon: AlertTriangle,
      label: "Pendings operativos",
      status: pendingAssignments.length > 0 ? "Follow-up" : "Completed",
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
  const [filter, setFilter] = React.useState("All");
  const visibleServices =
    filter === "All" ? services : services.filter((service) => service.status === filter);
  const teamOptions = ["Unassigned team", ...employees.map((employee) => employee.name)];

  return (
    <Card className="border-border/70 bg-card/85 shadow-sm">
      <CardHeader className="gap-4 md:flex-row md:items-center md:justify-between">
        <CardTitle className="text-base">Service list</CardTitle>
        <NativeSelect
          label="Filter services by status"
          value={filter}
          onChange={setFilter}
          options={["All", ...serviceStatuses]}
        />
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Recurrencia</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Team</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Actions</TableHead>
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
                      label={`Status of ${service.title}`}
                      value={service.status}
                      options={serviceStatuses}
                      onChange={(status) => updateServiceStatus(service.id, status)}
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <NativeSelect
                      label={`Assign employee to ${service.title}`}
                      value={service.team[0] ?? "Unassigned team"}
                      options={teamOptions}
                      onChange={(employeeName) =>
                        assignServiceTeam(
                          service.id,
                          employeeName === "Unassigned team" ? "" : employeeName
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
                        aria-label={`Edit service ${service.title}`}
                        title="Edit service"
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
                        label={`Delete service ${service.title}`}
                        title="Delete this service?"
                        description="It will be removed from Services. If created from a web booking, that request and its linked lead will also be removed."
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
            There are no services with this status.
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
        <CardTitle className="text-base">Field team</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Availability</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Services</TableHead>
                <TableHead>Rendimiento</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Actions</TableHead>
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
                      label={`Status of ${employee.name}`}
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
                        aria-label={`Edit employee ${employee.name}`}
                        title="Edit employee"
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
                        label={`Delete employee ${employee.name}`}
                        title="Delete this employee?"
                        description="They will be removed from the team and any service left without a team will return to pending."
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
          <CardTitle className="text-base">Invoice history</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead>VAT</TableHead>
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
                        aria-label={`Download PDF ${invoice.number}`}
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
          <CardTitle className="text-base">Quotes</CardTitle>
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
                  valid until {formatDate(quote.validUntil)}
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
          const active = automation.status === "Active";

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
                    aria-label={`${active ? "Pause" : "Activate"} ${automation.name}`}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-md border border-border/70 bg-background/50 p-3">
                    <p className="text-muted-foreground">Sends</p>
                    <p className="mt-1 font-semibold">{automation.sent}</p>
                  </div>
                  <div className="rounded-md border border-border/70 bg-background/50 p-3">
                    <p className="text-muted-foreground">Conversion</p>
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
                  <TableHead>Name</TableHead>
                  <TableHead>Disparador</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Conversion</TableHead>
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
            Customer access
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Customer</p>
            <p className="text-xl font-semibold">Atrium Labs</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-md border border-border/70 bg-background/50 p-3">
              <p className="text-muted-foreground">Invoices</p>
              <p className="mt-1 text-lg font-semibold">{invoices.length}</p>
            </div>
            <div className="rounded-md border border-border/70 bg-background/50 p-3">
              <p className="text-muted-foreground">Services</p>
              <p className="mt-1 text-lg font-semibold">{services.length}</p>
            </div>
          </div>
          <div className="rounded-md border border-primary/20 bg-primary/10 p-3 text-sm text-primary">
            {portalRequests.length} requests registered through the portal.
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border/70 bg-card/85 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Visible services</CardTitle>
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
            <CardTitle className="text-base">Documents</CardTitle>
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
                  aria-label={`Download ${invoice.number}`}
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
              <CardTitle className="text-base">Requests recientes</CardTitle>
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
                        aria-label={`Edit request ${request.title}`}
                        title="Edit request"
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
                        label={`Delete request ${request.title}`}
                        title="Delete this request?"
                        description="The web request and any linked lead and service will be deleted."
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
                        Service in calendar and lead in CRM
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
        placeholder="Add a sales or operational note"
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
        Save note
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
