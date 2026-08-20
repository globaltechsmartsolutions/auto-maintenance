"use client";

import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { CheckCircle2, Circle, Download, FileUp, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Progress = { customers: number; worksites: number; employees: number; services: number; shifts: number; clockEvents: number };
type Preview = { rowCount: number; validRows: number; invalidRows: number; issues: Array<{ row: number; field: string; message: string }> };
type ImportRow = { row: number; status: "IMPORTED" | "SKIPPED_DUPLICATE" | "FAILED"; message: string };
type ImportResult = { kind: string; committed: boolean; replayed: boolean; totalRows: number; imported: number; skipped: number; failed: number; rows: ImportRow[] };

const steps: Array<{ key: keyof Progress; label: string; description: string; href: Route }> = [
  { key: "customers", label: "Add a customer", description: "Identify the client receiving the service.", href: "/crm" },
  { key: "worksites", label: "Create a worksite", description: "Set the location and verification method.", href: "/worksites" },
  { key: "employees", label: "Invite the field team", description: "Add skills, zones, and availability.", href: "/employees" },
  { key: "services", label: "Create a client service", description: "Record the operational commitment.", href: "/services" },
  { key: "shifts", label: "Plan the first shift", description: "Link the worksite, service, and worker.", href: "/shifts" },
  { key: "clockEvents", label: "Complete the first clock", description: "Verify the end-to-end attendance flow.", href: "/employee" },
];

const importKinds = [
  { value: "EMPLOYEES", label: "Employees" },
  { value: "WORKSITES", label: "Worksites" },
  { value: "SERVICES", label: "Services" },
  { value: "SHIFTS", label: "Shifts" },
];

const rowTone: Record<ImportRow["status"], string> = {
  IMPORTED: "text-success",
  SKIPPED_DUPLICATE: "text-muted-foreground",
  FAILED: "text-destructive",
};

export function PilotOnboarding() {
  const [progress, setProgress] = React.useState<Progress>();
  const [importKind, setImportKind] = React.useState("WORKSITES");
  const [preview, setPreview] = React.useState<Preview>();
  const [previewError, setPreviewError] = React.useState<string>();
  const [csv, setCsv] = React.useState<string>();
  const [confirmationStatus, setConfirmationStatus] = React.useState<"idle" | "confirming" | "done">("idle");
  const [result, setResult] = React.useState<ImportResult>();

  const refreshProgress = React.useCallback(() => {
    void fetch("/api/control/onboarding", { cache: "no-store" })
      .then(async (response) => (response.ok ? response.json() : undefined))
      .then((body) => { if (body?.progress) setProgress(body.progress); })
      .catch(() => undefined);
  }, []);
  React.useEffect(() => { refreshProgress(); }, [refreshProgress]);

  const complete = steps.filter((step) => (progress?.[step.key] ?? 0) > 0).length;

  function resetImport() { setPreview(undefined); setCsv(undefined); setResult(undefined); setPreviewError(undefined); setConfirmationStatus("idle"); }

  async function previewFile(file?: File) {
    if (!file) return;
    resetImport();
    try {
      const contents = await file.text();
      setCsv(contents);
      const response = await fetch("/api/control/imports/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: importKind, csv: contents }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "The CSV could not be previewed.");
      setPreview(body.preview);
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : "The CSV could not be previewed.");
    }
  }

  async function confirmImport() {
    if (!csv || !preview || preview.invalidRows) return;
    setConfirmationStatus("confirming");
    setPreviewError(undefined);
    try {
      const response = await fetch("/api/control/imports/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: importKind, csv }) });
      const body = await response.json();
      if (!response.ok && !body.result) throw new Error(body.error ?? "The CSV could not be imported.");
      setResult(body.result);
      setConfirmationStatus("done");
      refreshProgress();
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : "The CSV could not be imported.");
      setConfirmationStatus("idle");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Controlled pilot</p>
        <h1 className="mt-1 text-3xl font-semibold">Pilot setup</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Complete one verifiable service cycle before inviting a customer to the pilot.</p>
      </div>

      <Card className="border-primary/25 bg-card/90 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Rocket className="size-5 text-primary" />First operational cycle</CardTitle>
          <CardDescription>{progress ? `${complete} of ${steps.length} steps complete` : "Loading workspace progress…"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {steps.map((step, index) => {
            const done = (progress?.[step.key] ?? 0) > 0;
            return (
              <Link href={step.href} key={step.key} className="flex items-center justify-between gap-4 rounded-lg border border-border/70 p-4 transition hover:bg-muted/40">
                <div className="flex items-start gap-3">
                  {done ? <CheckCircle2 className="mt-0.5 size-5 text-success" /> : <Circle className="mt-0.5 size-5 text-muted-foreground" />}
                  <div>
                    <p className="font-medium">{index + 1}. {step.label}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
                  </div>
                </div>
                <Badge variant={done ? "secondary" : "outline"}>{done ? "Complete" : "Open"}</Badge>
              </Link>
            );
          })}
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/90 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileUp className="size-5 text-primary" />CSV import</CardTitle>
          <CardDescription>Preview every row first. Worksites, services, and shifts are written in one transaction: if any row fails, nothing is created. Employees are invited row by row through the invitation workflow.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <select aria-label="Import kind" value={importKind} onChange={(event) => { setImportKind(event.target.value); resetImport(); }} className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm">
              {importKinds.map((kind) => <option key={kind.value} value={kind.value}>{kind.label}</option>)}
            </select>
            <input aria-label="CSV file" type="file" accept=".csv,text/csv" onChange={(event) => void previewFile(event.target.files?.[0])} className="block text-sm" />
            <a href={`/api/control/imports/template?kind=${importKind}`} className="inline-flex items-center gap-1.5 text-sm text-primary underline-offset-4 hover:underline">
              <Download className="size-4" />Download template
            </a>
          </div>

          {previewError ? <p className="text-sm text-destructive">{previewError}</p> : null}

          {preview ? (
            <div className="rounded-lg border border-border/70 p-3 text-sm">
              <p className="font-medium">{preview.validRows} valid of {preview.rowCount} rows</p>
              <p className="mt-1 text-muted-foreground">{preview.invalidRows} rows need correction. No data has been created.</p>
              {preview.issues.length ? (
                <div className="mt-3 space-y-1 text-xs text-destructive">
                  {preview.issues.slice(0, 8).map((issue, index) => <p key={`${issue.row}-${issue.field}-${index}`}>Row {issue.row}, {issue.field}: {issue.message}</p>)}
                </div>
              ) : (
                <Button type="button" className="mt-3" onClick={() => void confirmImport()} disabled={confirmationStatus === "confirming"}>
                  {confirmationStatus === "confirming" ? "Importing…" : importKind === "EMPLOYEES" ? "Send invitations" : "Confirm import"}
                </Button>
              )}
            </div>
          ) : null}

          {result ? (
            <div className="rounded-lg border border-border/70 p-3 text-sm">
              <p className="font-medium">
                {result.committed
                  ? result.replayed
                    ? "This exact file was already imported. Nothing was created again."
                    : `${result.imported} imported, ${result.skipped} skipped, ${result.failed} failed of ${result.totalRows} rows`
                  : "The file was rejected and nothing was created."}
              </p>
              <div className="mt-3 space-y-1 text-xs">
                {result.rows.slice(0, 20).map((row) => (
                  <p key={row.row} className={rowTone[row.status]}>Row {row.row}: {row.status.toLowerCase().replace("_", " ")} — {row.message}</p>
                ))}
                {result.rows.length > 20 ? <p className="text-muted-foreground">…and {result.rows.length - 20} more rows.</p> : null}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
