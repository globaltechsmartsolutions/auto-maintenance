"use client";

import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { CheckCircle2, Circle, Rocket } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Progress = { customers: number; worksites: number; employees: number; services: number; shifts: number; clockEvents: number };
const steps: Array<{ key: keyof Progress; label: string; description: string; href: Route }> = [
  { key: "customers", label: "Add a customer", description: "Identify the client receiving the service.", href: "/crm" },
  { key: "worksites", label: "Create a worksite", description: "Set the location and verification method.", href: "/worksites" },
  { key: "employees", label: "Invite the field team", description: "Add skills, zones, and availability.", href: "/employees" },
  { key: "services", label: "Create a client service", description: "Record the operational commitment.", href: "/services" },
  { key: "shifts", label: "Plan the first shift", description: "Link the worksite, service, and worker.", href: "/shifts" },
  { key: "clockEvents", label: "Complete the first clock", description: "Verify the end-to-end attendance flow.", href: "/employee" },
];

export function PilotOnboarding() {
  const [progress, setProgress] = React.useState<Progress>();
  React.useEffect(() => { void fetch("/api/control/onboarding", { cache: "no-store" }).then(async (response) => response.ok ? response.json() : undefined).then((body) => { if (body?.progress) setProgress(body.progress); }).catch(() => undefined); }, []);
  const complete = steps.filter((step) => (progress?.[step.key] ?? 0) > 0).length;
  return <div className="space-y-6"><div><p className="text-sm text-muted-foreground">Controlled pilot</p><h1 className="mt-1 text-3xl font-semibold">Pilot setup</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Complete one verifiable service cycle before inviting a customer to the pilot.</p></div><Card className="border-primary/25 bg-card/90 shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2"><Rocket className="size-5 text-primary" />First operational cycle</CardTitle><CardDescription>{progress ? `${complete} of ${steps.length} steps complete` : "Loading workspace progress…"}</CardDescription></CardHeader><CardContent className="space-y-3">{steps.map((step, index) => { const done = (progress?.[step.key] ?? 0) > 0; return <Link href={step.href} key={step.key} className="flex items-center justify-between gap-4 rounded-lg border border-border/70 p-4 transition hover:bg-muted/40"><div className="flex items-start gap-3">{done ? <CheckCircle2 className="mt-0.5 size-5 text-success" /> : <Circle className="mt-0.5 size-5 text-muted-foreground" />}<div><p className="font-medium">{index + 1}. {step.label}</p><p className="mt-1 text-sm text-muted-foreground">{step.description}</p></div></div><Badge variant={done ? "secondary" : "outline"}>{done ? "Complete" : "Open"}</Badge></Link>; })}</CardContent></Card></div>;
}
