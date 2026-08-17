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
  name: string;
  customer: string;
  address: string;
  city: string;
  verificationMode: string;
  radiusMeters: number;
  isActive?: boolean;
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
  performanceScore: number;
  incidentRate: number;
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
  recipientEmployee: string;
  channel: "IN_APP" | "EMAIL" | "SMS" | "WHATSAPP";
  template: string;
  status: "PENDING" | "PROCESSING" | "SENT" | "FAILED" | "CANCELLED";
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
  score += Math.round(Math.min(Math.max(input.performanceScore, 0), 100) / 10);
  if (input.incidentRate <= 0.02) {
    score += 5;
    reasons.push("Has a low incident rate.");
  }
  if (input.dailyJobs === 0) reasons.push("Has no other shifts that day.");
  if (input.dailyJobs >= 3) score -= 8;

  return { score: Math.max(0, Math.min(100, score)), reasons };
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
