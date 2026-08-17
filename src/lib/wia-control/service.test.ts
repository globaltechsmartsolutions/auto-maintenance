import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const transaction = {
    attendanceIncident: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    employee: { findFirst: vi.fn() },
    plannedShift: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    coverageDecision: { create: vi.fn() },
    communicationOutbox: { create: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  const prisma = {
    $transaction: vi.fn(async (callback: (client: typeof transaction) => unknown) =>
      callback(transaction)
    ),
  };
  return { prisma, transaction };
});

vi.mock("@/lib/prisma", () => ({ getPrisma: () => mocks.prisma }));

import { confirmCoverage, type WiaActor } from "@/lib/wia-control/service";

const manager: WiaActor = {
  companyId: "company-1",
  userId: "user-manager",
  role: "MANAGER",
};

const baseInput = {
  shiftId: "shift-1",
  incidentId: "incident-1",
  selectedEmployeeId: "employee-recommended",
  recommendedEmployeeId: "employee-recommended",
  score: 94,
  reasons: ["Available", "Competencias compatibles"],
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
      },
    });
    mocks.transaction.employee.findFirst.mockResolvedValue({ id: "employee-recommended" });
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
    await expect(
      confirmCoverage(manager, {
        ...baseInput,
        selectedEmployeeId: "employee-alternative",
      })
    ).rejects.toMatchObject({ code: "OVERRIDE_REASON_REQUIRED" });
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
