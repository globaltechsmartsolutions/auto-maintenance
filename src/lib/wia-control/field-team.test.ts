import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const transaction = {
    employee: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
    user: { update: vi.fn(), create: vi.fn() },
    plannedShift: { findFirst: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
    attendanceIncident: { createMany: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  const prisma = {
    $transaction: vi.fn(async (callback: (client: typeof transaction) => unknown) => callback(transaction)),
    employee: { findMany: vi.fn() },
  };
  return { prisma, transaction };
});

vi.mock("@/lib/prisma", () => ({ getPrisma: () => mocks.prisma }));

import {
  deleteEmployeeProfile,
  listEmployees,
  updateEmployeeProfile,
  type WiaActor,
} from "@/lib/wia-control/service";

const manager: WiaActor = { companyId: "company-1", userId: "user-manager", role: "MANAGER" };
const worker: WiaActor = {
  companyId: "company-1",
  userId: "user-worker",
  role: "EMPLOYEE",
  employeeId: "employee-1",
};

/**
 * The field team. Two rules matter most: a worker sees the operational half of
 * their own record and nothing a coordinator writes about them, and taking
 * somebody out of the field has exactly one door.
 */

function query(index = 0) {
  return mocks.prisma.employee.findMany.mock.calls[index][0] as {
    where: Record<string, unknown>;
    select: Record<string, unknown>;
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.employee.findMany.mockResolvedValue([]);
  mocks.transaction.employee.findFirst.mockResolvedValue({
    id: "employee-1",
    userId: "user-worker",
    user: { email: "ana@example.com", supabaseUserId: "auth-1" },
  });
  mocks.transaction.plannedShift.findFirst.mockResolvedValue(null);
  mocks.transaction.plannedShift.findMany.mockResolvedValue([]);
  mocks.transaction.employee.update.mockResolvedValue({ id: "employee-1" });
  mocks.transaction.user.update.mockResolvedValue({ id: "user-worker" });
});

describe("what a worker may read about themselves", () => {
  it("returns their own row only, without the notes a coordinator writes about them", async () => {
    await listEmployees(worker);

    expect(query().where).toEqual({ companyId: "company-1", id: "employee-1" });
    const fields = Object.keys(query().select);
    expect(fields).toEqual(expect.arrayContaining(["skills", "zones", "availability"]));
    expect(fields).not.toContain("internalNotes");
    expect(fields).not.toContain("performanceScore");
    expect(fields).not.toContain("jobs");
  });

  it("gives a coordinator the whole team with the coordination fields", async () => {
    await listEmployees(manager);

    expect(query().where).toEqual({ companyId: "company-1" });
    expect(Object.keys(query().select)).toEqual(
      expect.arrayContaining(["internalNotes", "performanceScore", "jobs"])
    );
  });

  it("never widens to the whole team when a worker has no employee profile", async () => {
    await listEmployees({ ...worker, employeeId: undefined });

    expect(query().where).toEqual({ companyId: "company-1", id: "__missing_employee__" });
  });
});

describe("taking somebody out of the field team", () => {
  const futureShifts = [
    { id: "shift-1", worksiteId: "worksite-1" },
    { id: "shift-2", worksiteId: "worksite-2" },
  ];

  it("refuses while a shift of theirs is actually running", async () => {
    mocks.transaction.plannedShift.findFirst.mockResolvedValue({ id: "shift-live" });

    await expect(deleteEmployeeProfile(manager, "employee-1")).rejects.toThrow(
      /active shift in progress/
    );
    expect(mocks.transaction.employee.update).not.toHaveBeenCalled();
  });

  it("releases every shift that has not actually started and opens an uncovered incident for each", async () => {
    mocks.transaction.plannedShift.findMany.mockResolvedValue(futureShifts);

    const result = await deleteEmployeeProfile(manager, "employee-1");

    expect(mocks.transaction.plannedShift.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          employeeId: "employee-1",
          status: { notIn: ["CANCELLED", "COMPLETED", "ACTIVE", "PAUSED"] },
        }),
      })
    );
    expect(mocks.transaction.plannedShift.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["shift-1", "shift-2"] } },
      data: { employeeId: null, status: "UNCOVERED" },
    });
    expect(mocks.transaction.attendanceIncident.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true })
    );
    expect(result).toEqual({ id: "employee-1", releasedShifts: 2 });
  });

  it("disables the login and records how many shifts were released", async () => {
    mocks.transaction.plannedShift.findMany.mockResolvedValue(futureShifts);

    await deleteEmployeeProfile(manager, "employee-1");

    expect(mocks.transaction.employee.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { fieldStatus: "INACTIVE" } })
    );
    expect(mocks.transaction.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "DISABLED" } })
    );
    expect(mocks.transaction.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "employee.deactivated",
          metadata: expect.objectContaining({ releasedShifts: 2 }),
        }),
      })
    );
  });

  it("touches no shift when there is nothing ahead of them", async () => {
    await deleteEmployeeProfile(manager, "employee-1");

    expect(mocks.transaction.plannedShift.updateMany).not.toHaveBeenCalled();
    expect(mocks.transaction.attendanceIncident.createMany).not.toHaveBeenCalled();
  });

  it("refuses the profile form as a second, weaker way out of the field team", async () => {
    await expect(
      updateEmployeeProfile(manager, "employee-1", { fieldStatus: "INACTIVE" })
    ).rejects.toThrow(/through deactivation/);
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("still allows the ordinary field statuses through the profile form", async () => {
    mocks.transaction.employee.update.mockResolvedValue({
      id: "employee-1",
      fieldStatus: "VACATION",
      user: { firstName: "Ana", lastName: "Lopez", email: "ana@example.com" },
    });

    await expect(
      updateEmployeeProfile(manager, "employee-1", { fieldStatus: "VACATION" })
    ).resolves.toBeDefined();
  });

  it("is not something a field worker can do to anyone", async () => {
    await expect(deleteEmployeeProfile(worker, "employee-2")).rejects.toThrow(
      /cannot remove other employees/
    );
    await expect(updateEmployeeProfile(worker, "employee-2", { skills: ["x"] })).rejects.toThrow(
      /cannot edit employee profiles/
    );
  });
});
