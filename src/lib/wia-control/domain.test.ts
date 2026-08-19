import { describe, expect, it } from "vitest";
import {
  assertClockTransition,
  computeIncidentDueAt,
  computeIncidentSeverity,
  DEFAULT_INCIDENT_POLICY,
  distanceInMeters,
  getShiftStatusAfterClock,
  isLocationWithinWorksite,
  lateMinutes,
  incidentUpdateSchema,
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

  it("prioritises a profile with skills, area fit, and few incidents", () => {
    const strong = scoreCoverageCandidate({
      requiredSkills: ["windows", "communities"],
      worksiteCity: "Getafe",
      employeeSkills: ["windows", "communities"],
      employeeZones: ["Getafe"],
      performanceScore: 96,
      incidentRate: 0.01,
      dailyJobs: 0,
    });
    const weak = scoreCoverageCandidate({
      requiredSkills: ["windows", "communities"],
      worksiteCity: "Getafe",
      employeeSkills: ["offices"],
      employeeZones: ["Alicante"],
      performanceScore: 70,
      incidentRate: 0.08,
      dailyJobs: 3,
    });

    expect(strong.score).toBeGreaterThan(weak.score);
    expect(strong.reasons).toContain("Meets all required skills.");
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
