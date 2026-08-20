"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Brief = {
  headline: string;
  summary: string;
  priorities: Array<{ shiftId: string; severity: string; reason: string; recommendedAction: string }>;
  draftMessage: string;
};

export function OperationsAiBrief() {
  const [brief, setBrief] = React.useState<Brief>();
  const [status, setStatus] = React.useState<"idle" | "loading" | "unavailable" | "error">("idle");

  async function generate() {
    setStatus("loading");
    try {
      const response = await fetch("/api/control/ai/operations-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: new Date().toISOString().slice(0, 10) }),
      });
      const body = await response.json().catch(() => ({}));
      if (response.status === 503) { setStatus("unavailable"); return; }
      if (!response.ok) throw new Error(body.error ?? "The operations brief could not be generated.");
      setBrief(body.brief);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  return <Card className="border-primary/25 bg-card/90 shadow-sm"><CardHeader className="flex-row items-start justify-between gap-4"><div><CardTitle className="flex items-center gap-2 text-base"><Sparkles className="size-4 text-primary" />AI operations brief</CardTitle><CardDescription className="mt-1">A human-approved draft based only on today&apos;s operational records.</CardDescription></div><Button type="button" size="sm" onClick={() => void generate()} disabled={status === "loading"}>{status === "loading" ? "Preparing…" : brief ? "Refresh" : "Generate brief"}</Button></CardHeader><CardContent>{status === "unavailable" ? <p className="text-sm text-muted-foreground">AI is disabled. Set <code>AI_GATEWAY_API_KEY</code> and <code>AI_OPERATIONS_BRIEF_ENABLED=true</code> to enable it.</p> : status === "error" ? <p className="text-sm text-destructive">The brief could not be generated. No operational record was changed.</p> : brief ? <div className="space-y-4"><div><p className="font-medium">{brief.headline}</p><p className="mt-1 text-sm text-muted-foreground">{brief.summary}</p></div>{brief.priorities.length ? <div className="space-y-2">{brief.priorities.map((priority) => <div key={priority.shiftId} className="rounded-lg border border-border/70 p-3 text-sm"><div className="flex items-center gap-2"><Badge variant="outline">{priority.severity}</Badge><span className="font-medium">{priority.reason}</span></div><p className="mt-1 text-muted-foreground">Next action: {priority.recommendedAction}</p></div>)}</div> : null}<div className="rounded-lg bg-muted/50 p-3 text-sm"><p className="font-medium">Draft message — review before sending</p><p className="mt-1 whitespace-pre-wrap text-muted-foreground">{brief.draftMessage}</p></div></div> : <p className="text-sm text-muted-foreground">Generate a concise priority list and communication draft. It cannot assign staff or modify attendance evidence.</p>}</CardContent></Card>;
}
