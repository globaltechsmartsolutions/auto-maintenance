export type ShiftStatus =
  | "PLANNED"
  | "ACTIVE"
  | "PAUSED"
  | "COMPLETED"
  | "UNCOVERED"
  | "COVERED"
  | "CANCELLED";

export type ClockEventType = "CLOCK_IN" | "BREAK_START" | "BREAK_END" | "CLOCK_OUT";
export type ClockMethod = "MOBILE" | "QR" | "PIN" | "NFC" | "KIOSK" | "MANUAL";
export type IncidentStatus = "OPEN" | "ACKNOWLEDGED" | "RESOLVED" | "DISMISSED";
export type CorrectionStatus = "PENDING" | "APPROVED" | "DISPUTED" | "REJECTED";

export type WorksiteDto = {
  id: string;
  customerId?: string;
  name: string;
  customer: string;
  address: string;
  city: string;
  verificationMode: string;
  radiusMeters: number;
  isActive?: boolean;
};

export type OperationalServiceDto = {
  id: string;
  title: string;
  customerId: string;
  customerName: string;
  recurrence: "ONE_TIME" | "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "CUSTOM";
  status: "PENDING" | "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
};

export type PlannedShiftDto = {
  id: string;
  worksiteId: string;
  serviceId?: string;
  title: string;
  employeeName?: string;
  originalEmployeeName?: string;
  startsAt: string;
  endsAt: string;
  status: ShiftStatus;
  requiredSkills: string[];
};

export type ClockEventDto = {
  id: string;
  shiftId: string;
  worksiteId: string;
  employeeName: string;
  type: ClockEventType;
  occurredAt: string;
  recordedAt: string;
  method: ClockMethod;
  locationVerified: boolean;
  correctionOf?: string;
};

export type AttendanceIncidentDto = {
  id: string;
  shiftId: string;
  employeeName?: string;
  type: "MISSING_CLOCK_IN" | "LATE" | "INCOMPLETE_CLOCK" | "OUTSIDE_LOCATION";
  title: string;
  detail: string;
  status: IncidentStatus;
  severity: IncidentSeverityLevel;
  dueAt?: string;
  ownerId?: string;
  ownerName?: string;
  detectedAt: string;
  recommendedEmployee?: string;
  recommendationReasons?: string[];
  resolvedAt?: string;
  resolutionNotes?: string;
};

export type TimeCorrectionDto = {
  id: string;
  clockEventId?: string;
  employeeName: string;
  originalTime: string;
  correctedTime: string;
  reason: string;
  status: CorrectionStatus;
  createdAt: string;
  disagreementReason?: string;
  employeeAcknowledgedAt?: string;
};

export type CoverageCandidateInput = {
  requiredSkills: string[];
  worksiteCity: string;
  employeeSkills: string[];
  employeeZones: string[];
  dailyJobs: number;
};

export type CoverageDecisionDto = {
  id: string;
  shiftId: string;
  incidentId: string;
  recommendedEmployee?: string;
  selectedEmployee: string;
  type: "RECOMMENDATION_ACCEPTED" | "MANUAL_OVERRIDE" | "AUTO_ASSIGNED";
  score?: number;
  reasons: string[];
  overrideReason?: string;
  createdAt: string;
};

export type CommunicationDto = {
  id: string;
  shiftId?: string;
  recipientEmployeeId?: string;
  recipientEmployee: string;
  channel: "IN_APP" | "EMAIL" | "SMS" | "WHATSAPP";
  template: string;
  status: "PENDING" | "PROCESSING" | "RETRYING" | "SENT" | "FAILED" | "CANCELLED";
  attempts: number;
  lastError?: string;
  sentAt?: string;
  acknowledgedAt?: string;
  createdAt: string;
};

export type EmployeeOptionDto = {
  id: string;
  name: string;
  status: "AVAILABLE" | "ASSIGNED" | "VACATION" | "SICK_LEAVE" | "INACTIVE";
  availability: string;
  skills: string[];
  zones: string[];
  performanceScore: number;
};

export function scoreCoverageCandidate(input: CoverageCandidateInput) {
  const normalize = (value: string) =>
    value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("en").trim();
  const employeeSkills = new Set(input.employeeSkills.map(normalize));
  const requiredSkills = input.requiredSkills.map(normalize);
  const matchedSkills = requiredSkills.filter((skill) => employeeSkills.has(skill));
  const zones = input.employeeZones.map(normalize);
  const city = normalize(input.worksiteCity);
  const zoneMatch = zones.some((zone) => zone.includes(city) || city.includes(zone));
  const reasons = ["Availability with no overlaps in the requested time slot."];
  let score = 40;

  if (requiredSkills.length === 0) {
    score += 20;
    reasons.push("The shift requires no additional specialisation.");
  } else if (matchedSkills.length === requiredSkills.length) {
    score += 30;
    reasons.push("Meets all required skills.");
  } else if (matchedSkills.length > 0) {
    score += Math.round((matchedSkills.length / requiredSkills.length) * 24);
    reasons.push(`Meets ${matchedSkills.length} of ${requiredSkills.length} required skills.`);
  }

  if (zoneMatch) {
    score += 15;
    reasons.push(`Usually works in ${input.worksiteCity}.`);
  }
  if (input.dailyJobs === 0) {
    score += 15;
    reasons.push("Has no other shifts that day.");
  } else if (input.dailyJobs === 1) {
    score += 8;
    reasons.push("Has one other shift that day.");
  } else if (input.dailyJobs >= 3) {
    score -= 8;
    reasons.push("Already has several shifts that day.");
  }

  return { score: Math.max(0, Math.min(100, score)), reasons };
}

function normalizeText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("en").trim();
}

/**
 * An employee's declared working availability (Stage 4 hard constraint).
 * Stored as JSON on `Employee.availability`. Missing/malformed data is
 * treated as "no restriction" — an employee is never silently excluded
 * because of a data-entry gap, only because of an explicit restriction
 * that conflicts with the shift.
 */
export type EmployeeAvailability = {
  /** 0=Sunday..6=Saturday. Omitted or empty means every day. */
  daysOfWeek?: number[];
  /** Minutes since midnight (shift's own clock). Both omitted means any time of day. */
  startMinute?: number;
  endMinute?: number;
};

export function parseEmployeeAvailability(value: unknown): EmployeeAvailability | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const result: EmployeeAvailability = {};
  if (Array.isArray(record.daysOfWeek)) {
    const days = record.daysOfWeek.filter(
      (day): day is number => typeof day === "number" && day >= 0 && day <= 6
    );
    if (days.length > 0) result.daysOfWeek = days;
  }
  if (typeof record.startMinute === "number") result.startMinute = record.startMinute;
  if (typeof record.endMinute === "number") result.endMinute = record.endMinute;
  return result;
}

export function isEmployeeAvailableForShift(
  availability: EmployeeAvailability | null | undefined,
  shiftStart: Date,
  shiftEnd: Date,
  timeZone = "UTC"
): boolean {
  if (!availability) return true;
  const start = getZonedWeekdayAndMinutes(shiftStart, timeZone);
  const end = getZonedWeekdayAndMinutes(shiftEnd, timeZone);
  if (availability.daysOfWeek && availability.daysOfWeek.length > 0) {
    if (!availability.daysOfWeek.includes(start.weekday)) return false;
  }
  if (availability.startMinute !== undefined && availability.endMinute !== undefined) {
    if (start.minutes < availability.startMinute || end.minutes > availability.endMinute) {
      return false;
    }
  }
  return true;
}

/** Hard constraint: the shift's required skills must all be present. */
export function employeeMeetsRequiredSkills(requiredSkills: string[], employeeSkills: string[]) {
  if (requiredSkills.length === 0) return true;
  const skillSet = new Set(employeeSkills.map(normalizeText));
  return requiredSkills.map(normalizeText).every((skill) => skillSet.has(skill));
}

/**
 * Hard constraint: the employee's declared work zones must include the
 * worksite's city. An employee with no declared zones is treated as
 * having no zone restriction (works anywhere), not as ineligible.
 */
export function employeeMeetsWorkZone(worksiteCity: string, employeeZones: string[]) {
  if (employeeZones.length === 0) return true;
  const city = normalizeText(worksiteCity);
  return employeeZones.map(normalizeText).some((zone) => zone.includes(city) || city.includes(zone));
}

/** Hard constraint: adding this shift must not exceed the employee's daily limits. */
export function employeeMeetsWorkingTimeLimits(input: {
  shiftMinutes: number;
  existingDailyMinutes: number;
  existingDailyJobs: number;
  maxHoursPerDay?: number | null;
  maxJobsPerDay?: number | null;
  timeZone?: string;
}) {
  if (input.maxHoursPerDay != null) {
    const totalHours = (input.existingDailyMinutes + input.shiftMinutes) / 60;
    if (totalHours > input.maxHoursPerDay) return false;
  }
  if (input.maxJobsPerDay != null) {
    if (input.existingDailyJobs + 1 > input.maxJobsPerDay) return false;
  }
  return true;
}

function fieldStatusExclusionReason(status: string): string {
  switch (status) {
    case "VACATION":
      return "Currently on vacation.";
    case "SICK_LEAVE":
      return "Currently on sick leave.";
    case "INACTIVE":
      return "No longer an active employee.";
    default:
      return "Not currently available for work.";
  }
}

export type CoverageEligibilityInput = {
  fieldStatus: "AVAILABLE" | "ASSIGNED" | "VACATION" | "SICK_LEAVE" | "INACTIVE";
  hasOverlap: boolean;
  requiredSkills: string[];
  employeeSkills: string[];
  worksiteCity: string;
  employeeZones: string[];
  availability?: EmployeeAvailability | null;
  shiftStart: Date;
  shiftEnd: Date;
  existingDailyMinutes: number;
  existingDailyJobs: number;
  maxHoursPerDay?: number | null;
  maxJobsPerDay?: number | null;
  timeZone?: string;
};

export type CoverageEligibilityResult =
  | { eligible: true }
  | { eligible: false; reason: string };

/**
 * The single, deterministic Stage 4 eligibility check. Both the candidate
 * recommendation list and the final confirmation call this same function,
 * so the rules can never drift apart between "who gets shown" and "who is
 * actually allowed to be confirmed" — every hard constraint the playbook
 * lists (company scope is enforced by the caller's query, active status,
 * availability, absence, overlapping shifts, required skills, work zone,
 * working-time limits) is evaluated here in one place.
 */
export function evaluateCoverageEligibility(
  input: CoverageEligibilityInput
): CoverageEligibilityResult {
  if (!["AVAILABLE", "ASSIGNED"].includes(input.fieldStatus)) {
    return { eligible: false, reason: fieldStatusExclusionReason(input.fieldStatus) };
  }
  if (input.hasOverlap) {
    return { eligible: false, reason: "Already assigned to an overlapping shift." };
  }
  if (!employeeMeetsRequiredSkills(input.requiredSkills, input.employeeSkills)) {
    return { eligible: false, reason: "Does not have all the required skills." };
  }
  if (!employeeMeetsWorkZone(input.worksiteCity, input.employeeZones)) {
    return { eligible: false, reason: "Does not usually work in this zone." };
  }
  if (!isEmployeeAvailableForShift(input.availability, input.shiftStart, input.shiftEnd, input.timeZone)) {
    return { eligible: false, reason: "Not available at this day or time." };
  }
  const shiftMinutes = (input.shiftEnd.getTime() - input.shiftStart.getTime()) / 60_000;
  if (
    !employeeMeetsWorkingTimeLimits({
      shiftMinutes,
      existingDailyMinutes: input.existingDailyMinutes,
      existingDailyJobs: input.existingDailyJobs,
      maxHoursPerDay: input.maxHoursPerDay,
      maxJobsPerDay: input.maxJobsPerDay,
    })
  ) {
    return { eligible: false, reason: "Would exceed the daily working-time limit." };
  }
  return { eligible: true };
}

/**
 * Stage 5: bounded retry policy for the communications outbox worker.
 * Deliberately more spaced out than the offline clock queue's backoff
 * (Stage 2) -- a delayed notification is much less urgent than a clock
 * event, and the worker only runs on a schedule (every few minutes), not
 * continuously in a browser tab.
 */
export const MAX_COMMUNICATION_ATTEMPTS = 5;
const COMMUNICATION_BACKOFF_MINUTES = [1, 5, 15, 60, 240];

export function computeNextCommunicationAttempt(attempts: number, now: Date): Date {
  const index = Math.min(Math.max(attempts - 1, 0), COMMUNICATION_BACKOFF_MINUTES.length - 1);
  return new Date(now.getTime() + COMMUNICATION_BACKOFF_MINUTES[index] * 60_000);
}

export function hasExceededCommunicationAttempts(attempts: number): boolean {
  return attempts >= MAX_COMMUNICATION_ATTEMPTS;
}

export class WiaDomainError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "WiaDomainError";
  }
}

const allowedClockTransitions: Record<ClockEventType | "EMPTY", ClockEventType[]> = {
  EMPTY: ["CLOCK_IN"],
  CLOCK_IN: ["BREAK_START", "CLOCK_OUT"],
  BREAK_START: ["BREAK_END"],
  BREAK_END: ["BREAK_START", "CLOCK_OUT"],
  CLOCK_OUT: [],
};

export function assertClockTransition(
  previousType: ClockEventType | undefined,
  nextType: ClockEventType
) {
  const allowed = allowedClockTransitions[previousType ?? "EMPTY"];
  if (!allowed.includes(nextType)) {
    throw new WiaDomainError(
      "INVALID_CLOCK_SEQUENCE",
      `Cannot record ${nextType} after ${previousType ?? "no event"}.`
    );
  }
}

export function getShiftStatusAfterClock(type: ClockEventType): ShiftStatus {
  if (type === "BREAK_START") return "PAUSED";
  if (type === "CLOCK_OUT") return "COMPLETED";
  return "ACTIVE";
}

/**
 * The longest a single planned shift may be.
 *
 * Without a bound, "end after start" accepts a shift running until 2099, which
 * silently consumes every overlap and daily-limit check for that person from
 * then on. Twenty-four hours is deliberately generous: it accommodates an
 * overnight shift and any handover, while refusing a range that can only be a
 * mistake.
 */
export const MAX_SHIFT_HOURS = 24;

export function assertShiftWindow(scheduledStart: Date, scheduledEnd: Date) {
  if (scheduledEnd.getTime() <= scheduledStart.getTime()) {
    throw new WiaDomainError("INVALID_SHIFT_RANGE", "The end time must be later than the start time.");
  }
  const hours = (scheduledEnd.getTime() - scheduledStart.getTime()) / 3_600_000;
  if (hours > MAX_SHIFT_HOURS) {
    throw new WiaDomainError(
      "SHIFT_TOO_LONG",
      `A shift cannot be longer than ${MAX_SHIFT_HOURS} hours. Split it into separate shifts.`
    );
  }
}

export function rangesOverlap(
  firstStart: Date,
  firstEnd: Date,
  secondStart: Date,
  secondEnd: Date
) {
  return firstStart < secondEnd && secondStart < firstEnd;
}

export function lateMinutes(scheduledStart: Date, occurredAt: Date, gracePeriodMinutes: number) {
  const difference = Math.floor((occurredAt.getTime() - scheduledStart.getTime()) / 60_000);
  return Math.max(0, difference - gracePeriodMinutes);
}

/**
 * Company-configurable incident policy (Stage 3, playbook Section 7):
 * how many minutes late counts as severe, and how long each severity is
 * allowed to stay open before it is due. Defaults are a starting point —
 * the product owner should confirm them before pilot, same as the
 * offline-queue expiry window in Stage 2.
 */
export type IncidentPolicy = {
  lateSeverityThresholdMinutes: number;
  incidentDueMinutesCritical: number;
  incidentDueMinutesHigh: number;
  incidentDueMinutesMedium: number;
  incidentDueMinutesLow: number;
};

export const DEFAULT_INCIDENT_POLICY: IncidentPolicy = {
  lateSeverityThresholdMinutes: 30,
  incidentDueMinutesCritical: 60,
  incidentDueMinutesHigh: 240,
  incidentDueMinutesMedium: 1_440,
  incidentDueMinutesLow: 4_320,
};

export type IncidentSeverityLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type IncidentTypeForSeverity =
  | "MISSING_CLOCK_IN"
  | "LATE"
  | "INCOMPLETE_CLOCK"
  | "OUTSIDE_LOCATION";

/**
 * Deterministic severity rule per incident type. Kept as a pure function
 * (no database access) so it is unit-testable and identical whether an
 * incident is created from a live clock event or from batch detection.
 */
export function computeIncidentSeverity(
  type: IncidentTypeForSeverity,
  context: { lateMinutes?: number; policy?: IncidentPolicy } = {}
): IncidentSeverityLevel {
  const policy = context.policy ?? DEFAULT_INCIDENT_POLICY;
  switch (type) {
    case "MISSING_CLOCK_IN":
      // Nobody has shown up for a shift that should already be running.
      return "HIGH";
    case "LATE":
      return (context.lateMinutes ?? 0) >= policy.lateSeverityThresholdMinutes ? "HIGH" : "LOW";
    case "INCOMPLETE_CLOCK":
      // The shift happened; only the clock-out is missing.
      return "MEDIUM";
    case "OUTSIDE_LOCATION":
      // Needs verification, but the employee did attempt to work.
      return "MEDIUM";
    default:
      return "MEDIUM";
  }
}

/** How long a severity level is allowed to stay open before it is "due". */
export function computeIncidentDueAt(
  severity: IncidentSeverityLevel,
  detectedAt: Date,
  policy: IncidentPolicy = DEFAULT_INCIDENT_POLICY
): Date {
  const minutesBySeverity: Record<IncidentSeverityLevel, number> = {
    CRITICAL: policy.incidentDueMinutesCritical,
    HIGH: policy.incidentDueMinutesHigh,
    MEDIUM: policy.incidentDueMinutesMedium,
    LOW: policy.incidentDueMinutesLow,
  };
  return new Date(detectedAt.getTime() + minutesBySeverity[severity] * 60_000);
}

/** Moves severity up one level. CRITICAL is already the top and stays put. */
export function escalateSeverity(current: IncidentSeverityLevel): IncidentSeverityLevel {
  const order: IncidentSeverityLevel[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
  const index = order.indexOf(current);
  return order[Math.min(index + 1, order.length - 1)];
}

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function distanceInMeters(
  first: { latitude: number; longitude: number },
  second: { latitude: number; longitude: number }
) {
  const earthRadiusMeters = 6_371_000;
  const latitudeDelta = degreesToRadians(second.latitude - first.latitude);
  const longitudeDelta = degreesToRadians(second.longitude - first.longitude);
  const firstLatitude = degreesToRadians(first.latitude);
  const secondLatitude = degreesToRadians(second.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(haversine));
}

export function isLocationWithinWorksite(
  location: { latitude?: number; longitude?: number; accuracyMeters?: number },
  worksite: { latitude?: number; longitude?: number; radiusMeters: number }
) {
  if (
    location.latitude === undefined ||
    location.longitude === undefined ||
    worksite.latitude === undefined ||
    worksite.longitude === undefined
  ) {
    return false;
  }

  const distance = distanceInMeters(
    { latitude: location.latitude, longitude: location.longitude },
    { latitude: worksite.latitude, longitude: worksite.longitude }
  );
  return distance <= worksite.radiusMeters + (location.accuracyMeters ?? 0);
}
import { getZonedWeekdayAndMinutes } from "@/lib/utils";
