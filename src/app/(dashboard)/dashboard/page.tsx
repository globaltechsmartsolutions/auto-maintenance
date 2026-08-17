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
    const activeServices = services.filter((service) => service.status !== "Cancelled");
    const completedServices = services.filter((service) => service.status === "Completed");
    const paidRevenue = invoices
      .filter((invoice) => invoice.status === "Paid")
      .reduce((total, invoice) => total + invoice.total, 0);
    const projectedRevenue = activeServices.reduce(
      (total, service) => total + service.price * (1 + service.vatRate / 100),
      0
    );
    const pendingInvoices = invoices.filter((invoice) => invoice.status !== "Paid");
    const pendingInvoiceTotal = pendingInvoices.reduce(
      (total, invoice) => total + invoice.total,
      0
    );
    const activeCustomers = customers.filter((customer) => customer.status === "Active");
    const newLeads = leads.filter((lead) => lead.status === "New");
    const sla =
      activeServices.length > 0
        ? Math.round((completedServices.length / activeServices.length) * 1000) / 10
        : 100;

    return [
      {
        label: "Monthly revenue",
        displayValue: formatCurrency(Math.max(paidRevenue, projectedRevenue)),
        delta: `+${formatCurrency(projectedRevenue)}`,
        helper: "operational pipeline updated",
      },
      {
        label: "Active services",
        displayValue: activeServices.length.toString(),
        delta: `+${portalRequests.length}`,
        helper: "includes web bookings",
      },
      {
        label: "Active customers",
        displayValue: activeCustomers.length.toString(),
        delta: `+${customers.length - activeCustomers.length}`,
        helper: "customers and leads synchronized",
      },
      {
        label: "Outstanding invoices",
        displayValue: formatCurrency(pendingInvoiceTotal),
        delta: `${pendingInvoices.length}`,
        helper: "documents awaiting payment",
      },
      {
        label: "New leads",
        displayValue: newLeads.length.toString(),
        delta: `+${leads.length}`,
        helper: "active sales pipeline",
      },
      {
        label: "SLA completed",
        displayValue: `${sla.toLocaleString("en-GB")} %`,
        delta: `${completedServices.length}`,
        helper: "completed services",
      },
    ];
  }, [customers, invoices, leads, portalRequests.length, services]);

  const operationsBrief = React.useMemo(() => {
    const pendingInvoice = invoices.find((invoice) => invoice.status !== "Paid");
    const unassignedService = services.find((service) =>
      service.team.includes("Unassigned team")
    );
    const latestRequest = portalRequests[0];

    return [
      {
        title: pendingInvoice ? "Close outstanding invoice" : "Payments up to date",
        customer: pendingInvoice?.customer ?? "No incidents",
        status: pendingInvoice?.status ?? "Completed",
        impact: pendingInvoice ? formatCurrency(pendingInvoice.total) : "No critical debt",
        helper: pendingInvoice
          ? `Review ${pendingInvoice.number} before its due date.`
          : "The portfolio has no relevant overdue invoices.",
      },
      {
        title: unassignedService ? "Assign pending team" : "Team coverage complete",
        customer: unassignedService?.customer ?? "Stable operations",
        status: unassignedService?.status ?? "Scheduled",
        impact: unassignedService
          ? `${unassignedService.title} requires an assignee`
          : "All services have a team",
        helper: unassignedService
          ? "Use the intelligent recommendation before confirming with the customer."
          : "There are no services without an assigned employee.",
      },
      {
        title: latestRequest ? "Confirm web booking" : "Acquisition ready",
        customer: latestRequest?.customer ?? "Customer portal",
        status: latestRequest?.status ?? "Scheduled",
        impact: latestRequest
          ? `${latestRequest.title} enters the CRM and calendar`
          : "Public form ready for new requests",
        helper: latestRequest
          ? "The request is linked to a lead, calendar, and team."
          : "A submitted booking will appear here automatically.",
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
          <p className="text-sm text-muted-foreground">Today&apos;s operations</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-normal">
            Executive dashboard
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <DemoActionButton action="export-dashboard" variant="outline">
            <FileClock className="size-4" />
            Export
          </DemoActionButton>
          <DemoActionButton action="new-service">
            <CalendarPlus className="size-4" />
            New service
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
            <CardTitle className="text-base">Upcoming services</CardTitle>
          </CardHeader>
          <CardContent>
            <DemoDashboardServicesTable />
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card className="border-border/70 bg-card/85 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Team performance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {employeePerformance.map((employee) => (
                <div key={employee.name}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{employee.name}</span>
                    <span className="text-muted-foreground">
                      {employee.score}/100 · {employee.services} services
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
              <CardTitle className="text-base">Payment attention</CardTitle>
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
