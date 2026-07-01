"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Clock3,
  MapPin,
  Play,
  UserRoundCheck,
} from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatCurrency, formatDate } from "@/lib/format";
import { useDemo } from "./demo-provider";

const employeeName = "Laura Méndez";

export function EmployeeFieldDemo() {
  const { employees, notify, services, updateServiceStatus } = useDemo();
  const employee =
    employees.find((item) => item.name === employeeName) ?? employees[0];
  const assignedServices = services
    .filter((service) =>
      service.team.some((member) =>
        member.toLowerCase().includes(employee?.name.split(" ")[0].toLowerCase() ?? "")
      )
    )
    .slice(0, 3);
  const visibleServices =
    assignedServices.length > 0 ? assignedServices : services.slice(0, 3);

  function reportIncident(customer: string) {
    notify("Incidencia registrada", `${customer}: queda pendiente de revisión.`);
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <h1 className="sr-only">Área empleado</h1>
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/employees" className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg border border-primary/35 bg-primary/12 text-primary">
              <UserRoundCheck className="size-5" />
            </span>
            <span>
              <span className="block text-sm font-semibold leading-none">
                Área empleado
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                Limpiezas Demo SL
              </span>
            </span>
          </Link>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/services">
                Servicios
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/dashboard">
                Panel CRM
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
          <Card className="border-border/70 bg-card/90 shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl">{employee?.name ?? employeeName}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <StatusBadge status={employee?.status ?? "Disponible"} />
                <Badge variant="secondary" className="rounded-md">
                  {employee?.role ?? "Operario/a"}
                </Badge>
              </div>
              <div className="grid gap-3 text-sm text-muted-foreground">
                <p className="flex items-center gap-2">
                  <Clock3 className="size-4" />
                  {employee?.availability ?? "L-V 08:00-16:00"}
                </p>
                <p className="flex items-center gap-2">
                  <BriefcaseBusiness className="size-4" />
                  {employee?.jobs ?? 0} servicios este mes
                </p>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span>Rendimiento</span>
                  <span className="font-medium">{employee?.score ?? 92}/100</span>
                </div>
                <Progress value={employee?.score ?? 92} />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/85 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarClock className="size-4 text-primary" />
                Jornada de hoy
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-border/70 bg-background/45 p-3">
                <p className="text-xs text-muted-foreground">Asignados</p>
                <p className="mt-1 text-2xl font-semibold">{visibleServices.length}</p>
              </div>
              <div className="rounded-md border border-border/70 bg-background/45 p-3">
                <p className="text-xs text-muted-foreground">Completados</p>
                <p className="mt-1 text-2xl font-semibold">
                  {visibleServices.filter((service) => service.status === "Completado").length}
                </p>
              </div>
              <div className="rounded-md border border-border/70 bg-background/45 p-3">
                <p className="text-xs text-muted-foreground">Importe</p>
                <p className="mt-1 text-2xl font-semibold">
                  {formatCurrency(
                    visibleServices.reduce((total, service) => total + service.price, 0)
                  )}
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4">
          {visibleServices.map((service) => (
            <Card key={service.id} className="border-border/70 bg-card/90 shadow-sm">
              <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="text-base">{service.title}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {service.customer}
                  </p>
                </div>
                <StatusBadge status={service.status} />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
                  <p className="flex items-center gap-2">
                    <MapPin className="size-4" />
                    {service.city}
                  </p>
                  <p className="flex items-center gap-2">
                    <CalendarClock className="size-4" />
                    {formatDate(service.start)}
                  </p>
                  <p className="flex items-center gap-2">
                    <BriefcaseBusiness className="size-4" />
                    {service.team.join(", ")}
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    onClick={() => updateServiceStatus(service.id, "En curso")}
                  >
                    <Play className="size-4" />
                    Iniciar
                  </Button>
                  <Button
                    type="button"
                    className="gap-2"
                    onClick={() => updateServiceStatus(service.id, "Completado")}
                  >
                    <CheckCircle2 className="size-4" />
                    Completar
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="gap-2"
                    onClick={() => reportIncident(service.customer)}
                  >
                    <CircleAlert className="size-4" />
                    Incidencia
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      </div>
    </main>
  );
}
