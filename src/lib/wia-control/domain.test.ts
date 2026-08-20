import { describe, expect, it } from "vitest";
import {
  assertClockTransition,
  computeIncidentDueAt,
  computeIncidentSeverity,
  computeNextCommunicationAttempt,
  DEFAULT_INCIDENT_POLICY,
  distanceInMeters,
  employeeProfileUpdateSchema,
  employeeMeetsRequiredSkills,
  employeeMeetsWorkingTimeLimits,
  employeeMeetsWorkZone,
  evaluateCoverageEligibility,
  getShiftStatusAfterClock,
  hasExceededCommunicationAttempts,
  isEmployeeAvailableForShift,
  isLocationWithinWorksite,
  lateMinutes,
  incidentUpdateSchema,
  MAX_COMMUNICATION_ATTEMPTS,
  parseEmployeeAvailability,
  plannedShiftInputSchema,
  rangesOverlap,
  scoreCoverageCandidate,
  WiaDomainError,
} from "@/lib/wia-control/domain";

describe("clock-event sequence", () => {
  it("allows a complete shift with a break", () => {
    expect(() => assertClockTransition(undefined, "CLOCK_IN")).not.toThrow();
    expect(() => assertClockTransition("CLOCK_IN", "BREAK_START")).not.toThrow();
    expect(() => assertClockTransition("BREAK_START", "BREAK_END")).not.toThrow();
    expect(() => assertClockTransition("BREAK_END", "CLOCK_OUT")).not.toThrow();
  });

  it("prevents clock-out without clock-in", () => {
    expect(() => assertClockTransition(undefined, "CLOCK_OUT")).toThrowError(WiaDomainError);
  });

  it("prevents two consecutive clock-ins", () => {
    expect(() => assertClockTransition("CLOCK_IN", "CLOCK_IN")).toThrowError(
      /Cannot record/
    );
  });

  it.each([
    ["CLOCK_IN", "ACTIVE"],
    ["BREAK_START", "PAUSED"],
    ["BREAK_END", "ACTIVE"],
    ["CLOCK_OUT", "COMPLETED"],
  ] as const)("converts %s into status %s", (event, status) => {
    expect(getShiftStatusAfterClock(event)).toBe(status);
  });
});

describe("planning", () => {
  it("detects overlapping shifts", () => {
    expect(
      rangesOverlap(
        new Date("2026-08-08T08:00:00Z"),
        new Date("2026-08-08T10:00:00Z"),
        new Date("2026-08-08T09:30:00Z"),
        new Date("2026-08-08T11:00:00Z")
      )
    ).toBe(true);
  });

  it("accepts consecutive shifts", () => {
    expect(
      rangesOverlap(
        new Date("2026-08-08T08:00:00Z"),
        new Date("2026-08-08T10:00:00Z"),
        new Date("2026-08-08T10:00:00Z"),
        new Date("2026-08-08T12:00:00Z")
      )
    ).toBe(false);
  });

  it("rejects a shift whose end precedes its start", () => {
    const result = plannedShiftInputSchema.safeParse({
      worksiteId: "worksite-1",
      title: "Invalid shift",
      scheduledStart: "2026-08-08T10:00:00+02:00",
      scheduledEnd: "2026-08-08T09:00:00+02:00",
    });
    expect(result.success).toBe(false);
  });

  it("applies the grace period before declaring a delay", () => {
    expect(
      lateMinutes(
        new Date("2026-08-08T08:00:00Z"),
        new Date("2026-08-08T08:11:00Z"),
        5
      )
    ).toBe(6);
  });
});

describe("point-in-time location verification", () => {
  const worksite = {
    latitude: 40.4168,
    longitude: -3.7038,
    radiusMeters: 120,
  };

  it("accepts a position inside the worksite", () => {
    expect(
      isLocationWithinWorksite(
        { latitude: 40.4169, longitude: -3.7037, accuracyMeters: 10 },
        worksite
      )
    ).toBe(true);
  });

  it("rejects a clearly distant position", () => {
    expect(
      isLocationWithinWorksite(
        { latitude: 40.43, longitude: -3.69, accuracyMeters: 10 },
        worksite
      )
    ).toBe(false);
  });

  it("calculates a symmetric distance", () => {
    const first = { latitude: 40.4168, longitude: -3.7038 };
    const second = { latitude: 40.4178, longitude: -3.7038 };
    expect(distanceInMeters(first, second)).toBeCloseTo(distanceInMeters(second, first), 6);
  });
});

describe("incidents and coverage", () => {
  it("requires a note to resolve an incident", () => {
    expect(incidentUpdateSchema.safeParse({ status: "RESOLVED" }).success).toBe(false);
    expect(
      incidentUpdateSchema.safeParse({
        status: "RESOLVED",
        resolutionNotes: "Verified with the responsible person.",
      }).success
    ).toBe(true);
  });

  it("prioritises skills, area fit, and workload without employee performance signals", () => {
    const strong = scoreCoverageCandidate({
      requiredSkills: ["windows", "communities"],
      worksiteCity: "Getafe",
      employeeSkills: ["windows", "communities"],
      employeeZones: ["Getafe"],
      dailyJobs: 0,
    });
    const weak = scoreCoverageCandidate({
      requiredSkills: ["windows", "communities"],
      worksiteCity: "Getafe",
      employeeSkills: ["offices"],
      employeeZones: ["Alicante"],
      dailyJobs: 3,
    });

    expect(strong.score).toBeGreaterThan(weak.score);
    expect(strong.reasons).toContain("Meets all required skills.");
  });
});

describe("employee profile input", () => {
  it("strips sign-in email changes from the profile endpoint", () => {
    expect(employeeProfileUpdateSchema.parse({ email: "new@example.com" })).toEqual({});
  });
});

describe("incident severity and due-date policy (Stage 3)", () => {
  it("treats a missing clock-in as high severity, since the shift is uncovered right now", () => {
    expect(computeIncidentSeverity("MISSING_CLOCK_IN")).toBe("HIGH");
  });

  it("treats an incomplete clock and an outside-location event as medium severity", () => {
    expect(computeIncidentSeverity("INCOMPLETE_CLOCK")).toBe("MEDIUM");
    expect(computeIncidentSeverity("OUTSIDE_LOCATION")).toBe("MEDIUM");
  });

  it("escalates a LATE incident to high severity once it crosses the company's threshold", () => {
    expect(
      computeIncidentSeverity("LATE", {
        lateMinutes: DEFAULT_INCIDENT_POLICY.lateSeverityThresholdMinutes - 1,
      })
    ).toBe("LOW");
    expect(
      computeIncidentSeverity("LATE", {
        lateMinutes: DEFAULT_INCIDENT_POLICY.lateSeverityThresholdMinutes,
      })
    ).toBe("HIGH");
  });

  it("respects a company's own policy thresholds instead of only the defaults", () => {
    const strictPolicy = { ...DEFAULT_INCIDENT_POLICY, lateSeverityThresholdMinutes: 5 };
    expect(computeIncidentSeverity("LATE", { lateMinutes: 6, policy: strictPolicy })).toBe("HIGH");
  });

  it("computes a due time that grows longer as severity decreases", () => {
    const detectedAt = new Date("2026-08-19T08:00:00.000Z");
    const critical = computeIncidentDueAt("CRITICAL", detectedAt);
    const high = computeIncidentDueAt("HIGH", detectedAt);
    const medium = computeIncidentDueAt("MEDIUM", detectedAt);
    const low = computeIncidentDueAt("LOW", detectedAt);

    expect(critical.getTime()).toBeLessThan(high.getTime());
    expect(high.getTime()).toBeLessThan(medium.getTime());
    expect(medium.getTime()).toBeLessThan(low.getTime());
  });

  it("uses the company's own due-time windows when provided", () => {
    const detectedAt = new Date("2026-08-19T08:00:00.000Z");
    const fastPolicy = { ...DEFAULT_INCIDENT_POLICY, incidentDueMinutesHigh: 15 };
    const due = computeIncidentDueAt("HIGH", detectedAt, fastPolicy);
    expect(due.getTime() - detectedAt.getTime()).toBe(15 * 60_000);
  });
});

describe("coverage eligibility hard constraints (Stage 4)", () => {
  const shiftStart = new Date("2026-08-19T09:00:00.000Z"); // Wednesday
  const shiftEnd = new Date("2026-08-19T13:00:00.000Z"); // 4-hour shift

  const baseInput = {
    fieldStatus: "AVAILABLE" as const,
    hasOverlap: false,
    requiredSkills: [] as string[],
    employeeSkills: [] as string[],
    worksiteCity: "Getafe",
    employeeZones: [] as string[],
    availability: null,
    shiftStart,
    shiftEnd,
    existingDailyMinutes: 0,
    existingDailyJobs: 0,
    maxHoursPerDay: null,
    maxJobsPerDay: null,
  };

  it("accepts a candidate that meets every constraint", () => {
    expect(evaluateCoverageEligibility(baseInput)).toEqual({ eligible: true });
  });

  it("excludes an employee on vacation, with a specific reason", () => {
    const result = evaluateCoverageEligibility({ ...baseInput, fieldStatus: "VACATION" });
    expect(result).toEqual({ eligible: false, reason: "Currently on vacation." });
  });

  it("excludes an employee with an overlapping shift", () => {
    const result = evaluateCoverageEligibility({ ...baseInput, hasOverlap: true });
    expect(result.eligible).toBe(false);
  });

  it("excludes an employee missing a required skill", () => {
    const result = evaluateCoverageEligibility({
      ...baseInput,
      requiredSkills: ["windows", "communities"],
      employeeSkills: ["windows"],
    });
    expect(result).toEqual({
      eligible: false,
      reason: "Does not have all the required skills.",
    });
  });

  it("accepts an employee who has every required skill", () => {
    const result = evaluateCoverageEligibility({
      ...baseInput,
      requiredSkills: ["windows"],
      employeeSkills: ["windows", "offices"],
    });
    expect(result.eligible).toBe(true);
  });

  it("excludes an employee whose declared zones do not include the worksite's city", () => {
    const result = evaluateCoverageEligibility({
      ...baseInput,
      worksiteCity: "Getafe",
      employeeZones: ["Alicante"],
    });
    expect(result).toEqual({
      eligible: false,
      reason: "Does not usually work in this zone.",
    });
  });

  it("does not exclude an employee with no declared zone restriction", () => {
    const result = evaluateCoverageEligibility({ ...baseInput, employeeZones: [] });
    expect(result.eligible).toBe(true);
  });

  it("excludes an employee not available on the shift's day of week", () => {
    const result = evaluateCoverageEligibility({
      ...baseInput,
      availability: { daysOfWeek: [1, 2] }, // Monday, Tuesday only
    });
    expect(result).toEqual({
      eligible: false,
      reason: "Not available at this day or time.",
    });
  });

  it("excludes an employee whose declared hours do not cover the shift", () => {
    const result = evaluateCoverageEligibility({
      ...baseInput,
      availability: { startMinute: 8 * 60, endMinute: 11 * 60 }, // shift ends at 13:00
    });
    expect(result.eligible).toBe(false);
  });

  it("excludes an employee who would exceed the daily hours limit", () => {
    const result = evaluateCoverageEligibility({
      ...baseInput,
      existingDailyMinutes: 5 * 60, // already worked 5h; this shift is 4h more
      maxHoursPerDay: 8,
    });
    expect(result).toEqual({
      eligible: false,
      reason: "Would exceed the daily working-time limit.",
    });
  });

  it("excludes an employee who would exceed the daily jobs limit", () => {
    const result = evaluateCoverageEligibility({
      ...baseInput,
      existingDailyJobs: 2,
      maxJobsPerDay: 2,
    });
    expect(result.eligible).toBe(false);
  });

  it("parses a well-formed availability JSON value", () => {
    expect(parseEmployeeAvailability({ daysOfWeek: [1, 2, 3], startMinute: 480, endMinute: 1020 })).toEqual({
      daysOfWeek: [1, 2, 3],
      startMinute: 480,
      endMinute: 1020,
    });
  });

  it("treats missing or malformed availability as no restriction", () => {
    expect(parseEmployeeAvailability(null)).toBeNull();
    expect(parseEmployeeAvailability(undefined)).toBeNull();
    expect(parseEmployeeAvailability("not an object")).toBeNull();
  });

  it("isEmployeeAvailableForShift treats a missing availability as always available", () => {
    expect(isEmployeeAvailableForShift(null, shiftStart, shiftEnd)).toBe(true);
  });

  it("employeeMeetsWorkZone treats an empty zone list as no restriction", () => {
    expect(employeeMeetsWorkZone("Getafe", [])).toBe(true);
    expect(employeeMeetsWorkZone("Getafe", ["Alicante"])).toBe(false);
    expect(employeeMeetsWorkZone("Getafe", ["Getafe"])).toBe(true);
  });

  it("employeeMeetsRequiredSkills treats an empty requirement list as always satisfied", () => {
    expect(employeeMeetsRequiredSkills([], [])).toBe(true);
  });

  it("employeeMeetsWorkingTimeLimits allows an employee with no configured limits", () => {
    expect(
      employeeMeetsWorkingTimeLimits({
        shiftMinutes: 600,
        existingDailyMinutes: 600,
        existingDailyJobs: 5,
        maxHoursPerDay: null,
        maxJobsPerDay: null,
      })
    ).toBe(true);
  });
});

describe("communications outbox retry policy (Stage 5)", () => {
  const now = new Date("2026-08-20T12:00:00.000Z");

  it("grows the delay between attempts (bounded backoff)", () => {
    const first = computeNextCommunicationAttempt(1, now);
    const second = computeNextCommunicationAttempt(2, now);
    const third = computeNextCommunicationAttempt(3, now);
    expect(first.getTime() - now.getTime()).toBeLessThan(second.getTime() - now.getTime());
    expect(second.getTime() - now.getTime()).toBeLessThan(third.getTime() - now.getTime());
  });

  it("does not keep growing the delay past the last configured step", () => {
    const atCap = computeNextCommunicationAttempt(MAX_COMMUNICATION_ATTEMPTS, now);
    const beyondCap = computeNextCommunicationAttempt(MAX_COMMUNICATION_ATTEMPTS + 5, now);
    expect(beyondCap.getTime()).toBe(atCap.getTime());
  });

  it("treats zero or negative attempts as the first backoff step, never a negative delay", () => {
    const zero = computeNextCommunicationAttempt(0, now);
    const negative = computeNextCommunicationAttempt(-3, now);
    expect(zero.getTime()).toBeGreaterThan(now.getTime());
    expect(negative.getTime()).toEqual(zero.getTime());
  });

  it("does not exceed the attempt limit before MAX_COMMUNICATION_ATTEMPTS attempts", () => {
    expect(hasExceededCommunicationAttempts(MAX_COMMUNICATION_ATTEMPTS - 1)).toBe(false);
  });

  it("exceeds the attempt limit at exactly MAX_COMMUNICATION_ATTEMPTS attempts", () => {
    expect(hasExceededCommunicationAttempts(MAX_COMMUNICATION_ATTEMPTS)).toBe(true);
  });
});
