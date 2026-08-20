"use client";

import * as React from "react";
import { TimerReset } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Metrics = { incidentCount: number; acknowledgedCount: number; recoveredCount: number; averageAcknowledgementMinutes: number | null; averageRecoveryMinutes: number | null };

function duration(value: number | null) {
  if (value === null) return "No data";
  return value >= 60 ? `${Math.floor(value / 60)}h ${value % 60}m` : `${value}m`;
}

export function CoverageRecoveryMetrics() {
  const [metrics, setMetrics] = React.useState<Metrics>();
  React.useEffect(() => {
    const to = new Date();
    const from = new Date(to); from.setDate(from.getDate() - 30);
    void fetch(`/api/control/coverage/metrics?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`, { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() : undefined)
      .then((body) => { if (body?.metrics) setMetrics(body.metrics); })
      .catch(() => undefined);
  }, []);
  return <Card className="border-border/70 bg-card/85 shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><TimerReset className="size-4 text-primary" />Recovery performance</CardTitle><CardDescription>Last 30 days, calculated from server-side incident and coverage timestamps.</CardDescription></CardHeader><CardContent className="grid gap-4 sm:grid-cols-3">{[["Average acknowledgement", duration(metrics?.averageAcknowledgementMinutes ?? null)], ["Average recovery", duration(metrics?.averageRecoveryMinutes ?? null)], ["Recovered incidents", metrics ? `${metrics.recoveredCount} / ${metrics.incidentCount}` : "Loading…"]].map(([label, value]) => <div key={label} className="rounded-lg border border-border/70 p-3"><p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{label}</p><p className="mt-2 text-xl font-semibold tabular-nums">{value}</p></div>)}</CardContent></Card>;
}
