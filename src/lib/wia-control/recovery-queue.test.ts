import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const prisma = {
    attendanceIncident: { findMany: vi.fn() },
    communicationOutbox: { findMany: vi.fn() },
  };
  return { prisma };
});

vi.mock("@/lib/prisma", () => ({ getPrisma: () => mocks.prisma }));

import {
  minutesBetween,
  nextRecoveryAction,
  recoveryAlert,
  recoveryUrgency,
  type RecoveryFacts,
} from "@/lib/wia-control/recovery-queue";
import { listRecoveryQueue, listRecoveryQueueServices, type WiaActor } from "@/lib/wia-control/service";

const now = new Date("2026-08-20T10:00:00Z");
const manager: WiaActor = { companyId: "company-1", userId: "user-manager", role: "MANAGER" };
const worker: WiaActor = { companyId: "company-1", userId: "user-worker", role: "EMPLOYEE", employeeId: "employee-1" };

function facts(overrides: Partial<RecoveryFacts> = {}): RecoveryFacts {
  return {
    status: "OPEN",
    severity: "HIGH",
    detectedAt: new Date("2026-08-20T09:30:00Z"),
    dueAt: new Date("2026-08-20T13:30:00Z"),
    acknowledgedAt: null,
    hasOwner: true,
    hasCoverageDecision: false,
    coverageAcknowledged: false,
    shiftUncovered: true,
    ...overrides,
  };
}

function incident(overrides: Record<string, unknown> = {}) {
  return {
    id: "incident-1",
    type: "MISSING_CLOCK_IN",
    status: "ACKNOWLEDGED",
    severity: "HIGH",
    title: "Nobody clocked in",
    detectedAt: new Date("2026-08-20T09:30:00Z"),
    dueAt: new Date("2026-08-20T13:30:00Z"),
    acknowledgedAt: new Date("2026-08-20T09:35:00Z"),
    ownerId: "user-manager",
    owner: { id: "user-manager", firstName: "Rosa", lastName: "Gil" },
    worksite: { id: "worksite-1", name: "Main office" },
    employee: null,
    shift: {
      id: "shift-1",
      title: "Opening shift",
      status: "UNCOVERED",
      employeeId: null,
      scheduledStart: new Date("2026-08-20T09:00:00Z"),
      scheduledEnd: new Date("2026-08-20T13:00:00Z"),
      service: { id: "service-1", title: "Daily office cleaning", customer: { id: "customer-1", name: "Acme" } },
    },
    coverageDecisions: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.communicationOutbox.findMany.mockResolvedValue([]);
});

describe("next recovery action", () => {
  it("asks for an owner before anything else", () => {
    expect(nextRecoveryAction(facts({ hasOwner: false }), now)).toEqual({
      code: "ASSIGN_OWNER",
      label: "Assign an accountable coordinator.",
    });
  });

  it("escalates rather than assigning when the promise is already missed", () => {
    const overdue = facts({ hasOwner: false, dueAt: new Date("2026-08-20T09:45:00Z") });
    expect(nextRecoveryAction(overdue, now).code).toBe("ESCALATE");
  });

  it("walks an owned incident through acknowledge, cover, chase, resolve", () => {
    expect(nextRecoveryAction(facts({ status: "OPEN" }), now).code).toBe("ACKNOWLEDGE");
    expect(nextRecoveryAction(facts({ status: "ACKNOWLEDGED" }), now).code).toBe("CONFIRM_COVERAGE");
    expect(
      nextRecoveryAction(
        facts({ status: "ACKNOWLEDGED", shiftUncovered: false, hasCoverageDecision: true }),
        now
      ).code
    ).toBe("AWAIT_ACKNOWLEDGEMENT");
    expect(
      nextRecoveryAction(
        facts({
          status: "ACKNOWLEDGED",
          shiftUncovered: false,
          hasCoverageDecision: true,
          coverageAcknowledged: true,
        }),
        now
      ).code
    ).toBe("RESOLVE");
  });

  it("asks for nothing once the incident is closed", () => {
    expect(nextRecoveryAction(facts({ status: "RESOLVED" }), now).code).toBe("NONE");
    expect(recoveryAlert(facts({ status: "DISMISSED", dueAt: new Date("2026-01-01") }), now)).toBeNull();
  });
});

describe("recovery alerts and ordering", () => {
  it("reports the single most urgent reason for attention", () => {
    expect(recoveryAlert(facts({ dueAt: new Date("2026-08-20T09:59:00Z") }), now)).toBe("OVERDUE");
    expect(recoveryAlert(facts({ hasOwner: false }), now)).toBe("UNOWNED");
    expect(
      recoveryAlert(
        facts({
          status: "ACKNOWLEDGED",
          acknowledgedAt: new Date("2026-08-20T08:00:00Z"),
          hasCoverageDecision: false,
        }),
        now
      )
    ).toBe("STALE");
    expect(recoveryAlert(facts({ severity: "LOW", hasOwner: false, detectedAt: new Date("2026-08-20T09:55:00Z") }), now)).toBeNull();
  });

  it("ranks a missed promise above a severe one still inside its window", () => {
    const overdueMedium = facts({ severity: "MEDIUM", dueAt: new Date("2026-08-20T09:00:00Z") });
    const criticalInWindow = facts({ severity: "CRITICAL" });
    expect(recoveryUrgency(overdueMedium, now)).toBeGreaterThan(recoveryUrgency(criticalInWindow, now));
    expect(recoveryUrgency(facts({ status: "RESOLVED" }), now)).toBe(0);
  });

  it("measures age forward only, never negative", () => {
    expect(minutesBetween(new Date("2026-08-20T09:30:00Z"), now)).toBe(30);
    expect(minutesBetween(now, new Date("2026-08-20T09:30:00Z"))).toBe(0);
  });
});

describe("recovery queue", () => {
  it("orders by urgency and counts what needs attention", async () => {
    mocks.prisma.attendanceIncident.findMany.mockResolvedValue([
      incident({ id: "incident-calm", severity: "LOW", dueAt: new Date("2026-08-20T20:00:00Z") }),
      incident({ id: "incident-overdue", dueAt: new Date("2026-08-20T09:45:00Z") }),
      incident({ id: "incident-unowned", ownerId: null, owner: null }),
    ]);

    const queue = await listRecoveryQueue(manager, {}, now);

    expect(queue.rows.map((row) => row.incidentId)).toEqual([
      "incident-overdue",
      "incident-unowned",
      "incident-calm",
    ]);
    expect(queue.counts).toEqual({ total: 3, overdue: 1, unowned: 1, stale: 0 });
    expect(queue.rows[0].action.code).toBe("ESCALATE");
    expect(queue.rows[1].action.code).toBe("ASSIGN_OWNER");
  });

  it("carries the client service and the coverage acknowledgement into each row", async () => {
    mocks.prisma.attendanceIncident.findMany.mockResolvedValue([
      incident({
        shift: { ...incident().shift, status: "COVERED", employeeId: "employee-2" },
        coverageDecisions: [
          {
            id: "decision-1",
            createdAt: new Date("2026-08-20T09:40:00Z"),
            selectedEmployeeId: "employee-2",
            selectedEmployee: { user: { firstName: "Luis", lastName: "Marin" } },
          },
        ],
      }),
    ]);
    mocks.prisma.communicationOutbox.findMany.mockResolvedValue([
      {
        shiftId: "shift-1",
        acknowledgedAt: new Date("2026-08-20T09:45:00Z"),
        status: "SENT",
        createdAt: new Date("2026-08-20T09:41:00Z"),
      },
    ]);

    const queue = await listRecoveryQueue(manager, {}, now);

    expect(queue.rows[0].service).toEqual({
      id: "service-1",
      title: "Daily office cleaning",
      customer: "Acme",
    });
    expect(queue.rows[0].coverage).toEqual({
      decidedAt: new Date("2026-08-20T09:40:00Z"),
      employee: "Luis Marin",
      acknowledged: true,
    });
    expect(queue.rows[0].action.code).toBe("RESOLVE");
  });

  it("filters by client service and by unassigned owner", async () => {
    mocks.prisma.attendanceIncident.findMany.mockResolvedValue([]);

    await listRecoveryQueue(manager, { serviceId: "service-1", ownerId: "UNASSIGNED" }, now);

    expect(mocks.prisma.attendanceIncident.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: "company-1",
          ownerId: null,
          shift: { serviceId: "service-1" },
          status: { in: ["OPEN", "ACKNOWLEDGED"] },
        }),
      })
    );
  });

  it("offers only the services that actually have something at risk", async () => {
    mocks.prisma.attendanceIncident.findMany.mockResolvedValue([
      { shift: { service: { id: "service-2", title: "Night cleaning" } } },
      { shift: { service: { id: "service-1", title: "Daily office cleaning" } } },
      { shift: { service: { id: "service-1", title: "Daily office cleaning" } } },
    ]);

    expect(await listRecoveryQueueServices(manager)).toEqual([
      { id: "service-1", title: "Daily office cleaning" },
      { id: "service-2", title: "Night cleaning" },
    ]);
  });

  it("is not readable by a field worker", async () => {
    await expect(listRecoveryQueue(worker, {}, now)).rejects.toThrow(/cannot view the recovery queue/);
    await expect(listRecoveryQueueServices(worker)).rejects.toThrow(/cannot view the recovery queue/);
    expect(mocks.prisma.attendanceIncident.findMany).not.toHaveBeenCalled();
  });
});
