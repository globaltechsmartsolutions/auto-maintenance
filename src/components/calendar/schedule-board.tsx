"use client";

import * as React from "react";
import { GripVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { scheduleColumns } from "@/lib/mock-data";

type Appointment = (typeof scheduleColumns)[number]["appointments"][number];
type Column = {
  id: string;
  label: string;
  appointments: Appointment[];
};

export function ScheduleBoard() {
  const [columns, setColumns] = React.useState<Column[]>(scheduleColumns);
  const [draggedId, setDraggedId] = React.useState<string | null>(null);

  function moveAppointment(targetColumnId: string) {
    if (!draggedId) return;

    const appointment = columns
      .flatMap((column) => column.appointments)
      .find((item) => item.id === draggedId);

    if (!appointment) return;

    setColumns((current) =>
      current.map((column) => {
        const appointments = column.appointments.filter(
          (item) => item.id !== draggedId
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
    setDraggedId(null);
  }

  return (
    <div className="grid min-h-[420px] gap-4 xl:grid-cols-5">
      {columns.map((column) => (
        <div
          key={column.id}
          onDragOver={(event) => event.preventDefault()}
          onDrop={() => moveAppointment(column.id)}
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
                onDragStart={() => setDraggedId(appointment.id)}
                className="cursor-grab rounded-md border border-border bg-background/70 p-3 shadow-sm active:cursor-grabbing"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs text-muted-foreground">
                      {appointment.time}
                    </p>
                    <p className="mt-1 text-sm font-medium">{appointment.title}</p>
                  </div>
                  <GripVertical className="size-4 text-muted-foreground" />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {appointment.team}
                </p>
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
