import { describe, expect, it } from "vitest";
import {
  getServiceProfile,
  recommendAssignee,
  type DemoAssignmentDecision,
  type DemoAssignmentEmployeeInput,
  type DemoAssignmentServiceInput,
} from "@/lib/assignment/demo-assignment";

/**
 * The explainable assignment engine. What matters here is not the exact score
 * but that every refusal has a stated reason, every recommendation carries the
 * reasons behind it, and nobody is ever recommended in spite of a hard
 * constraint.
 */

function employee(overrides: Partial<DemoAssignmentEmployeeInput> = {}): DemoAssignmentEmployeeInput {
  return {
    id: "employee-1",
    name: "Ana Lopez",
    status: "Active",
    availability: "Mon-Fri 07:00-15:00",
    jobs: 1,
    score: 90,
    skills: ["office cleaning"],
    zones: ["Madrid"],
    maxJobsPerDay: 4,
    ...overrides,
  };
}

function service(overrides: Partial<DemoAssignmentServiceInput> = {}): DemoAssignmentServiceInput {
  return {
    id: "service-1",
    title: "Office cleaning",
    customer: "Acme Facilities",
    status: "Scheduled",
    // A Wednesday morning, inside the usual window above.
    start: "2026-08-19T08:00:00.000Z",
    team: [],
    city: "Madrid",
    requiredSkills: ["office cleaning"],
    estimatedDurationMinutes: 120,
    ...overrides,
  };
}

function recommend(
  employees: DemoAssignmentEmployeeInput[],
  target = service(),
  services: DemoAssignmentServiceInput[] = [],
  decisions: DemoAssignmentDecision[] = []
) {
  return recommendAssignee({ decisions, employees, service: target, services: [target, ...services] });
}

describe("service profiling", () => {
  it("derives a family, the required skills, and a duration from the service itself", () => {
    const profile = getServiceProfile(service());
    expect(profile.family.length).toBeGreaterThan(0);
    expect(profile.estimatedDurationMinutes).toBe(120);
    expect(Array.isArray(profile.requiredSkills)).toBe(true);
  });
});

describe("hard constraints", () => {
  it("never recommends somebody on holiday, and says why", () => {
    const result = recommend([employee({ status: "On holiday" })]);
    expect(result.employeeName).toBe("Unassigned team");
    expect(result.canAutoAssign).toBe(false);
    expect(result.rejected).toEqual([{ employeeName: "Ana Lopez", reason: "is on holiday" }]);
  });

  it("never recommends somebody outside their working days", () => {
    // A Sunday, outside "Monday to Friday".
    const result = recommend([employee()], service({ start: "2026-08-23T08:00:00.000Z" }));
    expect(result.rejected[0].reason).toBe("does not work on that date");
  });

  it("treats an availability string it does not recognise as no day restriction", () => {
    // Documented, deliberate behaviour of this demo engine: only the
    // "Mon-Fri" / "Mon-Sat" shorthand and the "returns"/"on leave" markers
    // restrict days. A free-text availability is not a refusal, so a person is
    // still surfaced to a coordinator rather than silently disappearing. The
    // operational coverage engine uses structured availability instead.
    const result = recommend(
      [employee({ availability: "Weekdays only" })],
      service({ start: "2026-08-23T08:00:00.000Z" })
    );
    expect(result.employeeName).toBe("Ana Lopez");
  });

  it("never recommends somebody outside their working hours", () => {
    const result = recommend([employee()], service({ start: "2026-08-19T22:00:00.000Z" }));
    expect(result.rejected[0].reason).toMatch(/outside the usual schedule/);
  });

  it("never recommends somebody already at their daily limit", () => {
    const target = service();
    const sameDay = Array.from({ length: 3 }, (_, index) =>
      service({
        id: `service-other-${index}`,
        start: "2026-08-19T12:00:00.000Z",
        team: ["Ana Lopez"],
      })
    );
    const result = recommend([employee({ maxJobsPerDay: 3 })], target, sameDay);
    expect(result.rejected[0].reason).toMatch(/maximum workload|nearby time slot/);
  });

  it("explains a no-candidate outcome instead of returning nothing", () => {
    const result = recommend([employee({ status: "On holiday" }), employee({ id: "employee-2", name: "Luis Marin", status: "On holiday" })]);
    expect(result.state).toBe("Review before assignment");
    expect(result.summary).toMatch(/No person is clearly available/);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.reasons).toEqual(["The request remains pending for manual review."]);
  });
});

describe("recommendation", () => {
  it("recommends an eligible person and states the reasons behind it", () => {
    const result = recommend([employee()]);
    expect(result.employeeName).toBe("Ana Lopez");
    expect(result.reasons.length).toBeGreaterThan(0);
    expect(result.internalScore).toBeGreaterThan(0);
  });

  it("prefers the better-matching person and offers the other as an alternative", () => {
    const specialist = employee({ id: "employee-1", name: "Ana Lopez", score: 97, jobs: 0 });
    const generalist = employee({
      id: "employee-2",
      name: "Luis Marin",
      score: 60,
      skills: ["window cleaning"],
      zones: ["Barcelona"],
    });

    const result = recommend([generalist, specialist]);

    expect(result.employeeName).toBe("Ana Lopez");
    expect(result.alternatives.map((alternative) => alternative.employeeName)).toContain("Luis Marin");
    expect(result.alternatives.every((alternative) => alternative.reason.length > 0)).toBe(true);
  });

  it("warns rather than silently accepting a person outside their usual zone", () => {
    const result = recommend([employee({ zones: ["Barcelona"] })]);
    expect(result.warnings.join(" ")).toMatch(/outside their usual zone/);
  });

  it("carries past decisions into its learning signals without letting them override a constraint", () => {
    const decisions: DemoAssignmentDecision[] = [
      {
        id: "decision-1",
        serviceId: "service-0",
        serviceTitle: "Office cleaning",
        serviceFamily: getServiceProfile(service()).family,
        customer: "Acme Facilities",
        city: "Madrid",
        selectedEmployee: "Ana Lopez",
        wasAcceptedByManager: true,
        decisionType: "manager-confirmed",
        resultLabel: "Completed",
        createdAt: "2026-08-01T08:00:00.000Z",
        reasons: [],
      },
    ];

    const withHistory = recommend([employee()], service(), [], decisions);
    expect(withHistory.employeeName).toBe("Ana Lopez");

    const onHoliday = recommend([employee({ status: "On holiday" })], service(), [], decisions);
    expect(onHoliday.employeeName).toBe("Unassigned team");
  });
});
