import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const transaction = {
    plannedShift: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn(), create: vi.fn() },
    worksite: { findFirst: vi.fn() },
    service: { findFirst: vi.fn() },
    employee: { findFirst: vi.fn() },
    attendanceIncident: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  const prisma = {
    $transaction: vi.fn(async (callback: (client: typeof transaction) => unknown) => callback(transaction)),
  };
  return { prisma, transaction };
});

vi.mock("@/lib/prisma", () => ({ getPrisma: () => mocks.prisma }));

import { updatePlannedShift, type WiaActor } from "@/lib/wia-control/service";

const manager: WiaActor = { companyId: "company-1", userId: "user-manager", role: "MANAGER" };
const worker: WiaActor = { companyId: "company-1", userId: "user-worker", role: "EMPLOYEE", employeeId: "employee-1" };

/**
 * Editing a planned shift. The rules that matter: a shift people have already
 * clocked into is no longer editable, a service can only be relinked within the
 * same customer, and an edit must not quietly rewrite coverage history.
 */

function shift(overrides: Record<string, unknown> = {}) {
  return {
    id: "shift-1",
    companyId: "company-1",
    worksiteId: "worksite-1",
    employeeId: "employee-1",
    serviceId: "service-1",
    status: "PLANNED",
    scheduledStart: new Date("2026-08-20T07:00:00Z"),
    scheduledEnd: new Date("2026-08-20T11:00:00Z"),
    clockEvents: [],
    ...overrides,
  };
}

function written() {
  return (mocks.transaction.plannedShift.update.mock.calls[0][0] as { data: Record<string, unknown> })
    .data;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transaction.plannedShift.findFirst.mockResolvedValue(shift());
  mocks.transaction.plannedShift.findMany.mockResolvedValue([]);
  mocks.transaction.plannedShift.update.mockResolvedValue({ id: "shift-1" });
  mocks.transaction.employee.findFirst.mockResolvedValue({ id: "employee-1", fieldStatus: "AVAILABLE" });
  mocks.transaction.service.findFirst.mockResolvedValue({ id: "service-2", customerId: "customer-1" });
  mocks.transaction.worksite.findFirst.mockResolvedValue({ customerId: "customer-1" });
  mocks.transaction.attendanceIncident.findFirst.mockResolvedValue(null);
});

describe("relinking a shift to a service", () => {
  it("actually applies the change instead of accepting and discarding it", async () => {
    await updatePlannedShift(manager, "shift-1", { serviceId: "service-2" });

    expect(written().serviceId).toBe("service-2");
  });

  it("refuses a service belonging to a different customer than the worksite", async () => {
    mocks.transaction.service.findFirst.mockResolvedValue({ id: "service-2", customerId: "customer-2" });

    await expect(updatePlannedShift(manager, "shift-1", { serviceId: "service-2" })).rejects.toThrow(
      /different customer/
    );
    expect(mocks.transaction.plannedShift.update).not.toHaveBeenCalled();
  });

  it("refuses a cancelled or foreign service", async () => {
    mocks.transaction.service.findFirst.mockResolvedValue(null);

    await expect(updatePlannedShift(manager, "shift-1", { serviceId: "service-gone" })).rejects.toThrow(
      /does not belong to the company or is cancelled/
    );
  });

  it("leaves the existing link alone when the edit does not mention it", async () => {
    await updatePlannedShift(manager, "shift-1", { title: "Renamed shift" });

    expect(written().serviceId).toBe("service-1");
    expect(mocks.transaction.service.findFirst).not.toHaveBeenCalled();
  });

  it("allows the link to be cleared deliberately", async () => {
    await updatePlannedShift(manager, "shift-1", { serviceId: null });

    expect(written().serviceId).toBeNull();
  });
});

describe("coverage status through an edit", () => {
  it("records a recovery when somebody is assigned to an uncovered shift", async () => {
    mocks.transaction.plannedShift.findFirst.mockResolvedValue(
      shift({ status: "UNCOVERED", employeeId: null })
    );

    await updatePlannedShift(manager, "shift-1", { employeeId: "employee-1" });

    expect(written().status).toBe("COVERED");
  });

  it("does not turn an already recovered shift back into an ordinary planned one", async () => {
    mocks.transaction.plannedShift.findFirst.mockResolvedValue(shift({ status: "COVERED" }));

    await updatePlannedShift(manager, "shift-1", { title: "Renamed shift" });

    expect(written().status).toBe("COVERED");
  });

  it("returns the shift to the coverage queue when the assignee is removed", async () => {
    await updatePlannedShift(manager, "shift-1", { employeeId: null });

    expect(written().status).toBe("UNCOVERED");
    expect(mocks.transaction.attendanceIncident.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: "MISSING_CLOCK_IN" }) })
    );
  });

  it("reopens the existing uncovered incident rather than creating a second one", async () => {
    mocks.transaction.attendanceIncident.findFirst.mockResolvedValue({ id: "incident-1" });

    await updatePlannedShift(manager, "shift-1", { employeeId: null });

    expect(mocks.transaction.attendanceIncident.update).toHaveBeenCalledWith({
      where: { id: "incident-1" },
      data: { status: "OPEN", resolvedAt: null },
    });
    expect(mocks.transaction.attendanceIncident.create).not.toHaveBeenCalled();
  });

  it("says why an incident closed as a side effect of the edit", async () => {
    mocks.transaction.plannedShift.findFirst.mockResolvedValue(
      shift({ status: "UNCOVERED", employeeId: null })
    );

    await updatePlannedShift(manager, "shift-1", { employeeId: "employee-1" });

    expect(mocks.transaction.attendanceIncident.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "RESOLVED",
          resolutionNotes: expect.stringContaining("Closed automatically"),
        }),
      })
    );
  });
});

describe("what an edit may not do", () => {
  it("refuses to touch a shift people have already clocked into, except to cancel it", async () => {
    mocks.transaction.plannedShift.findFirst.mockResolvedValue(
      shift({ status: "ACTIVE", clockEvents: [{ id: "event-1" }] })
    );

    await expect(updatePlannedShift(manager, "shift-1", { title: "Renamed" })).rejects.toThrow(
      /can only be cancelled administratively/
    );
    await expect(
      updatePlannedShift(manager, "shift-1", { status: "CANCELLED" })
    ).resolves.toBeDefined();
  });

  it("refuses to modify a completed shift at all", async () => {
    mocks.transaction.plannedShift.findFirst.mockResolvedValue(shift({ status: "COMPLETED" }));

    await expect(updatePlannedShift(manager, "shift-1", { title: "Renamed" })).rejects.toThrow(
      /completed shift cannot be modified/
    );
  });

  it("refuses an end before the start, and an unavailable person", async () => {
    await expect(
      updatePlannedShift(manager, "shift-1", { scheduledEnd: "2026-08-20T06:00:00.000Z" })
    ).rejects.toThrow(/end time must be later/);

    mocks.transaction.employee.findFirst.mockResolvedValue({ id: "employee-1", fieldStatus: "VACATION" });
    await expect(
      updatePlannedShift(manager, "shift-1", { employeeId: "employee-1" })
    ).rejects.toThrow(/person is unavailable/);
  });

  it("refuses an assignment that overlaps another shift of the same person", async () => {
    mocks.transaction.plannedShift.findMany.mockResolvedValue([
      {
        scheduledStart: new Date("2026-08-20T08:00:00Z"),
        scheduledEnd: new Date("2026-08-20T12:00:00Z"),
      },
    ]);

    await expect(
      updatePlannedShift(manager, "shift-1", { employeeId: "employee-1" })
    ).rejects.toThrow(/already has another shift/);
  });

  it("is not available to a field worker", async () => {
    await expect(updatePlannedShift(worker, "shift-1", { title: "Renamed" })).rejects.toThrow(
      /cannot modify shifts/
    );
  });
});
