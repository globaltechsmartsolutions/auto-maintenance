"use client";

import { CalendarClock } from "lucide-react";
import { useDemo, type DemoService } from "@/components/demo/demo-provider";
import { Badge } from "@/components/ui/badge";

const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type MonthEvent = {
  id: string;
  status: string;
  team: string;
  time: string;
  title: string;
};

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function buildMonthEvents(services: DemoService[]) {
  return services.reduce<Record<number, MonthEvent[]>>((events, service) => {
    const start = new Date(service.start);
    if (start.getFullYear() !== 2026 || start.getMonth() !== 5) {
      return events;
    }

    const day = start.getDate();
    events[day] ??= [];
    events[day].push({
      id: service.id,
      status: service.status,
      team: service.team.join(" + "),
      time: formatTime(service.start),
      title: service.customer,
    });
    return events;
  }, {});
}

export function MonthOverview() {
  const { services } = useDemo();
  const monthEvents = buildMonthEvents(services);
  const totalVisits = Object.values(monthEvents).reduce(
    (total, events) => total + events.length,
    0
  );

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[760px] space-y-3">
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-background/45 p-3">
          <div>
            <p className="text-sm font-medium">June 2026</p>
            <p className="text-xs text-muted-foreground">
              Monthly view of operational workload and scheduled visits.
            </p>
          </div>
          <Badge variant="secondary" className="rounded-md">
            {totalVisits} visits
          </Badge>
        </div>

        <div className="grid grid-cols-7 rounded-lg border border-border/70 bg-card/75">
          {weekDays.map((day) => (
            <div
              key={day}
              className="border-b border-border/70 px-3 py-2 text-xs font-medium text-muted-foreground"
            >
              {day}
            </div>
          ))}
          {Array.from({ length: 30 }, (_, index) => {
            const day = index + 1;
            const events = monthEvents[day] ?? [];

            return (
              <div
                key={day}
                className="min-h-28 border-b border-r border-border/70 p-2 last:border-r-0"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-muted-foreground">{day}</span>
                  {events.length > 0 ? (
                    <Badge variant="outline" className="h-5 rounded-md px-1.5 text-[10px]">
                      {events.length}
                    </Badge>
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  {events.map((event) => (
                    <div
                      key={event.id}
                      className="rounded-md border border-border/70 bg-background/70 p-2"
                    >
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <CalendarClock className="size-3" />
                        {event.time}
                      </div>
                      <p className="mt-1 truncate text-xs font-medium">{event.title}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {event.team}
                      </p>
                      <Badge variant="outline" className="mt-1 h-5 rounded-md px-1.5 text-[10px]">
                        {event.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
