"use client";

import * as React from "react";
import Link from "next/link";
import { AlarmClock, ArrowRight, ListChecks, Loader2, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Alert = "OVERDUE" | "UNOWNED" | "STALE" | null;

type QueueRow = {
  incidentId: string;
  status: string;
  severity: string;
  title: string;
  detectedAt: string;
  dueAt?: string | null;
  owner: { id: string; name: string } | null;
  worksite: { id: string; name: string };
  service: { id: string; title: string; customer: string } | null;
  shift: { id: string; title: string; status: string; scheduledStart: string };
  assignedTo: string | null;
  coverage: { decidedAt: string; employee: string | null; acknowledged: boolean } | null;
  action: { code: string; label: string };
  alert: Alert;
  ageMinutes: number;
  overdueMinutes: number;
};

type Queue = {
  generatedAt: string;
  counts: { total: number; overdue: number; unowned: number; stale: number };
  rows: QueueRow[];
};

const alertStyle: Record<Exclude<Alert, null>, { label: string; className: string }> = {
  OVERDUE: { label: "Overdue", className: "border-destructive/40 bg-destructive/10 text-destructive" },
  UNOWNED: { label: "No owner", className: "border-warning/40 bg-warning/10 text-warning" },
  STALE: { label: "Waiting too long", className: "border-warning/40 bg-warning/10 text-warning" },
};

function formatAge(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours} h ${minutes % 60} min`;
}

/**
 * The daily triage view: every at-risk service ordered by what will hurt
 * first, each row naming its accountable coordinator and the single next human
 * action. It never takes an action by itself.
 */
export function RecoveryQueue() {
  const [queue, setQueue] = React.useState<Queue>();
  const [services, setServices] = React.useState<Array<{ id: string; title: string }>>([]);
  const [serviceId, setServiceId] = React.useState("");
  const [ownerFilter, setOwnerFilter] = React.useState("");
  const [busyIncident, setBusyIncident] = React.useState<string>();
  const [error, setError] = React.useState<string>();

  const load = React.useCallback(() => {
    const params = new URLSearchParams();
    if (serviceId) params.set("serviceId", serviceId);
    if (ownerFilter) params.set("ownerId", ownerFilter);
    void fetch(`/api/control/coverage/queue?${params.toString()}`, { cache: "no-store" })
      .then(async (response) => (response.ok ? response.json() : undefined))
      .then((body) => {
        if (!body) return;
        setQueue(body.queue);
        setServices(body.services ?? []);
      })
      .catch(() => setError("The recovery queue could not be loaded."));
  }, [serviceId, ownerFilter]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function act(incidentId: string, body: Record<string, unknown>) {
    setBusyIncident(incidentId);
    setError(undefined);
    try {
      const response = await fetch(`/api/control/incidents/${incidentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "The action could not be recorded.");
      load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "The action could not be recorded.");
    } finally {
      setBusyIncident(undefined);
    }
  }

  return (
    <Card className="border-border/70 bg-card/90 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ListChecks className="size-4 text-primary" />
          Recovery queue
        </CardTitle>
        <CardDescription>
          {queue
            ? `${queue.counts.total} at risk · ${queue.counts.overdue} overdue · ${queue.counts.unowned} with no owner`
            : "Loading the queue…"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <select
            aria-label="Filter by service"
            value={serviceId}
            onChange={(event) => setServiceId(event.target.value)}
            className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm"
          >
            <option value="">All services</option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.title}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by owner"
            value={ownerFilter}
            onChange={(event) => setOwnerFilter(event.target.value)}
            className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm"
          >
            <option value="">Any owner</option>
            <option value="UNASSIGNED">No owner yet</option>
          </select>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {queue && queue.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing is at risk right now. Detected incidents will appear here with their owner and next
            action.
          </p>
        ) : null}

        {queue?.rows.map((row) => (
          <div
            key={row.incidentId}
            className={cn(
              "rounded-lg border p-4",
              row.alert === "OVERDUE" ? "border-destructive/40" : "border-border/70"
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{row.title}</p>
                  <Badge variant="outline">{row.severity.toLowerCase()}</Badge>
                  {row.alert ? (
                    <Badge variant="outline" className={alertStyle[row.alert].className}>
                      {alertStyle[row.alert].label}
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {row.service ? `${row.service.customer} · ${row.service.title} · ` : ""}
                  {row.worksite.name} · {row.shift.title}
                </p>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <p className="flex items-center justify-end gap-1">
                  <AlarmClock className="size-3.5" />
                  open for {formatAge(row.ageMinutes)}
                </p>
                {row.overdueMinutes ? <p>overdue by {formatAge(row.overdueMinutes)}</p> : null}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span>
                Owner:{" "}
                {row.owner ? (
                  <span className="font-medium">{row.owner.name}</span>
                ) : (
                  <span className="text-warning">nobody yet</span>
                )}
              </span>
              {row.coverage ? (
                <span className="text-muted-foreground">
                  Cover: {row.coverage.employee ?? "assigned"}
                  {row.coverage.acknowledged ? " (acknowledged)" : " (not acknowledged)"}
                </span>
              ) : null}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <p className="mr-auto text-sm font-medium text-primary">{row.action.label}</p>
              {row.action.code === "ASSIGN_OWNER" || row.action.code === "ESCALATE" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busyIncident === row.incidentId}
                  onClick={() => void act(row.incidentId, { action: "ASSIGN" })}
                >
                  {busyIncident === row.incidentId ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <UserPlus className="size-3.5" />
                  )}
                  Take ownership
                </Button>
              ) : null}
              {row.action.code === "ACKNOWLEDGE" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busyIncident === row.incidentId}
                  onClick={() => void act(row.incidentId, { status: "ACKNOWLEDGED" })}
                >
                  Acknowledge
                </Button>
              ) : null}
              <Button asChild type="button" size="sm" variant="ghost">
                <Link href="/time-tracking">
                  Open incident
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
