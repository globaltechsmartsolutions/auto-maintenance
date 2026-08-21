import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const transaction = {
    customer: { findFirst: vi.fn() },
    worksite: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    plannedShift: { count: vi.fn() },
    service: { findFirst: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  const prisma = {
    $transaction: vi.fn(async (callback: (client: typeof transaction) => unknown) => callback(transaction)),
    worksite: { findMany: vi.fn() },
    service: { findMany: vi.fn(), findFirst: vi.fn() },
    customer: { findMany: vi.fn() },
  };
  return { prisma, transaction };
});

vi.mock("@/lib/prisma", () => ({ getPrisma: () => mocks.prisma }));

import {
  createWorksite,
  getOperationalServiceDetail,
  listOperationalCustomers,
  listOperationalServices,
  listWorksites,
  updateWorksite,
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
 * The commercial commitment: customer, worksite, service. What matters here is
 * that a record cannot be attached to another company's customer, that a
 * worksite with live shifts cannot quietly disappear, and that a field worker
 * never receives the company register through a side door.
 */

const worksiteInput = {
  name: "Redwood Central",
  address: "12 Redwood Avenue",
  city: "Madrid",
};

function selectedFields(call: unknown) {
  return Object.keys((call as { select: Record<string, unknown> }).select);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.worksite.findMany.mockResolvedValue([]);
  mocks.prisma.service.findMany.mockResolvedValue([]);
  mocks.transaction.customer.findFirst.mockResolvedValue({ id: "customer-1" });
  mocks.transaction.worksite.create.mockResolvedValue({
    id: "worksite-1",
    name: "Redwood Central",
    city: "Madrid",
  });
  mocks.transaction.worksite.findFirst.mockResolvedValue({ id: "worksite-1", isActive: true });
  mocks.transaction.worksite.update.mockResolvedValue({ id: "worksite-1" });
  mocks.transaction.plannedShift.count.mockResolvedValue(0);
});

describe("creating a worksite", () => {
  it("stamps the company and audits the creation", async () => {
    await createWorksite(manager, worksiteInput);

    expect(mocks.transaction.worksite.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ companyId: "company-1", name: "Redwood Central" }),
    });
    expect(mocks.transaction.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "worksite.created" }) })
    );
  });

  it("refuses a customer from another company", async () => {
    mocks.transaction.customer.findFirst.mockResolvedValue(null);

    await expect(
      createWorksite(manager, { ...worksiteInput, customerId: "customer-elsewhere" })
    ).rejects.toThrow(/does not belong to the company/);
    expect(mocks.transaction.worksite.create).not.toHaveBeenCalled();
  });

  it("is not available to a field worker", async () => {
    await expect(createWorksite(worker, worksiteInput)).rejects.toThrow(/cannot create worksites/);
  });

  it("ignores any field the schema does not declare, so a client cannot set one", async () => {
    await createWorksite(manager, { ...worksiteInput, companyId: "company-2", isActive: false });

    const written = (mocks.transaction.worksite.create.mock.calls[0][0] as { data: Record<string, unknown> })
      .data;
    expect(written.companyId).toBe("company-1");
    expect(written).not.toHaveProperty("isActive");
  });
});

describe("archiving a worksite", () => {
  it("refuses while shifts are still open there", async () => {
    mocks.transaction.plannedShift.count.mockResolvedValue(2);

    await expect(updateWorksite(manager, "worksite-1", { isActive: false })).rejects.toThrow(
      /Cancel or reassign open shifts/
    );
    expect(mocks.transaction.worksite.update).not.toHaveBeenCalled();
  });

  it("archives once nothing is open, and records it as an archival", async () => {
    await updateWorksite(manager, "worksite-1", { isActive: false });

    expect(mocks.transaction.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "worksite.archived" }) })
    );
  });
});

describe("what each role receives", () => {
  it("never selects the QR credential column, for anybody", async () => {
    await listWorksites(manager);
    await listWorksites(worker);

    for (const call of mocks.prisma.worksite.findMany.mock.calls) {
      expect(selectedFields(call[0])).not.toContain("qrSecretHash");
    }
  });

  it("gives a coordinator the coordinates and workload counts", async () => {
    await listWorksites(manager);

    const fields = selectedFields(mocks.prisma.worksite.findMany.mock.calls[0][0]);
    expect(fields).toEqual(expect.arrayContaining(["latitude", "longitude", "_count", "name"]));
  });

  it("gives a field worker where to go, and nothing about company workload", async () => {
    await listWorksites(worker);

    const fields = selectedFields(mocks.prisma.worksite.findMany.mock.calls[0][0]);
    expect(fields).toEqual(expect.arrayContaining(["name", "address", "city", "radiusMeters"]));
    expect(fields).not.toContain("_count");
    expect(fields).not.toContain("latitude");
  });

  it("shows a field worker only their own shifts inside a service", async () => {
    await listOperationalServices(worker);

    const query = mocks.prisma.service.findMany.mock.calls[0][0] as {
      where: Record<string, unknown>;
      include: { plannedShifts: { where?: { employeeId: string } } };
    };
    expect(query.where).toEqual(
      expect.objectContaining({
        plannedShifts: { some: { employeeId: "employee-1" } },
      })
    );
    expect(query.include.plannedShifts.where).toEqual({ employeeId: "employee-1" });
  });

  it("does not filter a coordinator's view of the same register", async () => {
    await listOperationalServices(manager);

    const query = mocks.prisma.service.findMany.mock.calls[0][0] as {
      include: { plannedShifts: { where?: unknown } };
    };
    expect(query.include.plannedShifts.where).toBeUndefined();
  });

  it("keeps the customer list and the service evidence timeline away from field workers", async () => {
    await expect(listOperationalCustomers(worker)).rejects.toThrow(/cannot view customers/);
    await expect(getOperationalServiceDetail(worker, "service-1")).rejects.toThrow(
      /cannot view the company service register/
    );
    expect(mocks.prisma.customer.findMany).not.toHaveBeenCalled();
    expect(mocks.prisma.service.findFirst).not.toHaveBeenCalled();
  });
});
