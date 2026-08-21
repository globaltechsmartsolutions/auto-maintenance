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
    user: { findMany: vi.fn() },
  };
  return { prisma, transaction };
});

vi.mock("@/lib/prisma", () => ({ getPrisma: () => mocks.prisma }));

import {
  createTeammateProfile,
  deleteEmployeeProfile,
  listTeammates,
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

/**
 * Coordinators. Before this existed the only account the product could create
 * was a field worker, so a manager had to be inserted into the database by
 * hand — which is how a connection string ends up in a shared document.
 */
describe("inviting a coordinator", () => {
  const admin: WiaActor = { companyId: "company-1", userId: "user-admin", role: "ADMIN" };
  const invite = {
    supabaseUserId: "supabase-1",
    email: "qa.manager@northstar.example",
    firstName: "QA",
    lastName: "Manager",
    role: "MANAGER" as const,
  };

  beforeEach(() => {
    mocks.transaction.user.create.mockResolvedValue({
      id: "user-new",
      email: invite.email,
      firstName: "QA",
      lastName: "Manager",
      role: "MANAGER",
      status: "ACTIVE",
    });
    mocks.prisma.user.findMany.mockResolvedValue([]);
  });

  it("creates the profile with the requested role, in the acting company", async () => {
    await createTeammateProfile(admin, invite);
    expect(mocks.transaction.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          companyId: "company-1",
          role: "MANAGER",
          supabaseUserId: "supabase-1",
          status: "ACTIVE",
        }),
      })
    );
  });

  it("creates no employee row, because a coordinator is not assignable to a shift", async () => {
    await createTeammateProfile(admin, invite);
    expect(mocks.transaction.employee.create).not.toHaveBeenCalled();
  });

  it("refuses a manager inviting anybody, so the two roles stay distinct", async () => {
    await expect(createTeammateProfile(manager, invite)).rejects.toThrow(/Only an administrator/);
    expect(mocks.transaction.user.create).not.toHaveBeenCalled();
  });

  it("refuses a field worker outright", async () => {
    await expect(createTeammateProfile(worker, invite)).rejects.toThrow(/Only an administrator/);
    expect(mocks.transaction.user.create).not.toHaveBeenCalled();
  });

  it("lets an administrator create another administrator", async () => {
    await expect(
      createTeammateProfile(admin, { ...invite, role: "ADMIN" })
    ).resolves.toBeDefined();
  });

  it("records the invitation, with the role granted, in the audit trail", async () => {
    await createTeammateProfile(admin, invite);
    expect(mocks.transaction.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "teammate.invited",
          entity: "User",
          entityId: "user-new",
          metadata: expect.objectContaining({ role: "MANAGER" }),
        }),
      })
    );
  });

  it("lists coordinators for an administrator, scoped to their company", async () => {
    await listTeammates(admin);
    expect(mocks.prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId: "company-1", role: { in: ["ADMIN", "MANAGER"] } },
      })
    );
  });

  it("does not show the coordinator list to a manager", async () => {
    await expect(listTeammates(manager)).rejects.toThrow(/Only an administrator/);
    expect(mocks.prisma.user.findMany).not.toHaveBeenCalled();
  });
});
