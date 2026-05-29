import {
  CalendarPlus,
  ClipboardCheck,
  Euro,
  FileClock,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { DashboardCharts } from "@/components/dashboard/dashboard-charts";
import { MetricCard } from "@/components/dashboard/metric-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  dashboardMetrics,
  employeePerformance,
  invoices,
  services,
} from "@/lib/mock-data";
import { formatCurrency, formatDate } from "@/lib/format";

const metricIcons = [Euro, ClipboardCheck, Users, FileClock, Sparkles, TrendingUp];

export default function DashboardPage() {
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
          <Button variant="outline">
            <FileClock className="size-4" />
            Exportar
          </Button>
          <Button>
            <CalendarPlus className="size-4" />
            Nuevo servicio
          </Button>
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

      <DashboardCharts />

      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <Card className="border-border/70 bg-card/85 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Servicios próximos</CardTitle>
          </CardHeader>
          <CardContent>
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
                {services.map((service) => (
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
                    <TableCell className="text-muted-foreground">
                      {service.team.join(", ")}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(service.price)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
            <CardContent className="space-y-3">
              {invoices.map((invoice) => (
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
      </div>
    </div>
  );
}
