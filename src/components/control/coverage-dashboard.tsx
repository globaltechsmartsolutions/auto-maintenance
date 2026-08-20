"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock3,
  MapPin,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UsersRound,
} from "lucide-react";
import {
  useWiaControl,
  type PlannedShift,
  type ShiftStatus,
} from "@/components/control/wia-control-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CommunicationsOutbox } from "@/components/control/communications-outbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const statusConfig: Record<
  ShiftStatus,
  { label: string; className: string; dot: string }
> = {
  PLANNED: {
    label: "Planned",
    className: "border-info/30 bg-info/10 text-info",
    dot: "bg-info",
  },
  ACTIVE: {
    label: "In progress",
    className: "border-success/30 bg-success/10 text-success",
    dot: "bg-success",
  },
  PAUSED: {
    label: "Paused",
    className: "border-warning/30 bg-warning/10 text-warning",
    dot: "bg-warning",
  },
  COMPLETED: {
    label: "Completed",
    className: "border-success/30 bg-success/10 text-success",
    dot: "bg-success",
  },
  UNCOVERED: {
    label: "Uncovered",
    className: "border-destructive/35 bg-destructive/10 text-destructive",
    dot: "bg-destructive",
  },
  COVERED: {
    label: "Replacement confirmed",
    className: "border-primary/35 bg-primary/10 text-primary",
    dot: "bg-primary",
  },
  CANCELLED: {
    label: "Cancelled",
    className: "border-muted-foreground/25 bg-muted text-muted-foreground",
    dot: "bg-muted-foreground",
  },
};

function formatTime(value: string, timezone: string = "Europe/Madrid") {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  }).format(new Date(value));
}

function ShiftStatusBadge({ status }: { status: ShiftStatus }) {
  const config = statusConfig[status];
  return (
    <Badge variant="outline" className={cn("h-6 rounded-md", config.className)}>
      <span className={cn("size-1.5 rounded-full", config.dot)} />
      {config.label}
    </Badge>
  );
}

function Metric({
  label,
  value,
  helper,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  helper: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "warning" | "success";
}) {
  return (
    <Card className="border-border/70 bg-card/85 shadow-sm">
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
        </div>
        <span
          className={cn(
            "flex size-9 items-center justify-center rounded-lg border bg-primary/10 text-primary",
            tone === "warning" && "border-warning/25 bg-warning/10 text-warning",
            tone === "success" && "border-success/25 bg-success/10 text-success"
          )}
        >
          <Icon className="size-4" />
        </span>
      </CardContent>
    </Card>
  );
}

function ShiftCard({ shift }: { shift: PlannedShift }) {
  const {
    companyTimezone,
    incidents,
    worksites,
    assignReplacement,
    employees,
    refreshControl,
  } = useWiaControl();
  const [decisionOpen, setDecisionOpen] = React.useState(false);
  const [loadingRecommendation, setLoadingRecommendation] = React.useState(false);
  const [recommendationError, setRecommendationError] = React.useState<string>();
  const [recommendation, setRecommendation] = React.useState<{
    candidates: Array<{ employeeId: string; employeeName: string; score: number; reasons: string[] }>;
    excluded: Array<{ employeeId: string; employeeName: string; reason: string }>;
  } | null>(null);
  const [showExcluded, setShowExcluded] = React.useState(false);
  const site = worksites.find((item) => item.id === shift.worksiteId);
  const incident = incidents.find((item) => item.shiftId === shift.id);
  const [selectedEmployee, setSelectedEmployee] = React.useState(
    incident?.recommendedEmployee ?? ""
  );
  const [overrideReason, setOverrideReason] = React.useState("");
  const uncovered = shift.status === "UNCOVERED";
  const eligibleEmployees = employees.filter(
    (employee) => !["VACATION", "SICK_LEAVE", "INACTIVE"].includes(employee.status)
  );
  const isOverride = Boolean(
    incident?.recommendedEmployee && selectedEmployee !== incident.recommendedEmployee
  );

  async function findReplacements() {
    if (!incident) return;
    setLoadingRecommendation(true);
    setRecommendationError(undefined);
    try {
      const response = await fetch("/api/control/coverage/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ incidentId: incident.id }),
      });
      const body = await response.json().catch(() => ({}));
      if (response.ok) {
        setRecommendation({ candidates: body.candidates ?? [], excluded: body.excluded ?? [] });
        if (!body.recommended) {
          setRecommendationError("No eligible replacement was found for this shift.");
        }
      } else {
        setRecommendation({ candidates: [], excluded: body.excluded ?? [] });
        setRecommendationError(
          body.error ?? "No eligible replacement could be found for this shift."
        );
      }
      await refreshControl();
    } catch {
      setRecommendationError("Could not reach the server. Try again.");
    } finally {
      setLoadingRecommendation(false);
    }
  }

  function confirmDecision() {
    const confirmed = assignReplacement(shift.id, selectedEmployee, overrideReason);
    if (confirmed) setDecisionOpen(false);
  }

  React.useEffect(() => {
    if (decisionOpen && !recommendation && incident) {
      void findReplacements();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decisionOpen]);

  return (
    <Card
      className={cn(
        "border-border/70 bg-card/90 shadow-sm",
        uncovered && "border-destructive/35 bg-destructive/[0.035]"
      )}
    >
      <CardContent className="p-0">
        <div className="grid gap-4 p-4 lg:grid-cols-[minmax(130px,auto)_1.2fr_1fr_auto] lg:items-center">
          <div>
            <p className="text-lg font-semibold tabular-nums">
              {formatTime(shift.startsAt, companyTimezone)}–{formatTime(shift.endsAt, companyTimezone)}
            </p>
            <ShiftStatusBadge status={shift.status} />
          </div>

          <div className="min-w-0">
            <p className="font-medium">{shift.title}</p>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Building2 className="size-3.5 shrink-0" />
              <span className="truncate">{site?.name ?? "Undefined worksite"}</span>
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="size-3.5 shrink-0" />
              {site?.address}, {site?.city}
            </p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
              Assignee
            </p>
            <p className={cn("mt-1 text-sm font-medium", uncovered && "text-destructive")}>
              {shift.employeeName ?? shift.originalEmployeeName ?? "Unassigned"}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {shift.requiredSkills.map((skill) => (
                <Badge key={skill} variant="secondary" className="rounded-md font-normal">
                  {skill}
                </Badge>
              ))}
            </div>
          </div>

          <div className="lg:justify-self-end">
            {uncovered && incident?.recommendedEmployee ? (
              <Button
                type="button"
                onClick={() => setDecisionOpen(true)}
              >
                <UserCheck className="size-4" />
                Resolve coverage
              </Button>
            ) : uncovered && incident ? (
              <Button type="button" onClick={() => void findReplacements()} disabled={loadingRecommendation}>
                <Sparkles className="size-4" />
                {loadingRecommendation ? "Finding…" : "Find replacements"}
              </Button>
            ) : (
              <Button asChild variant="outline">
                <Link href="/time-tracking">
                  View audit trail
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            )}
          </div>
        </div>

        {uncovered && incident?.recommendedEmployee ? (
          <div className="border-t border-destructive/20 bg-destructive/[0.035] px-4 py-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex gap-2.5">
                <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
                <div>
                  <p className="text-sm font-medium">
                    WIA recommends {incident.recommendedEmployee}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {incident.recommendationReasons?.join(" · ")}
                  </p>
                </div>
              </div>
              {(() => {
                const topScore = recommendation?.candidates.find(
                  (candidate) => candidate.employeeName === incident.recommendedEmployee
                )?.score;
                return topScore !== undefined ? (
                  <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                    Fit score · {topScore}%
                  </Badge>
                ) : null;
              })()}
            </div>
            <ExcludedCandidatesList
              excluded={recommendation?.excluded ?? []}
              show={showExcluded}
              onToggle={() => setShowExcluded((current) => !current)}
            />
          </div>
        ) : uncovered && recommendationError ? (
          <div className="border-t border-destructive/20 bg-destructive/[0.035] px-4 py-3">
            <div className="flex gap-2.5">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
              <div>
                <p className="text-sm font-medium text-destructive">{recommendationError}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Add or update a person&apos;s skills, zone, or availability, then try again.
                </p>
              </div>
            </div>
            <ExcludedCandidatesList
              excluded={recommendation?.excluded ?? []}
              show={showExcluded}
              onToggle={() => setShowExcluded((current) => !current)}
            />
          </div>
        ) : null}
      </CardContent>
      <Dialog open={decisionOpen} onOpenChange={setDecisionOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirm replacement</DialogTitle>
            <DialogDescription>
              Compare the recommendation and record your reason if you select someone else.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-primary/25 bg-primary/[0.045] p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                WIA recommendation
              </p>
              <p className="mt-1 font-medium">{incident?.recommendedEmployee}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {incident?.recommendationReasons?.join(" · ")}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`coverage-employee-${shift.id}`}>Selected employee</Label>
              <select
                id={`coverage-employee-${shift.id}`}
                value={selectedEmployee}
                onChange={(event) => setSelectedEmployee(event.target.value)}
                className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {recommendation
                  ? recommendation.candidates.map((candidate) => (
                    <option key={candidate.employeeId} value={candidate.employeeName}>
                      {candidate.employeeName} · Fit {candidate.score}%
                    </option>
                  ))
                  : eligibleEmployees.map((employee) => (
                    <option key={employee.id} value={employee.name}>
                      {employee.name} · {{ AVAILABLE: "Available", ASSIGNED: "Assigned", VACATION: "Holiday", SICK_LEAVE: "Sick leave", INACTIVE: "Inactive" }[employee.status]}
                    </option>
                  ))}
              </select>
              {!recommendation ? (
                <p className="text-xs text-muted-foreground">
                  Loading eligible candidates only — the full list may include people who are
                  not actually available for this shift.
                </p>
              ) : null}
            </div>
            {isOverride ? (
              <div className="space-y-2">
                <Label htmlFor={`coverage-reason-${shift.id}`}>Reason for change</Label>
                <Textarea
                  id={`coverage-reason-${shift.id}`}
                  value={overrideReason}
                  onChange={(event) => setOverrideReason(event.target.value)}
                  minLength={5}
                  placeholder="Explain the operational reason for overriding the recommendation."
                />
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDecisionOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={confirmDecision}
              disabled={!selectedEmployee || (isOverride && overrideReason.trim().length < 5)}
            >
              Confirm and notify
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export function CoverageDashboard() {
  const { shifts, incidents, clockEvents, communications, coverageDecisions } = useWiaControl();
  const openIncidents = incidents.filter((incident) => incident.status !== "RESOLVED");
  const uncovered = shifts.filter((shift) => shift.status === "UNCOVERED").length;
  const active = shifts.filter((shift) => ["ACTIVE", "PAUSED"].includes(shift.status)).length;
  const covered = shifts.filter((shift) => shift.status !== "UNCOVERED").length;
  const coverage = Math.round((covered / Math.max(shifts.length, 1)) * 100);

  const sortedShifts = React.useMemo(
    () =>
      [...shifts].sort((first, second) => {
        if (first.status === "UNCOVERED") return -1;
        if (second.status === "UNCOVERED") return 1;
        return first.startsAt.localeCompare(second.startsAt);
      }),
    [shifts]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-muted-foreground">Operations control center</p>
            <Badge variant="outline" className="border-success/30 bg-success/10 text-success">
              <span className="size-1.5 animate-pulse rounded-full bg-success" />
              Live
            </Badge>
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-normal">Today&apos;s coverage</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            WIA detects gaps, proposes the best replacement, and records who decided each change.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/time-tracking">
            <ShieldCheck className="size-4" />
            Review time tracking
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Coverage"
          value={`${coverage} %`}
          helper={`${covered} of ${shifts.length} shifts assigned`}
          icon={ShieldCheck}
          tone={coverage === 100 ? "success" : "warning"}
        />
        <Metric
          label="Uncovered"
          value={uncovered.toString()}
          helper="requires a coordinator decision"
          icon={AlertTriangle}
          tone={uncovered > 0 ? "warning" : "success"}
        />
        <Metric
          label="In progress"
          value={active.toString()}
          helper={`${clockEvents.filter((event) => event.type === "CLOCK_IN").length} clock-ins recorded`}
          icon={Clock3}
        />
        <Metric
          label="Incidents"
          value={openIncidents.length.toString()}
          helper="with records and follow-up"
          icon={UsersRound}
          tone={openIncidents.length > 0 ? "warning" : "success"}
        />
      </div>

      {uncovered > 0 ? (
        <div className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/[0.055] p-4 sm:flex-row sm:items-center">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
            <AlertTriangle className="size-5" />
          </span>
          <div className="flex-1">
            <p className="font-medium">A customer commitment is at risk</p>
            <p className="mt-1 text-sm text-muted-foreground">
              WIA has found a compatible replacement. It only needs confirmation.
            </p>
          </div>
          <Badge variant="destructive" className="h-7 rounded-md px-3">
            Resolve now
          </Badge>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-success/30 bg-success/[0.06] p-4">
          <CheckCircle2 className="size-5 text-success" />
          <div>
            <p className="font-medium">All services are covered</p>
            <p className="text-sm text-muted-foreground">
              The replacement has been communicated and recorded in the history.
            </p>
          </div>
        </div>
      )}

      <section className="space-y-3" aria-labelledby="shifts-heading">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 id="shifts-heading" className="text-lg font-semibold">
              Planned shifts
            </h2>
            <p className="text-sm text-muted-foreground">
              Sorted by urgency and start time.
            </p>
          </div>
          <Badge variant="secondary" className="rounded-md">
            {shifts.length} shifts
          </Badge>
        </div>
        <div className="grid gap-3">
          {sortedShifts.map((shift) => (
            <ShiftCard key={shift.id} shift={shift} />
          ))}
        </div>
      </section>

      {(communications.length > 0 || coverageDecisions.length > 0) ? (
        <Card className="border-border/70 bg-card/85 shadow-sm">
          <CardContent className="grid gap-4 p-4 md:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                Audited decisions
              </p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{coverageDecisions.length}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Includes the recommendation, selection, and manager&apos;s reason.
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                Queued communications
              </p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{communications.length}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Ready for delivery through the configured provider.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <CommunicationsOutbox />
    </div>
  );
}

/**
 * Stage 4, Task 2: shows every excluded candidate with the exact hard
 * constraint that ruled them out, collapsed by default so the panel does
 * not overwhelm the coordinator when there is a clear recommendation.
 */
function ExcludedCandidatesList({
  excluded,
  show,
  onToggle,
}: {
  excluded: Array<{ employeeId: string; employeeName: string; reason: string }>;
  show: boolean;
  onToggle: () => void;
}) {
  if (excluded.length === 0) return null;
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={onToggle}
        className="text-xs font-medium text-muted-foreground underline-offset-2 hover:underline"
      >
        {show ? "Hide" : "Show"} {excluded.length} ineligible {excluded.length === 1 ? "person" : "people"}
      </button>
      {show ? (
        <ul className="mt-2 space-y-1">
          {excluded.map((candidate) => (
            <li key={candidate.employeeId} className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{candidate.employeeName}</span>
              {" — "}
              {candidate.reason}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
