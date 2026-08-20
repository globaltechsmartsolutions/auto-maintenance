import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const transaction = {
    attendanceIncident: {
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    company: { findUnique: vi.fn() },
    customer: { findFirst: vi.fn() },
    employee: { findFirst: vi.fn() },
    worksite: { findFirst: vi.fn() },
    service: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    plannedShift: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    shiftCompletion: { findFirst: vi.fn(), create: vi.fn() },
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
    attendanceIncident: { findMany: vi.fn() },
    customer: { count: vi.fn() },
    worksite: { count: vi.fn() },
    employee: { count: vi.fn() },
    service: { count: vi.fn() },
    plannedShift: { count: vi.fn() },
    clockEvent: { count: vi.fn() },
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
  createOperationalService,
  createPlannedShift,
  completePlannedShift,
  detectIncompleteAttendance,
  getCoverageRecoveryMetrics,
  getPilotOnboardingProgress,
  processCommunicationOutbox,
  resendCommunication,
  updateOperationalService,
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

describe("coverage recovery metrics", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calculates acknowledgement and recovery time from persisted timestamps", async () => {
    mocks.prisma.attendanceIncident.findMany.mockResolvedValue([
      { id: "one", detectedAt: new Date("2026-08-20T08:00:00Z"), acknowledgedAt: new Date("2026-08-20T08:10:00Z"), coverageDecisions: [{ createdAt: new Date("2026-08-20T08:30:00Z") }] },
      { id: "two", detectedAt: new Date("2026-08-20T09:00:00Z"), acknowledgedAt: null, coverageDecisions: [] },
    ]);
    await expect(getCoverageRecoveryMetrics(manager, new Date("2026-08-01T00:00:00Z"), new Date("2026-09-01T00:00:00Z"))).resolves.toEqual({
      incidentCount: 2, acknowledgedCount: 1, recoveredCount: 1, averageAcknowledgementMinutes: 10, averageRecoveryMinutes: 30,
    });
    expect(mocks.prisma.attendanceIncident.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ companyId: "company-1" }) }));
  });

  it("does not hide unresolved incidents by counting them as zero minutes", async () => {
    mocks.prisma.attendanceIncident.findMany.mockResolvedValue([{ id: "one", detectedAt: new Date(), acknowledgedAt: null, coverageDecisions: [] }]);
    await expect(getCoverageRecoveryMetrics(manager, new Date("2026-08-01T00:00:00Z"), new Date("2026-09-01T00:00:00Z"))).resolves.toEqual(expect.objectContaining({ averageAcknowledgementMinutes: null, averageRecoveryMinutes: null }));
  });
});

describe("pilot onboarding progress", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns company-scoped setup counts without exposing operational records", async () => {
    mocks.prisma.customer.count.mockResolvedValue(1);
    mocks.prisma.worksite.count.mockResolvedValue(2);
    mocks.prisma.employee.count.mockResolvedValue(4);
    mocks.prisma.service.count.mockResolvedValue(3);
    mocks.prisma.plannedShift.count.mockResolvedValue(5);
    mocks.prisma.clockEvent.count.mockResolvedValue(6);
    await expect(getPilotOnboardingProgress(manager)).resolves.toEqual({ customers: 1, worksites: 2, employees: 4, services: 3, shifts: 5, clockEvents: 6 });
    expect(mocks.prisma.customer.count).toHaveBeenCalledWith({ where: expect.objectContaining({ companyId: "company-1" }) });
  });
});

describe("immutable shift completion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.plannedShift.findFirst.mockResolvedValue({
      id: "shift-1", employeeId: "employee-recommended", status: "ACTIVE", serviceId: "service-1",
    });
    mocks.transaction.shiftCompletion.findFirst.mockResolvedValue(null);
    mocks.transaction.shiftCompletion.create.mockResolvedValue({ id: "completion-1" });
    mocks.transaction.plannedShift.update.mockResolvedValue({ id: "shift-1" });
    mocks.transaction.auditLog.create.mockResolvedValue({ id: "audit-1" });
  });

  it("records one attributable completion and preserves an audit trail", async () => {
    await expect(completePlannedShift(employeeActor, "shift-1", { outcome: "COMPLETED" })).resolves.toEqual({ id: "completion-1" });
    expect(mocks.transaction.plannedShift.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ companyId: "company-1", employeeId: "employee-recommended" }),
    }));
    expect(mocks.transaction.shiftCompletion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ companyId: "company-1", shiftId: "shift-1", employeeId: "employee-recommended", outcome: "COMPLETED" }),
    });
    expect(mocks.transaction.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: "shift.completion_recorded" }) });
  });

  it("refuses a second completion record instead of overwriting evidence", async () => {
    mocks.transaction.shiftCompletion.findFirst.mockResolvedValue({ id: "completion-existing" });
    await expect(completePlannedShift(employeeActor, "shift-1", { outcome: "COMPLETED" })).rejects.toMatchObject({ code: "SHIFT_ALREADY_COMPLETED" });
    expect(mocks.transaction.shiftCompletion.create).not.toHaveBeenCalled();
  });

  it("requires an explanation when service delivery was not complete", async () => {
    await expect(completePlannedShift(employeeActor, "shift-1", { outcome: "NOT_COMPLETED" })).rejects.toMatchObject({ name: "ZodError" });
    expect(mocks.transaction.plannedShift.findFirst).not.toHaveBeenCalled();
  });
});

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
      contactEmailOptIn: true,
      contactSmsOptIn: false,
      user: { firstName: "Ana", lastName: "Lopez", email: "ana@example.com", phone: null },
    });
    mocks.transaction.plannedShift.findMany.mockResolvedValue([]);
    mocks.transaction.coverageDecision.create.mockResolvedValue({ id: "decision-1" });
    mocks.transaction.plannedShift.update.mockResolvedValue({ id: "shift-1" });
    mocks.transaction.attendanceIncident.update.mockResolvedValue({ id: "incident-1" });
    mocks.transaction.communicationOutbox.findFirst.mockResolvedValue(null);
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
    expect(mocks.transaction.communicationOutbox.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          companyId: "company-1",
          shiftId: "shift-1",
          recipientEmployeeId: "employee-recommended",
          template: "coverage_confirmed",
          templateVersion: 1,
        }),
      })
    );
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

describe("operational service register", () => {
  const serviceInput = {
    customerId: "customer-1",
    title: "Daily common-area cleaning",
    serviceType: "Cleaning",
    recurrence: "DAILY" as const,
    scheduledStart: "2026-08-08T08:00:00+02:00",
    scheduledEnd: "2026-08-08T10:00:00+02:00",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.customer.findFirst.mockResolvedValue({ id: "customer-1" });
    mocks.transaction.service.create.mockResolvedValue({
      id: "service-1",
      recurrence: "DAILY",
    });
    mocks.transaction.service.findFirst.mockResolvedValue({
      id: "service-1",
      customerId: "customer-1",
      scheduledStart: new Date("2026-08-08T06:00:00Z"),
      scheduledEnd: new Date("2026-08-08T08:00:00Z"),
    });
    mocks.transaction.service.update.mockResolvedValue({ id: "service-1" });
    mocks.transaction.auditLog.create.mockResolvedValue({ id: "audit-1" });
  });

  it("creates a company-scoped service and records the commercial commitment", async () => {
    await expect(createOperationalService(manager, serviceInput)).resolves.toMatchObject({ id: "service-1" });
    expect(mocks.transaction.customer.findFirst).toHaveBeenCalledWith({
      where: { id: "customer-1", companyId: "company-1", status: { not: "ARCHIVED" } },
      select: { id: true },
    });
    expect(mocks.transaction.service.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId: "company-1",
        customerId: "customer-1",
        title: "Daily common-area cleaning",
        status: "SCHEDULED",
      }),
    });
    expect(mocks.transaction.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "operational_service.created", entity: "Service" }),
    });
  });

  it("rejects a service for a customer outside the active company", async () => {
    mocks.transaction.customer.findFirst.mockResolvedValueOnce(null);
    await expect(createOperationalService(manager, serviceInput)).rejects.toMatchObject({
      code: "CUSTOMER_NOT_FOUND",
    });
    expect(mocks.transaction.service.create).not.toHaveBeenCalled();
  });

  it("keeps a service update inside the active company and writes an audit entry", async () => {
    await expect(
      updateOperationalService(manager, "service-1", { status: "IN_PROGRESS" })
    ).resolves.toMatchObject({ id: "service-1" });
    expect(mocks.transaction.service.findFirst).toHaveBeenCalledWith({
      where: { id: "service-1", companyId: "company-1" },
      select: { id: true, customerId: true, scheduledStart: true, scheduledEnd: true },
    });
    expect(mocks.transaction.service.update).toHaveBeenCalledWith({
      where: { id: "service-1" },
      data: expect.objectContaining({ status: "IN_PROGRESS" }),
    });
  });
});

describe("service-linked shift planning", () => {
  const shiftInput = {
    worksiteId: "worksite-1",
    serviceId: "service-1",
    title: "Morning clean",
    scheduledStart: "2026-08-08T08:00:00+02:00",
    scheduledEnd: "2026-08-08T10:00:00+02:00",
    requiredSkills: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.worksite.findFirst.mockResolvedValue({ id: "worksite-1", customerId: "customer-1" });
    mocks.transaction.service.findFirst.mockResolvedValue({ id: "service-1", customerId: "customer-1" });
    mocks.transaction.plannedShift.create.mockResolvedValue({ id: "shift-1" });
    mocks.transaction.auditLog.create.mockResolvedValue({ id: "audit-1" });
  });

  it("rejects a shift when its worksite and service belong to different customers", async () => {
    mocks.transaction.service.findFirst.mockResolvedValueOnce({ id: "service-1", customerId: "customer-2" });
    await expect(createPlannedShift(manager, shiftInput)).rejects.toMatchObject({
      code: "SERVICE_WORKSITE_MISMATCH",
    });
    expect(mocks.transaction.plannedShift.create).not.toHaveBeenCalled();
  });

  it("persists a compatible service link and includes it in the audit trail", async () => {
    await expect(createPlannedShift(manager, shiftInput)).resolves.toMatchObject({ id: "shift-1" });
    expect(mocks.transaction.plannedShift.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ serviceId: "service-1", companyId: "company-1" }),
    });
    expect(mocks.transaction.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "planned_shift.created",
        metadata: expect.objectContaining({ serviceId: "service-1" }),
      }),
    });
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
      templateVersion: 1,
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
        providerReference: "in-app",
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
          templateVersion: 1,
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
        templateVersion: 1,
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
