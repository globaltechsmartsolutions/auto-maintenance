import type { IncidentSeverityLevel } from "@/lib/wia-control/domain-core";

/**
 * The coordinator's triage rules: for any at-risk service, who owns it, what
 * the next human action is, and whether it has been waiting too long.
 *
 * These are pure functions over facts already persisted by the incident,
 * coverage, and communication flows. Nothing here decides anything on its own —
 * it only makes the next human decision obvious and orderable.
 */

export type RecoveryActionCode =
  | "ASSIGN_OWNER"
  | "ACKNOWLEDGE"
  | "CONFIRM_COVERAGE"
  | "AWAIT_ACKNOWLEDGEMENT"
  | "ESCALATE"
  | "RESOLVE"
  | "NONE";

export type RecoveryAlert = "OVERDUE" | "UNOWNED" | "STALE" | null;

export type RecoveryFacts = {
  status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED" | "DISMISSED";
  severity: IncidentSeverityLevel;
  detectedAt: Date;
  dueAt?: Date | null;
  acknowledgedAt?: Date | null;
  hasOwner: boolean;
  /** True once a coordinator has confirmed who covers the shift. */
  hasCoverageDecision: boolean;
  /** True once the person taking the shift has acknowledged the message. */
  coverageAcknowledged: boolean;
  /** True when the shift still has nobody assigned. */
  shiftUncovered: boolean;
};

/**
 * How long an incident of each severity may sit with no accountable
 * coordinator before it is flagged. These are deliberately much shorter than
 * the resolution due window: an unowned incident is not being worked on at all.
 */
const unownedAlertMinutes: Record<IncidentSeverityLevel, number> = {
  CRITICAL: 10,
  HIGH: 20,
  MEDIUM: 60,
  LOW: 120,
};

/** How long an acknowledged incident may sit with no coverage decision. */
const staleAlertMinutes: Record<IncidentSeverityLevel, number> = {
  CRITICAL: 20,
  HIGH: 45,
  MEDIUM: 120,
  LOW: 240,
};

const severityRank: Record<IncidentSeverityLevel, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

export function minutesBetween(from: Date, to: Date) {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 60_000));
}

export function isClosed(status: RecoveryFacts["status"]) {
  return status === "RESOLVED" || status === "DISMISSED";
}

/**
 * The single next human action. There is exactly one at a time, and it is
 * always something a person does — never an automatic reassignment.
 */
export function nextRecoveryAction(facts: RecoveryFacts, now: Date): {
  code: RecoveryActionCode;
  label: string;
} {
  if (isClosed(facts.status)) {
    return { code: "NONE", label: "Closed. No action is needed." };
  }

  const overdue = Boolean(facts.dueAt && facts.dueAt.getTime() <= now.getTime());

  if (!facts.hasOwner) {
    return overdue
      ? { code: "ESCALATE", label: "Overdue with no owner. Escalate and assign a coordinator now." }
      : { code: "ASSIGN_OWNER", label: "Assign an accountable coordinator." };
  }

  if (facts.status === "OPEN") {
    return { code: "ACKNOWLEDGE", label: "Acknowledge the incident and start recovery." };
  }

  if (facts.shiftUncovered || !facts.hasCoverageDecision) {
    return overdue
      ? { code: "ESCALATE", label: "Overdue and still uncovered. Escalate or confirm a replacement." }
      : { code: "CONFIRM_COVERAGE", label: "Confirm who covers this service." };
  }

  if (!facts.coverageAcknowledged) {
    return {
      code: "AWAIT_ACKNOWLEDGEMENT",
      label: "Chase the replacement's acknowledgement.",
    };
  }

  return { code: "RESOLVE", label: "Coverage is confirmed. Record the resolution." };
}

/**
 * Recovery-age alerting. Only one alert is reported, the most urgent, so a
 * queue row carries a single unambiguous reason for attention.
 */
export function recoveryAlert(facts: RecoveryFacts, now: Date): RecoveryAlert {
  if (isClosed(facts.status)) return null;

  if (facts.dueAt && facts.dueAt.getTime() <= now.getTime()) return "OVERDUE";

  const age = minutesBetween(facts.detectedAt, now);
  if (!facts.hasOwner && age >= unownedAlertMinutes[facts.severity]) return "UNOWNED";

  if (
    facts.status === "ACKNOWLEDGED" &&
    !facts.hasCoverageDecision &&
    facts.acknowledgedAt &&
    minutesBetween(facts.acknowledgedAt, now) >= staleAlertMinutes[facts.severity]
  ) {
    return "STALE";
  }

  return null;
}

/**
 * Ordering score for the queue: an overdue item always outranks a severe one
 * that is still inside its window, because the promise that has already been
 * missed is the one a customer will call about.
 */
export function recoveryUrgency(facts: RecoveryFacts, now: Date) {
  if (isClosed(facts.status)) return 0;
  const alert = recoveryAlert(facts, now);
  const alertWeight = alert === "OVERDUE" ? 10_000 : alert === "UNOWNED" ? 5_000 : alert === "STALE" ? 2_500 : 0;
  const overdueMinutes =
    facts.dueAt && facts.dueAt.getTime() <= now.getTime() ? minutesBetween(facts.dueAt, now) : 0;
  return (
    alertWeight +
    severityRank[facts.severity] * 500 +
    Math.min(overdueMinutes, 1_440) +
    Math.min(minutesBetween(facts.detectedAt, now), 1_440) / 100
  );
}

export function describeRecovery(facts: RecoveryFacts, now: Date) {
  return {
    action: nextRecoveryAction(facts, now),
    alert: recoveryAlert(facts, now),
    urgency: recoveryUrgency(facts, now),
    ageMinutes: minutesBetween(facts.detectedAt, now),
    overdueMinutes:
      facts.dueAt && facts.dueAt.getTime() <= now.getTime() ? minutesBetween(facts.dueAt, now) : 0,
  };
}
