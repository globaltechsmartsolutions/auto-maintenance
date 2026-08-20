"use client";

import * as React from "react";
import { CheckCircle2, ClipboardList, Loader2, Paperclip, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type TemplateField =
  | { key: string; label: string; type: "boolean"; required: boolean }
  | { key: string; label: string; type: "text"; required: boolean; maxLength: number; minLength?: number }
  | { key: string; label: string; type: "number"; required: boolean; min: number; max: number }
  | { key: string; label: string; type: "choice"; required: boolean; options: string[] };

type DeliveryTemplate = {
  key: string;
  version: number;
  title: string;
  description: string;
  fields: TemplateField[];
};

type Submission = {
  id: string;
  templateKey: string;
  templateVersion: number;
  capturedOffline: boolean;
  submittedAt: string;
  summary: string;
  evidence: Array<{ id: string; fileName: string }>;
};

type AnswerValue = string | number | boolean;

/**
 * A draft that survives a reload and a lost connection. The submission id is
 * generated once, when the worker starts answering, and is reused for every
 * retry — the same rule the offline clock queue follows, and what lets the
 * server treat a resend as the same submission rather than a second one.
 */
type Draft = { clientSubmissionId: string; answers: Record<string, AnswerValue>; capturedAt: string };

function draftKey(shiftId: string, templateKey: string) {
  return `wia-delivery-draft:${shiftId}:${templateKey}`;
}

function readDraft(shiftId: string, templateKey: string): Draft | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(draftKey(shiftId, templateKey));
    return raw ? (JSON.parse(raw) as Draft) : undefined;
  } catch {
    return undefined;
  }
}

function writeDraft(shiftId: string, templateKey: string, draft: Draft) {
  try {
    window.localStorage.setItem(draftKey(shiftId, templateKey), JSON.stringify(draft));
  } catch {
    // A full or unavailable storage must not stop the worker from submitting;
    // the draft simply stops surviving a reload.
  }
}

function clearDraft(shiftId: string, templateKey: string) {
  try {
    window.localStorage.removeItem(draftKey(shiftId, templateKey));
  } catch {
    // Nothing to recover from: the submission itself already succeeded.
  }
}

function newDraft(): Draft {
  return {
    clientSubmissionId:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `draft-${Date.now()}-${Math.round(Math.random() * 1e9)}`,
    answers: {},
    capturedAt: new Date().toISOString(),
  };
}

export function DeliveryCapture({ shiftId }: { shiftId: string }) {
  const [templates, setTemplates] = React.useState<DeliveryTemplate[]>([]);
  const [selectedKey, setSelectedKey] = React.useState<string>();
  const [draft, setDraft] = React.useState<Draft>();
  const [submissions, setSubmissions] = React.useState<Submission[]>([]);
  const [status, setStatus] = React.useState<"idle" | "saving" | "attaching">("idle");
  const [error, setError] = React.useState<string>();

  const template = templates.find((item) => item.key === selectedKey);

  const loadSubmissions = React.useCallback(() => {
    void fetch(`/api/control/shifts/${shiftId}/submissions`, { cache: "no-store" })
      .then(async (response) => (response.ok ? response.json() : undefined))
      .then((body) => setSubmissions(body?.submissions ?? []))
      .catch(() => undefined);
  }, [shiftId]);

  React.useEffect(() => {
    void fetch("/api/control/templates", { cache: "no-store" })
      .then(async (response) => (response.ok ? response.json() : undefined))
      .then((body) => {
        const list: DeliveryTemplate[] = body?.templates ?? [];
        setTemplates(list);
        setSelectedKey((current) => current ?? list[0]?.key);
      })
      .catch(() => setError("The delivery templates could not be loaded."));
    loadSubmissions();
  }, [loadSubmissions]);

  React.useEffect(() => {
    if (!selectedKey) return;
    setDraft(readDraft(shiftId, selectedKey) ?? newDraft());
    setError(undefined);
  }, [shiftId, selectedKey]);

  function setAnswer(field: string, value: AnswerValue) {
    setDraft((current) => {
      if (!current || !selectedKey) return current;
      const next = { ...current, answers: { ...current.answers, [field]: value } };
      writeDraft(shiftId, selectedKey, next);
      return next;
    });
  }

  async function submit() {
    if (!template || !draft) return;
    setStatus("saving");
    setError(undefined);
    try {
      const response = await fetch(`/api/control/shifts/${shiftId}/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateKey: template.key,
          templateVersion: template.version,
          clientSubmissionId: draft.clientSubmissionId,
          answers: draft.answers,
          submittedAt: draft.capturedAt,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "The answers could not be sent.");
      clearDraft(shiftId, template.key);
      setDraft(newDraft());
      loadSubmissions();
    } catch (submitError) {
      // The draft and its submission id are kept, so pressing send again after
      // the connection returns cannot produce a second submission.
      setError(
        submitError instanceof Error
          ? `${submitError.message} Your answers are saved on this device; send again when you have signal.`
          : "The answers could not be sent. They are saved on this device."
      );
    } finally {
      setStatus("idle");
    }
  }

  async function attachEvidence(submissionId: string, file?: File) {
    if (!file) return;
    setStatus("attaching");
    setError(undefined);
    try {
      const reserve = await fetch("/api/control/evidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shiftId,
          submissionId,
          fileName: file.name,
          contentType: file.type,
          sizeBytes: file.size,
        }),
      });
      const reserved = await reserve.json();
      if (!reserve.ok) throw new Error(reserved.error ?? "The photo could not be prepared.");

      const upload = await fetch(reserved.upload.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!upload.ok) throw new Error("The photo could not be uploaded.");

      const confirm = await fetch(`/api/control/evidence/${reserved.upload.attachmentId}/confirm`, {
        method: "POST",
      });
      const confirmed = await confirm.json();
      if (!confirm.ok) throw new Error(confirmed.error ?? "The photo was rejected.");
      loadSubmissions();
    } catch (attachError) {
      setError(attachError instanceof Error ? attachError.message : "The photo could not be attached.");
    } finally {
      setStatus("idle");
    }
  }

  return (
    <Card className="border-border/70 bg-card/90 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardList className="size-4 text-primary" />
          Service delivery
        </CardTitle>
        <CardDescription>
          Answers are saved on this device first, so you can complete them without signal and send them
          when you are back online.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {templates.map((item) => (
            <Button
              key={item.key}
              type="button"
              size="sm"
              variant={item.key === selectedKey ? "default" : "outline"}
              onClick={() => setSelectedKey(item.key)}
            >
              {item.title}
            </Button>
          ))}
        </div>

        {template && draft ? (
          <div className="space-y-4 rounded-lg border border-border/70 bg-background/40 p-3">
            <p className="text-sm text-muted-foreground">{template.description}</p>
            {template.fields.map((field) => {
              const value = draft.answers[field.key];
              const id = `${template.key}-${field.key}`;
              if (field.type === "boolean") {
                return (
                  <label key={field.key} htmlFor={id} className="flex items-center gap-3 text-sm">
                    <input
                      id={id}
                      type="checkbox"
                      className="size-4"
                      checked={value === true}
                      onChange={(event) => setAnswer(field.key, event.target.checked)}
                    />
                    <span>
                      {field.label}
                      {field.required ? " *" : ""}
                    </span>
                  </label>
                );
              }
              if (field.type === "choice") {
                return (
                  <div key={field.key} className="space-y-1.5">
                    <Label htmlFor={id}>
                      {field.label}
                      {field.required ? " *" : ""}
                    </Label>
                    <select
                      id={id}
                      className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
                      value={typeof value === "string" ? value : ""}
                      onChange={(event) => setAnswer(field.key, event.target.value)}
                    >
                      <option value="">Choose…</option>
                      {field.options.map((option) => (
                        <option key={option} value={option}>
                          {option.toLowerCase().replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              }
              if (field.type === "number") {
                return (
                  <div key={field.key} className="space-y-1.5">
                    <Label htmlFor={id}>
                      {field.label}
                      {field.required ? " *" : ""}
                    </Label>
                    <Input
                      id={id}
                      type="number"
                      inputMode="numeric"
                      min={field.min}
                      max={field.max}
                      value={typeof value === "number" ? value : ""}
                      onChange={(event) => setAnswer(field.key, Number(event.target.value))}
                    />
                  </div>
                );
              }
              return (
                <div key={field.key} className="space-y-1.5">
                  <Label htmlFor={id}>
                    {field.label}
                    {field.required ? " *" : ""}
                  </Label>
                  <Textarea
                    id={id}
                    maxLength={field.maxLength}
                    value={typeof value === "string" ? value : ""}
                    onChange={(event) => setAnswer(field.key, event.target.value)}
                  />
                </div>
              );
            })}

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <Button type="button" onClick={() => void submit()} disabled={status !== "idle"}>
              {status === "saving" ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-4" />
                  Send {template.title.toLowerCase()}
                </>
              )}
            </Button>
          </div>
        ) : null}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Sent for this shift</p>
            <Button type="button" size="sm" variant="ghost" onClick={loadSubmissions}>
              <RefreshCw className="size-3.5" />
              Refresh
            </Button>
          </div>
          {submissions.length ? (
            submissions.map((submission) => (
              <div key={submission.id} className="rounded-lg border border-border/70 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{submission.summary}</p>
                  {submission.capturedOffline ? <Badge variant="outline">Captured offline</Badge> : null}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span>{submission.evidence.length} photo(s) attached</span>
                  <label className="inline-flex cursor-pointer items-center gap-1.5 text-primary">
                    <Paperclip className="size-3.5" />
                    Attach a photo
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                      className="hidden"
                      onChange={(event) => void attachEvidence(submission.id, event.target.files?.[0])}
                    />
                  </label>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Nothing has been sent for this shift yet.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
