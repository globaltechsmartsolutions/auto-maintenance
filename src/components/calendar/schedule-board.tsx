"use client";

import * as React from "react";
import { GripVertical } from "lucide-react";
import { useDemo, type DemoService } from "@/components/demo/demo-provider";
import { Badge } from "@/components/ui/badge";

type Appointment = {
  id: string;
  serviceTitle: string;
  status: string;
  team: string;
  time: string;
  title: string;
};

type Column = {
  id: string;
  label: string;
  appointments: Appointment[];
};

function formatColumnLabel(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    weekday: "short",
  })
    .format(date)
    .replace(".", "");
}

function formatAppointmentTime(value: string) {
  return new Intl.DateTimeFormat("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function buildScheduleColumns(services: DemoService[]) {
  const grouped = services.reduce<Record<string, Appointment[]>>((columns, service) => {
    const dateKey = service.start.slice(0, 10);
    columns[dateKey] ??= [];
    columns[dateKey].push({
      id: service.id,
      serviceTitle: service.title,
      status: service.status,
      team: service.team.join(" + "),
      time: formatAppointmentTime(service.start),
      title: service.customer,
    });
    return columns;
  }, {});

  return Object.entries(grouped)
    .sort(([firstDate], [secondDate]) => firstDate.localeCompare(secondDate))
    .map(([dateKey, appointments]) => ({
      id: dateKey,
      label: formatColumnLabel(`${dateKey}T09:00:00`),
      appointments: appointments.sort((first, second) => first.time.localeCompare(second.time)),
    }));
}

export function ScheduleBoard() {
  const { assignServiceTeam, employees, rescheduleService, services } = useDemo();
  const [columns, setColumns] = React.useState<Column[]>(() => buildScheduleColumns(services));
  const [draggedId, setDraggedId] = React.useState<string | null>(null);
  const teamOptions = employees.map((employee) => employee.name);

  React.useEffect(() => {
    setColumns(buildScheduleColumns(services));
  }, [services]);

  function moveAppointment(targetColumnId: string, appointmentId = draggedId) {
    if (!appointmentId) return;

    const appointment = columns
      .flatMap((column) => column.appointments)
      .find((item) => item.id === appointmentId);

    if (!appointment) return;

    setColumns((current) =>
      current.map((column) => {
        const appointments = column.appointments.filter(
          (item) => item.id !== appointmentId
        );

        if (column.id === targetColumnId) {
          return {
            ...column,
            appointments: [...appointments, appointment],
          };
        }

        return {
          ...column,
          appointments,
        };
      })
    );
    rescheduleService(appointmentId, targetColumnId);
    setDraggedId(null);
  }

  return (
    <div className="grid min-h-[420px] gap-4 xl:grid-cols-5">
      {columns.map((column) => (
        <div
          key={column.id}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            moveAppointment(
              column.id,
              event.dataTransfer.getData("text/plain") || draggedId
            );
          }}
          data-testid={`schedule-column-${column.id}`}
          className="rounded-lg border border-border/70 bg-card/75 p-3"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">{column.label}</h3>
            <Badge variant="secondary">{column.appointments.length}</Badge>
          </div>
          <div className="space-y-3">
            {column.appointments.map((appointment) => (
              <div
                key={appointment.id}
                draggable
                onDragStart={(event) => {
                  setDraggedId(appointment.id);
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", appointment.id);
                }}
                data-testid={`schedule-appointment-${appointment.id}`}
                className="cursor-grab rounded-md border border-border bg-background/70 p-3 shadow-sm active:cursor-grabbing"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs text-muted-foreground">
                      {appointment.time}
                    </p>
                    <p className="mt-1 text-sm font-medium">{appointment.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {appointment.serviceTitle}
                    </p>
                  </div>
                  <GripVertical className="size-4 text-muted-foreground" />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {appointment.team}
                </p>
                <select
                  aria-label={`Asignar empleado a ${appointment.serviceTitle}`}
                  value={appointment.team === "Equipo por asignar" ? "" : appointment.team.split(" + ")[0]}
                  onChange={(event) => assignServiceTeam(appointment.id, event.target.value)}
                  className="mt-3 h-8 w-full rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Equipo por asignar</option>
                  {teamOptions.map((employeeName) => (
                    <option key={employeeName} value={employeeName}>
                      {employeeName}
                    </option>
                  ))}
                </select>
                <Badge variant="outline" className="mt-3 rounded-md">
                  {appointment.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
