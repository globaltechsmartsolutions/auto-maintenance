import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ getPrisma: vi.fn() }));
import { __test__, isOperationsBriefEnabled } from "@/lib/ai/operations-brief";

describe("operations AI brief privacy boundary", () => {
  const previousEnabled = process.env.AI_OPERATIONS_BRIEF_ENABLED;
  const previousKey = process.env.AI_GATEWAY_API_KEY;

  afterEach(() => {
    process.env.AI_OPERATIONS_BRIEF_ENABLED = previousEnabled;
    process.env.AI_GATEWAY_API_KEY = previousKey;
  });

  it("requires an explicit flag and server credential", () => {
    process.env.AI_OPERATIONS_BRIEF_ENABLED = "false";
    process.env.AI_GATEWAY_API_KEY = "secret";
    expect(isOperationsBriefEnabled()).toBe(false);
    process.env.AI_OPERATIONS_BRIEF_ENABLED = "true";
    process.env.AI_GATEWAY_API_KEY = "";
    expect(isOperationsBriefEnabled()).toBe(false);
  });

  it("sends only operational facts, never employee names or coordinates", () => {
    const facts = __test__.operationalFacts([{
      id: "shift-1", title: "Cleaning", status: "UNCOVERED", startsAt: "2026-08-20T09:00:00.000Z", endsAt: "2026-08-20T10:00:00.000Z",
      requiredSkills: [], gracePeriodMinutes: 5, employee: { id: "employee-1", name: "Private Employee" },
      worksite: { id: "worksite-1", name: "Office", address: "Private Street", city: "Madrid", verificationMode: "LOCATION" },
      service: { id: "service-1", title: "Daily cleaning", customerId: "customer-1", customerName: "Private Customer" },
      clockEvents: [{ id: "clock-1", type: "CLOCK_IN", method: "MOBILE", occurredAt: "2026-08-20T09:00:00.000Z", recordedAt: "2026-08-20T09:00:00.000Z", locationVerified: true }],
      incidents: [{ id: "incident-1", type: "LATE", status: "OPEN", severity: "HIGH", title: "Late arrival", detail: "Private detail", detectedAt: "2026-08-20T09:10:00.000Z" }], latestCoverageDecision: null,
    }] as never);
    expect(facts).toEqual([expect.objectContaining({ shiftId: "shift-1", service: "Daily cleaning", worksite: "Office", hasClockIn: true, hasClockOut: false })]);
    expect(JSON.stringify(facts)).not.toContain("Private Employee");
    expect(JSON.stringify(facts)).not.toContain("Private Street");
    expect(JSON.stringify(facts)).not.toContain("Private detail");
  });
});
