"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Building2, Clock3, Save, ShieldCheck, Users } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export type CompanySettingsValue = {
  name: string;
  timezone: string;
  clockRetentionYears: number;
  crmEnabled: boolean;
};

export function CompanySettings({ initialValue }: { initialValue: CompanySettingsValue }) {
  const router = useRouter();
  const [value, setValue] = React.useState(initialValue);
  const [status, setStatus] = React.useState<"idle" | "saving" | "saved" | "error">("idle");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");
    try {
      const response = await fetch("/api/control/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timezone: value.timezone,
          clockRetentionYears: value.clockRetentionYears,
          crmEnabled: value.crmEnabled,
        }),
      });
      if (!response.ok) throw new Error("Unable to save settings.");
      setStatus("saved");
      router.refresh();
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Company administration</p>
        <h1 className="mt-1 text-3xl font-semibold">Settings</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Time-tracking policies and subscribed modules for {value.name}.
        </p>
      </div>

      {status === "saved" ? (
        <Alert>
          <ShieldCheck className="size-4" />
          <AlertTitle>Settings saved</AlertTitle>
          <AlertDescription>Changes apply across the company.</AlertDescription>
        </Alert>
      ) : status === "error" ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to save changes</AlertTitle>
          <AlertDescription>Check your connection and try again.</AlertDescription>
        </Alert>
      ) : null}

      <form className="grid gap-4 lg:grid-cols-2" onSubmit={handleSubmit}>
        <Card className="border-border/70 bg-card/85 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock3 className="size-4 text-primary" />
              Time tracking
            </CardTitle>
            <CardDescription>Time zone and minimum history retention.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="company-timezone">Time zone</Label>
              <select
                id="company-timezone"
                value={value.timezone}
                onChange={(event) => setValue((current) => ({ ...current, timezone: event.target.value }))}
                className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="Europe/Madrid">Mainland Spain · Europe/Madrid</option>
                <option value="Atlantic/Canary">Canary Islands · Atlantic/Canary</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="retention-years">Clock-event retention</Label>
              <select
                id="retention-years"
                value={value.clockRetentionYears}
                onChange={(event) => setValue((current) => ({ ...current, clockRetentionYears: Number(event.target.value) }))}
                className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {[4, 5, 6, 7, 8, 9, 10].map((years) => (
                  <option key={years} value={years}>{years} years</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">WIA requires a minimum retention period of four years.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/85 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="size-4 text-primary" />
              Modules
            </CardTitle>
            <CardDescription>WIA Control operates independently from the CRM.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-start justify-between gap-4 rounded-lg border border-border/70 bg-background/45 p-4">
              <div>
                <p className="flex items-center gap-2 font-medium">
                  <Users className="size-4 text-primary" />
                  Sales CRM
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pipeline, customers, quotes, and billing. It shares customers and services but is not part of the operational core.
                </p>
              </div>
              <Switch
                checked={value.crmEnabled}
                onCheckedChange={(checked) => setValue((current) => ({ ...current, crmEnabled: checked }))}
                aria-label="Enable sales CRM"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end lg:col-span-2">
          <Button type="submit" disabled={status === "saving"}>
            <Save className="size-4" />
            {status === "saving" ? "Saving…" : "Save settings"}
          </Button>
        </div>
      </form>
    </div>
  );
}
