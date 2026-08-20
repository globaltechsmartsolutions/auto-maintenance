import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const transaction = {
    attendanceIncident: {
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    company: { findUnique: vi.fn() },
    employee: { findFirst: vi.fn() },
    plannedShift: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    coverageDecision: { create: vi.fn() },
    communicationOutbox: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    auditLog: { create: vi.fn() },
  };
  const communicationOutbox = {
    findMany: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
  };
  const prisma = {
    $transaction: vi.fn(async (callback: (client: typeof transaction) => unknown) =>
      callback(transaction)
    ),
    communicationOutbox,
  };
  const providers = {
    deliverInApp: vi.fn(),
    deliverEmail: vi.fn(),
  };
  return { prisma, transaction, providers };
});

vi.mock("@/lib/prisma", () => ({ getPrisma: () => mocks.prisma }));
vi.mock("@/lib/wia-control/communication-providers", () => mocks.providers);

import {
  acknowledgeCommunication,
  confirmCoverage,
  detectIncompleteAttendance,
  processCommunicationOutbox,
  resendCommunication,
  type WiaActor,
} from "@/lib/wia-control/service";
import { MAX_COMMUNICATION_ATTEMPTS } from "@/lib/wia-control/domain-core";

const manager: WiaActor = {
  companyId: "company-1",
  userId: "user-manager",
  role: "MANAGER",
};

const employeeActor: WiaActor = {
  companyId: "company-1",
  userId: "user-employee",
  role: "EMPLOYEE",
  employeeId: "employee-recommended",
};

const baseInput = {
  shiftId: "shift-1",
  incidentId: "incident-1",
  selectedEmployeeId: "employee-recommended",
};

describe("coverage transaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.attendanceIncident.findFirst.mockResolvedValue({
      id: "incident-1",
      shiftId: "shift-1",
      recommendedEmployeeId: "employee-recommended",
      shift: {
        scheduledStart: new Date("2026-08-08T07:00:00Z"),
        scheduledEnd: new Date("2026-08-08T10:00:00Z"),
        requiredSkills: [],
        worksite: { city: "Getafe" },
      },
    });
    mocks.transaction.employee.findFirst.mockResolvedValue({
      id: "employee-recommended",
      fieldStatus: "AVAILABLE",
      skills: [],
      zones: [],
      availability: null,
      maxHoursPerDay: null,
      maxJobsPerDay: null,
    });
    mocks.transaction.plannedShift.findMany.mockResolvedValue([]);
    mocks.transaction.coverageDecision.create.mockResolvedValue({ id: "decision-1" });
    mocks.transaction.plannedShift.update.mockResolvedValue({ id: "shift-1" });
    mocks.transaction.attendanceIncident.update.mockResolvedValue({ id: "incident-1" });
    mocks.transaction.communicationOutbox.create.mockResolvedValue({ id: "message-1" });
    mocks.transaction.auditLog.create.mockResolvedValue({ id: "audit-1" });
  });

  it("persists decision, shift, incident, communication, and audit in one transaction", async () => {
    await expect(confirmCoverage(manager, baseInput)).resolves.toEqual({ id: "decision-1" });

    expect(mocks.prisma.$transaction).toHaveBeenCalledOnce();
    expect(mocks.transaction.coverageDecision.create).toHaveBeenCalledOnce();
    expect(mocks.transaction.plannedShift.update).toHaveBeenCalledWith({
      where: { id: "shift-1" },
      data: { employeeId: "employee-recommended", status: "COVERED" },
    });
    expect(mocks.transaction.attendanceIncident.update).toHaveBeenCalledOnce();
    expect(mocks.transaction.communicationOutbox.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId: "company-1",
        shiftId: "shift-1",
        recipientEmployeeId: "employee-recommended",
        template: "coverage_confirmed",
      }),
    });
    expect(mocks.transaction.auditLog.create).toHaveBeenCalledOnce();
  });

  it("requires a reason when coordination overrides the recommendation", async () => {
    mocks.transaction.employee.findFirst.mockResolvedValueOnce({
      id: "employee-alternative",
      fieldStatus: "AVAILABLE",
      skills: [],
      zones: [],
      availability: null,
      maxHoursPerDay: null,
      maxJobsPerDay: null,
    });
    await expect(
      confirmCoverage(manager, {
        ...baseInput,
        selectedEmployeeId: "employee-alternative",
      })
    ).rejects.toMatchObject({ code: "OVERRIDE_REASON_REQUIRED" });
    expect(mocks.transaction.coverageDecision.create).not.toHaveBeenCalled();
  });

  it("uses the persisted recommendation instead of a client-supplied one", async () => {
    mocks.transaction.employee.findFirst.mockResolvedValueOnce({
      id: "employee-alternative",
      fieldStatus: "AVAILABLE",
      skills: [],
      zones: [],
      availability: null,
      maxHoursPerDay: null,
      maxJobsPerDay: null,
    });
    await expect(
      confirmCoverage(manager, {
        ...baseInput,
        selectedEmployeeId: "employee-alternative",
        recommendedEmployeeId: "employee-alternative",
        score: 100,
      })
    ).rejects.toMatchObject({ code: "OVERRIDE_REASON_REQUIRED" });
    expect(mocks.transaction.coverageDecision.create).not.toHaveBeenCalled();
  });

  it("rejects a selected employee who is on vacation (Stage 4 hard constraint)", async () => {
    mocks.transaction.employee.findFirst.mockResolvedValue({
      id: "employee-recommended",
      fieldStatus: "VACATION",
      skills: [],
      zones: [],
      availability: null,
      maxHoursPerDay: null,
      maxJobsPerDay: null,
    });
    await expect(confirmCoverage(manager, baseInput)).rejects.toMatchObject({
      code: "EMPLOYEE_UNAVAILABLE",
    });
    expect(mocks.transaction.coverageDecision.create).not.toHaveBeenCalled();
  });

  it("rejects a selected employee missing a required skill (Stage 4 hard constraint)", async () => {
    mocks.transaction.attendanceIncident.findFirst.mockResolvedValue({
      id: "incident-1",
      shiftId: "shift-1",
      recommendedEmployeeId: "employee-recommended",
      shift: {
        scheduledStart: new Date("2026-08-08T07:00:00Z"),
        scheduledEnd: new Date("2026-08-08T10:00:00Z"),
        requiredSkills: ["windows"],
        worksite: { city: "Getafe" },
      },
    });
    mocks.transaction.employee.findFirst.mockResolvedValue({
      id: "employee-recommended",
      fieldStatus: "AVAILABLE",
      skills: [],
      zones: [],
      availability: null,
      maxHoursPerDay: null,
      maxJobsPerDay: null,
    });
    await expect(confirmCoverage(manager, baseInput)).rejects.toMatchObject({
      code: "EMPLOYEE_UNAVAILABLE",
    });
    expect(mocks.transaction.coverageDecision.create).not.toHaveBeenCalled();
  });

  it("rejects a selected employee with an overlapping shift, even without going through the recommendation list", async () => {
    mocks.transaction.plannedShift.findMany.mockResolvedValue([
      {
        scheduledStart: new Date("2026-08-08T08:00:00Z"),
        scheduledEnd: new Date("2026-08-08T11:00:00Z"),
      },
    ]);
    await expect(confirmCoverage(manager, baseInput)).rejects.toMatchObject({
      code: "SHIFT_OVERLAP",
    });
    expect(mocks.transaction.coverageDecision.create).not.toHaveBeenCalled();
  });

  it("prevents an employee from confirming coverage", async () => {
    await expect(
      confirmCoverage(
        { companyId: "company-1", employeeId: "employee-1", role: "EMPLOYEE" },
        baseInput
      )
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("detectIncompleteAttendance (Stage 3 acceptance test)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.company.findUnique.mockResolvedValue({
      lateSeverityThresholdMinutes: 30,
      incidentDueMinutesCritical: 60,
      incidentDueMinutesHigh: 240,
      incidentDueMinutesMedium: 1_440,
      incidentDueMinutesLow: 4_320,
    });
    mocks.transaction.attendanceIncident.create.mockResolvedValue({ id: "incident-new" });
    mocks.transaction.auditLog.create.mockResolvedValue({ id: "audit-1" });
  });

  it("creates exactly one incident the first time a shift is missing a clock-in", async () => {
    mocks.transaction.plannedShift.findMany.mockResolvedValue([
      {
        id: "shift-1",
        employeeId: "employee-1",
        worksiteId: "worksite-1",
        clockEvents: [],
        incidents: [],
      },
    ]);

    const result = await detectIncompleteAttendance(manager, new Date("2026-08-08T12:00:00Z"));

    expect(result.created).toBe(1);
    expect(mocks.transaction.attendanceIncident.create).toHaveBeenCalledOnce();
  });

  it(
    "running detection twice for the same late arrival results in one open incident " +
    "— no duplicate is created the second time",
    async () => {
      // First run: no incident exists yet for this shift.
      mocks.transaction.plannedShift.findMany.mockResolvedValueOnce([
        {
          id: "shift-1",
          employeeId: "employee-1",
          worksiteId: "worksite-1",
          clockEvents: [],
          incidents: [],
        },
      ]);
      const first = await detectIncompleteAttendance(manager, new Date("2026-08-08T12:00:00Z"));
      expect(first.created).toBe(1);

      // Second run: the shift now already has the incident from the first
      // run (as it would in the real database) — detection must not add
      // another one for the same condition.
      mocks.transaction.plannedShift.findMany.mockResolvedValueOnce([
        {
          id: "shift-1",
          employeeId: "employee-1",
          worksiteId: "worksite-1",
          clockEvents: [],
          incidents: [{ type: "MISSING_CLOCK_IN" }],
        },
      ]);
      const second = await detectIncompleteAttendance(manager, new Date("2026-08-08T12:05:00Z"));

      expect(second.created).toBe(0);
      // Exactly one create call across both runs combined.
      expect(mocks.transaction.attendanceIncident.create).toHaveBeenCalledOnce();
    }
  );

  it("treats a concurrent unique-key conflict as an already-created incident", async () => {
    mocks.transaction.plannedShift.findMany.mockResolvedValue([
      {
        id: "shift-1",
        employeeId: "employee-1",
        worksiteId: "worksite-1",
        clockEvents: [],
        incidents: [],
      },
    ]);
    mocks.transaction.attendanceIncident.create.mockRejectedValueOnce({ code: "P2002" });

    await expect(
      detectIncompleteAttendance(manager, new Date("2026-08-08T12:00:00Z"))
    ).resolves.toMatchObject({ created: 0, incidentIds: [] });
  });

  it("prevents an employee from running detection", async () => {
    await expect(
      detectIncompleteAttendance(
        { companyId: "company-1", employeeId: "employee-1", role: "EMPLOYEE" },
        new Date()
      )
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("communications outbox worker (Stage 5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const now = new Date("2026-08-20T12:00:00.000Z");

  function inAppRecord(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: "outbox-1",
      channel: "IN_APP",
      template: "coverage_confirmed",
      payload: {},
      status: "PENDING",
      attempts: 0,
      nextAttemptAt: now,
      recipientEmployee: { user: { email: null } },
      ...overrides,
    };
  }

  it("delivers a due IN_APP record and marks it SENT", async () => {
    mocks.prisma.communicationOutbox.findMany.mockResolvedValue([inAppRecord()]);
    mocks.prisma.communicationOutbox.updateMany.mockResolvedValue({ count: 1 });
    mocks.providers.deliverInApp.mockResolvedValue({ success: true, providerReference: "in-app" });
    mocks.prisma.communicationOutbox.update.mockResolvedValue({ id: "outbox-1" });

    const result = await processCommunicationOutbox(now);

    expect(result).toEqual({ processed: 1, results: [{ id: "outbox-1", status: "SENT" }] });
    expect(mocks.prisma.communicationOutbox.update).toHaveBeenCalledWith({
      where: { id: "outbox-1" },
      data: {
        status: "SENT",
        sentAt: now,
        attempts: 1,
        lastError: null,
        processingStartedAt: null,
      },
    });
  });

  it("reclaims a stale processing lease before looking for due records", async () => {
    mocks.prisma.communicationOutbox.findMany.mockResolvedValue([]);
    mocks.prisma.communicationOutbox.updateMany.mockResolvedValue({ count: 1 });

    await expect(processCommunicationOutbox(now)).resolves.toEqual({ processed: 0, results: [] });

    expect(mocks.prisma.communicationOutbox.updateMany.mock.calls[0]?.[0]).toEqual({
      where: {
        status: "PROCESSING",
        processingStartedAt: { lt: new Date(now.getTime() - 15 * 60_000) },
      },
      data: {
        status: "RETRYING",
        processingStartedAt: null,
        nextAttemptAt: now,
        lastError: "Delivery processing lease expired and was recovered.",
      },
    });
  });

  it("does not double-process a record already claimed by another worker run (duplicate-safety)", async () => {
    mocks.prisma.communicationOutbox.findMany.mockResolvedValue([inAppRecord()]);
    // Another worker run already moved it to PROCESSING between our read
    // and our claim attempt -- the optimistic-lock update affects zero rows.
    mocks.prisma.communicationOutbox.updateMany.mockResolvedValue({ count: 0 });

    const result = await processCommunicationOutbox(now);

    expect(result).toEqual({ processed: 0, results: [] });
    expect(mocks.providers.deliverInApp).not.toHaveBeenCalled();
    expect(mocks.prisma.communicationOutbox.update).not.toHaveBeenCalled();
  });

  it("routes SMS and WhatsApp to an explicit not-yet-available failure, never a silent no-op", async () => {
    mocks.prisma.communicationOutbox.findMany.mockResolvedValue([
      inAppRecord({ id: "outbox-sms", channel: "SMS", status: "PENDING", attempts: 0 }),
    ]);
    mocks.prisma.communicationOutbox.updateMany.mockResolvedValue({ count: 1 });
    mocks.prisma.communicationOutbox.update.mockResolvedValue({ id: "outbox-sms" });

    const result = await processCommunicationOutbox(now);

    expect(result.results).toEqual([{ id: "outbox-sms", status: "RETRYING" }]);
    expect(mocks.prisma.communicationOutbox.update).toHaveBeenCalledWith({
      where: { id: "outbox-sms" },
      data: expect.objectContaining({
        status: "RETRYING",
        lastError: "SMS delivery is not yet available.",
      }),
    });
  });

  /**
   * Stage 5 acceptance test (playbook wording): "a deliberately failing
   * provider call becomes a visible failed outbox item after bounded
   * retries, without duplicate messages." Simulates MAX_COMMUNICATION_ATTEMPTS
   * separate scheduled worker runs against the same record, each one
   * reflecting the state the previous run left behind, with the provider
   * failing every single time.
   */
  it("a deliberately failing provider call becomes FAILED after bounded retries, with no duplicate SENT", async () => {
    mocks.providers.deliverEmail.mockResolvedValue({
      success: false,
      error: "Simulated provider outage.",
    });
    mocks.prisma.communicationOutbox.updateMany.mockResolvedValue({ count: 1 });

    let currentStatus: string = "PENDING";
    let currentAttempts = 0;

    for (let run = 1; run <= MAX_COMMUNICATION_ATTEMPTS; run += 1) {
      mocks.prisma.communicationOutbox.findMany.mockResolvedValueOnce([
        {
          id: "outbox-email",
          channel: "EMAIL",
          template: "coverage_confirmed",
          payload: {},
          status: currentStatus,
          attempts: currentAttempts,
          nextAttemptAt: now,
          recipientEmployee: { user: { email: "employee@example.com" } },
        },
      ]);
      mocks.prisma.communicationOutbox.update.mockImplementationOnce(async (args) => {
        currentStatus = args.data.status;
        currentAttempts = args.data.attempts;
        return { id: "outbox-email", ...args.data };
      });

      const result = await processCommunicationOutbox(now);
      const expectedStatus = run < MAX_COMMUNICATION_ATTEMPTS ? "RETRYING" : "FAILED";
      expect(result.results).toEqual([{ id: "outbox-email", status: expectedStatus }]);
    }

    expect(currentStatus).toBe("FAILED");
    expect(currentAttempts).toBe(MAX_COMMUNICATION_ATTEMPTS);
    // Across every single run, the record was never once marked SENT --
    // the acceptance test's exact "no duplicate messages" requirement.
    const allUpdateCalls = mocks.prisma.communicationOutbox.update.mock.calls;
    expect(allUpdateCalls).toHaveLength(MAX_COMMUNICATION_ATTEMPTS);
    expect(allUpdateCalls.every((call) => call[0].data.status !== "SENT")).toBe(true);
    expect(mocks.providers.deliverEmail).toHaveBeenCalledTimes(MAX_COMMUNICATION_ATTEMPTS);
  });

  it("reports an honest failure, not a false success, when the recipient has no email on file", async () => {
    mocks.prisma.communicationOutbox.findMany.mockResolvedValue([
      {
        id: "outbox-no-email",
        channel: "EMAIL",
        template: "coverage_confirmed",
        payload: {},
        status: "PENDING",
        attempts: 0,
        nextAttemptAt: now,
        recipientEmployee: { user: { email: null } },
      },
    ]);
    mocks.prisma.communicationOutbox.updateMany.mockResolvedValue({ count: 1 });
    mocks.prisma.communicationOutbox.update.mockResolvedValue({ id: "outbox-no-email" });

    await processCommunicationOutbox(now);

    expect(mocks.providers.deliverEmail).not.toHaveBeenCalled();
    expect(mocks.prisma.communicationOutbox.update).toHaveBeenCalledWith({
      where: { id: "outbox-no-email" },
      data: expect.objectContaining({
        lastError: "Recipient has no email address on file.",
      }),
    });
  });
});

describe("communication resend and acknowledge (Stage 5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lets a coordinator resend a FAILED message, resetting attempts", async () => {
    mocks.transaction.communicationOutbox.findFirst.mockResolvedValue({
      id: "outbox-1",
      companyId: "company-1",
      status: "FAILED",
      attempts: 5,
    });
    mocks.transaction.communicationOutbox.update.mockResolvedValue({ id: "outbox-1" });
    mocks.transaction.auditLog.create.mockResolvedValue({ id: "audit-1" });

    await resendCommunication(manager, "outbox-1");

    expect(mocks.transaction.communicationOutbox.update).toHaveBeenCalledWith({
      where: { id: "outbox-1" },
      data: {
        status: "PENDING",
        attempts: 0,
        lastError: null,
        processingStartedAt: null,
        nextAttemptAt: expect.any(Date),
      },
    });
    expect(mocks.transaction.auditLog.create).toHaveBeenCalledOnce();
  });

  it("refuses to resend a message that has not failed", async () => {
    mocks.transaction.communicationOutbox.findFirst.mockResolvedValue({
      id: "outbox-1",
      companyId: "company-1",
      status: "SENT",
      attempts: 1,
    });

    await expect(resendCommunication(manager, "outbox-1")).rejects.toMatchObject({
      code: "COMMUNICATION_NOT_FAILED",
    });
    expect(mocks.transaction.communicationOutbox.update).not.toHaveBeenCalled();
  });

  it("prevents an employee from resending a message", async () => {
    await expect(resendCommunication(employeeActor, "outbox-1")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("lets the recipient employee acknowledge their own message", async () => {
    mocks.transaction.communicationOutbox.findFirst.mockResolvedValue({
      id: "outbox-1",
      companyId: "company-1",
      recipientEmployeeId: "employee-recommended",
    });
    mocks.transaction.communicationOutbox.update.mockResolvedValue({ id: "outbox-1" });
    mocks.transaction.auditLog.create.mockResolvedValue({ id: "audit-1" });

    await acknowledgeCommunication(employeeActor, "outbox-1");

    expect(mocks.transaction.communicationOutbox.update).toHaveBeenCalledWith({
      where: { id: "outbox-1" },
      data: { acknowledgedAt: expect.any(Date) },
    });
  });

  it("prevents a coordinator from acknowledging on an employee's behalf", async () => {
    await expect(acknowledgeCommunication(manager, "outbox-1")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("does not let an employee acknowledge a message addressed to someone else", async () => {
    mocks.transaction.communicationOutbox.findFirst.mockResolvedValue(null);

    await expect(acknowledgeCommunication(employeeActor, "outbox-1")).rejects.toMatchObject({
      code: "COMMUNICATION_NOT_FOUND",
    });
  });
});
