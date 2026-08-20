"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  Coffee,
  Loader2,
  LogIn,
  LogOut,
  MapPin,
  MapPinCheck,
  Play,
  RotateCcw,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import {
  useWiaControl,
  type ClockEventType,
  type ClockEvent,
  type PlannedShift,
} from "@/components/control/wia-control-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const eventLabels: Record<ClockEventType, string> = {
  CLOCK_IN: "Clock-in",
  BREAK_START: "Break started",
  BREAK_END: "Break ended",
  CLOCK_OUT: "Clock-out",
};

function formatTime(value: string, timezone: string = "Europe/Madrid") {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  }).format(new Date(value));
}

function ShiftSummary({ shift }: { shift: PlannedShift }) {
  const { companyTimezone, worksites } = useWiaControl();
  const site = worksites.find((item) => item.id === shift.worksiteId);
  return (
    <div className="rounded-lg border border-border/70 bg-background/40 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">{shift.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{site?.name}</p>
        </div>
        <Badge variant="secondary" className="rounded-md tabular-nums">
          {formatTime(shift.startsAt, companyTimezone)}–{formatTime(shift.endsAt, companyTimezone)}
        </Badge>
      </div>
    </div>
  );
}

function CorrectionDialog({
  event,
  open,
  onOpenChange,
}: {
  event?: ClockEvent;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { requestTimeCorrection } = useWiaControl();

  function handleSubmit(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (!event) return;
    const data = new FormData(formEvent.currentTarget);
    const created = requestTimeCorrection(
      event.id,
      String(data.get("correctedTime") ?? ""),
      String(data.get("reason") ?? "")
    );
    if (created) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Request correction</DialogTitle>
          <DialogDescription>
            The original clock event will be retained. The company will review the proposed time separately.
          </DialogDescription>
        </DialogHeader>
        <form id="correction-form" className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="corrected-time">Correct date and time</Label>
            <Input
              id="corrected-time"
              name="correctedTime"
              type="datetime-local"
              defaultValue={event?.occurredAt.slice(0, 16)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="correction-reason">Reason</Label>
            <Textarea
              id="correction-reason"
              name="reason"
              minLength={10}
              maxLength={1000}
              placeholder="Explain what happened so the coordinator can review it."
              required
            />
          </div>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="correction-form">Send request</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EmployeeClock() {
  const {
    acknowledgeTimeCorrection,
    clockQueueStatus,
    companyTimezone,
    employees,
    shifts,
    worksites,
    clockEvents,
    corrections,
    recordClockEvent,
    retryQueuedClockEvent,
  } = useWiaControl();
  const employeeName = employees[0]?.name ?? "Laura Méndez";
  const [correctionEvent, setCorrectionEvent] = React.useState<ClockEvent>();
  const [disagreementId, setDisagreementId] = React.useState<string>();
  const [disagreementReason, setDisagreementReason] = React.useState("");
  const employeeShifts = shifts.filter((shift) => shift.employeeName === employeeName);
  const activeShift =
    employeeShifts.find((shift) => ["ACTIVE", "PAUSED"].includes(shift.status)) ??
    employeeShifts.find((shift) => !["COMPLETED", "CANCELLED"].includes(shift.status)) ??
    employeeShifts[0];
  const activeSite = worksites.find((site) => site.id === activeShift?.worksiteId);
  const queueEntry = activeShift ? clockQueueStatus[activeShift.id] : undefined;
  const isSyncingClock = queueEntry?.status === "pending" || queueEntry?.status === "sending";
  const shiftEvents = React.useMemo(
    () =>
      clockEvents
        .filter((event) => event.shiftId === activeShift?.id)
        .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)),
    [activeShift?.id, clockEvents]
  );
  const latestEvent = shiftEvents[0];
  const hasClockedOut = latestEvent?.type === "CLOCK_OUT";
  const isPaused = latestEvent?.type === "BREAK_START";
  const hasClockedIn = shiftEvents.some((event) => event.type === "CLOCK_IN");
  const employeeCorrections = corrections.filter(
    (correction) => correction.employeeName === employeeName
  );

  function runPrimaryAction() {
    if (!activeShift || isSyncingClock) return;
    const type: ClockEventType = !hasClockedIn
      ? "CLOCK_IN"
      : isPaused
        ? "BREAK_END"
        : "BREAK_START";
    recordClockEvent(activeShift.id, type);
  }

  const primaryLabel = !hasClockedIn
    ? "Clock in"
    : isPaused
      ? "Resume shift"
      : "Start break";
  const PrimaryIcon = !hasClockedIn ? LogIn : isPaused ? Play : Coffee;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-5 px-4 py-5 sm:px-6 lg:py-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/control" className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg border border-primary/35 bg-primary/12 text-primary">
              <ShieldCheck className="size-5" />
            </span>
            <span>
              <span className="block text-sm font-semibold leading-none">WIA Control</span>
              <span className="mt-1 block text-xs text-muted-foreground">Employee area</span>
            </span>
          </Link>
          <Button asChild variant="outline" size="sm">
            <Link href="/control">
              <ArrowLeft className="size-4" />
              Back to operations
            </Link>
          </Button>
        </header>

        <section className="grid gap-4 md:grid-cols-[0.8fr_1.2fr]">
          <Card className="border-border/70 bg-card/90 shadow-sm">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">Good morning</p>
                  <CardTitle className="mt-1 text-xl">{employeeName}</CardTitle>
                </div>
                <Badge variant="outline" className="border-success/30 bg-success/10 text-success">
                  <span className="size-1.5 rounded-full bg-success" />
                  Identified
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p className="flex items-center gap-2">
                <Smartphone className="size-4" />
                Authorized Device
              </p>
              <p className="flex items-center gap-2">
                <BriefcaseBusiness className="size-4" />
                {employeeShifts.length} services scheduled today
              </p>
              <p className="flex items-center gap-2">
                <MapPinCheck className="size-4 text-success" />
                Location available when clocking
              </p>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-primary/25 bg-card/95 shadow-sm">
            <div className="border-b border-border/70 bg-primary/[0.055] px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-primary">
                    Current shift
                  </p>
                  <h1 className="mt-1 text-xl font-semibold">{activeShift?.title}</h1>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "rounded-md",
                    isPaused
                      ? "border-warning/30 bg-warning/10 text-warning"
                      : hasClockedOut
                        ? "border-success/30 bg-success/10 text-success"
                        : "border-primary/30 bg-primary/10 text-primary"
                  )}
                >
                  {isPaused ? "Paused" : hasClockedOut ? "Completed" : "In progress"}
                </Badge>
              </div>
            </div>
            <CardContent className="space-y-5 p-5">
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Clock3 className="size-4 text-primary" />
                  {activeShift ? `${formatTime(activeShift.startsAt, companyTimezone)}–${formatTime(activeShift.endsAt, companyTimezone)}` : "No shift"}
                </p>
                <p className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="size-4 text-primary" />
                  {activeSite?.name}
                </p>
              </div>

              {queueEntry ? (
                <div
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-3 text-sm",
                    queueEntry.status === "needs_attention"
                      ? "border-destructive/30 bg-destructive/[0.06] text-destructive"
                      : "border-warning/30 bg-warning/[0.06] text-warning"
                  )}
                >
                  {queueEntry.status === "needs_attention" ? (
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  ) : (
                    <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin" />
                  )}
                  <div className="flex-1 space-y-2">
                    <p className="font-medium">
                      {queueEntry.status === "needs_attention"
                        ? "This clock event needs attention"
                        : queueEntry.status === "sending"
                          ? "Sending your clock event…"
                          : "Saved on this device — will sync when back online"}
                    </p>
                    {queueEntry.lastError ? (
                      <p className="text-muted-foreground">{queueEntry.lastError}</p>
                    ) : null}
                    {queueEntry.status === "needs_attention" && activeShift ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => retryQueuedClockEvent(activeShift.id)}
                      >
                        <RotateCcw className="size-4" />
                        Retry now
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {!hasClockedOut ? (
                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <Button
                    type="button"
                    size="lg"
                    className="h-12"
                    onClick={runPrimaryAction}
                    disabled={isSyncingClock}
                  >
                    <PrimaryIcon className="size-5" />
                    {primaryLabel}
                  </Button>
                  {hasClockedIn ? (
                    <Button
                      type="button"
                      size="lg"
                      variant="outline"
                      className="h-12"
                      disabled={isSyncingClock}
                      onClick={() => activeShift && recordClockEvent(activeShift.id, "CLOCK_OUT")}
                    >
                      <LogOut className="size-5" />
                      End shift
                    </Button>
                  ) : null}
                </div>
              ) : (
                <div className="flex items-center gap-3 rounded-lg border border-success/25 bg-success/[0.06] p-4">
                  <CheckCircle2 className="size-5 text-success" />
                  <div>
                    <p className="font-medium">Shift completed</p>
                    <p className="text-sm text-muted-foreground">Clock-out was saved successfully.</p>
                  </div>
                </div>
              )}

              <div className="rounded-lg border border-border/70 bg-background/45 p-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <ShieldCheck className="size-4 text-primary" />
                  Privacy-friendly time tracking
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Location is checked only when you press the button. WIAControl does not track continuously.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
          <Card className="border-border/70 bg-card/90 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">This shift&apos;s record</CardTitle>
            </CardHeader>
            <CardContent>
              {shiftEvents.length > 0 ? (
                <div className="space-y-1">
                  {shiftEvents.map((event, index) => (
                    <div key={event.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <span className="mt-1 size-2.5 rounded-full border-2 border-primary bg-background" />
                        {index < shiftEvents.length - 1 ? <span className="h-9 w-px bg-border" /> : null}
                      </div>
                      <div className="flex flex-1 items-start justify-between gap-3 pb-4">
                        <div>
                          <p className="text-sm font-medium">{eventLabels[event.type]}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {formatTime(event.occurredAt, companyTimezone)} · {event.method === "MOBILE" ? "Mobile" : event.method} · Verified worksite
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setCorrectionEvent(event)}
                        >
                          <RotateCcw className="size-3.5" />
                          Correct
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">There are no events for this shift yet.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/90 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Upcoming services</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {employeeShifts
                .filter((shift) => shift.id !== activeShift?.id)
                .map((shift) => (
                  <ShiftSummary key={shift.id} shift={shift} />
                ))}
            </CardContent>
          </Card>
        </section>

        <Card className="border-border/70 bg-card/90 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">My time corrections</CardTitle>
          </CardHeader>
          <CardContent>
            {employeeCorrections.length > 0 ? (
              <div className="space-y-3">
                {employeeCorrections.map((correction) => (
                  <div key={correction.id} className="rounded-lg border border-border/70 bg-background/45 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">
                            {formatTime(correction.originalTime, companyTimezone)} → {formatTime(correction.correctedTime, companyTimezone)}
                          </p>
                          <Badge variant="outline" className="rounded-md">
                            {{
                              PENDING: "Pending",
                              APPROVED: "Approved",
                              REJECTED: "Rejected",
                              DISPUTED: "Disputed",
                            }[correction.status]}
                          </Badge>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{correction.reason}</p>
                      </div>
                      {["APPROVED", "REJECTED"].includes(correction.status) && !correction.employeeAcknowledgedAt ? (
                        <div className="flex shrink-0 gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setDisagreementId(correction.id)}
                          >
                            I disagree
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => acknowledgeTimeCorrection(correction.id, true)}
                          >
                            Confirm
                          </Button>
                        </div>
                      ) : null}
                    </div>
                    {disagreementId === correction.id ? (
                      <div className="mt-3 space-y-2 rounded-lg bg-muted/45 p-3">
                        <Label htmlFor={`disagreement-${correction.id}`}>Reason for disagreement</Label>
                        <Textarea
                          id={`disagreement-${correction.id}`}
                          value={disagreementReason}
                          onChange={(event) => setDisagreementReason(event.target.value)}
                          placeholder="Explain which record or decision you disagree with."
                        />
                        <div className="flex justify-end gap-2">
                          <Button type="button" size="sm" variant="ghost" onClick={() => setDisagreementId(undefined)}>
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            disabled={disagreementReason.trim().length < 10}
                            onClick={() => {
                              acknowledgeTimeCorrection(correction.id, false, disagreementReason.trim());
                              setDisagreementId(undefined);
                              setDisagreementReason("");
                            }}
                          >
                            Record disagreement
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">You have not requested any corrections.</p>
            )}
          </CardContent>
        </Card>
      </div>
      <CorrectionDialog
        event={correctionEvent}
        open={Boolean(correctionEvent)}
        onOpenChange={(open) => {
          if (!open) setCorrectionEvent(undefined);
        }}
      />
    </main>
  );
}
