import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const transaction = {
    customer: { findFirst: vi.fn(), create: vi.fn() },
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
  createOperationalCustomer,
  createWorksite,
  getOperationalServiceDetail,
  listOperationalCustomers,
  listOperationalServices,
  updateOperationalService,
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
  mocks.transaction.worksite.findFirst.mockResolvedValue({
    id: "worksite-1",
    isActive: true,
    customerId: "customer-1",
  });
  mocks.transaction.worksite.update.mockResolvedValue({ id: "worksite-1" });
  mocks.transaction.plannedShift.count.mockResolvedValue(0);
  mocks.transaction.service.findFirst.mockResolvedValue({
    id: "service-1",
    customerId: "customer-1",
    scheduledStart: null,
    scheduledEnd: null,
  });
  mocks.transaction.service.update.mockResolvedValue({ id: "service-1" });
});

describe("creating a worksite", () => {
  it("stamps the company and audits the creation", async () => {
    await createWorksite(manager, worksiteInput);

    expect(mocks.transaction.worksite.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ companyId: "company-1", name: "Redwood Central" }),
      })
    );
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

describe("preserving worksite-to-customer history", () => {
  it("refuses to move a worksite to another customer when linked shifts belong to the original one", async () => {
    mocks.transaction.plannedShift.count.mockResolvedValue(1);

    await expect(updateWorksite(manager, "worksite-1", { customerId: "customer-2" })).rejects.toMatchObject({
      code: "WORKSITE_CUSTOMER_CHANGE_CONFLICT",
    });

    expect(mocks.transaction.plannedShift.count).toHaveBeenCalledWith({
      where: {
        companyId: "company-1",
        worksiteId: "worksite-1",
        service: { customerId: { not: "customer-2" } },
      },
    });
    expect(mocks.transaction.worksite.update).not.toHaveBeenCalled();
  });

  it("refuses to move a service to another customer when its shifts use the original customer's worksites", async () => {
    mocks.transaction.plannedShift.count.mockResolvedValue(1);

    await expect(updateOperationalService(manager, "service-1", { customerId: "customer-2" })).rejects.toMatchObject({
      code: "SERVICE_CUSTOMER_CHANGE_CONFLICT",
    });

    expect(mocks.transaction.plannedShift.count).toHaveBeenCalledWith({
      where: {
        companyId: "company-1",
        serviceId: "service-1",
        worksite: { customerId: { not: "customer-2" } },
      },
    });
    expect(mocks.transaction.service.update).not.toHaveBeenCalled();
  });
});

describe("what leaves the server", () => {
  it("never returns the QR credential column when a worksite is created or edited", async () => {
    await createWorksite(manager, worksiteInput);
    await updateWorksite(manager, "worksite-1", { name: "Renamed" });

    const created = mocks.transaction.worksite.create.mock.calls[0][0] as {
      select: Record<string, unknown>;
    };
    const updated = mocks.transaction.worksite.update.mock.calls[0][0] as {
      select: Record<string, unknown>;
    };
    expect(Object.keys(created.select)).not.toContain("qrSecretHash");
    expect(Object.keys(updated.select)).not.toContain("qrSecretHash");
    // Still returns what a client legitimately needs.
    expect(Object.keys(created.select)).toEqual(expect.arrayContaining(["name", "address", "radiusMeters"]));
  });

  it("refuses to attach a worksite to an archived customer, on create and on edit", async () => {
    mocks.transaction.customer.findFirst.mockResolvedValue(null);

    await expect(
      createWorksite(manager, { ...worksiteInput, customerId: "customer-archived" })
    ).rejects.toThrow(/does not belong to the company or is archived/);
    await expect(
      updateWorksite(manager, "worksite-1", { customerId: "customer-archived" })
    ).rejects.toThrow(/does not belong to the company or is archived/);

    for (const call of mocks.transaction.customer.findFirst.mock.calls) {
      expect((call[0] as { where: { status?: unknown } }).where.status).toEqual({ not: "ARCHIVED" });
    }
  });

  it("rejects an attempt to detach a worksite from its customer, rather than skipping the conflict guard", async () => {
    // The update schema does not accept null here. That matters: a nullable
    // field would slip past the `if (payload.customerId)` guard below it and
    // detach a worksite whose shifts still serve the original customer.
    await expect(updateWorksite(manager, "worksite-1", { customerId: null })).rejects.toThrow();
    expect(mocks.transaction.worksite.update).not.toHaveBeenCalled();
  });

  it("scopes the nested shifts of a service timeline to the caller's company", async () => {
    mocks.prisma.service.findFirst.mockResolvedValue({ id: "service-1", plannedShifts: [] });

    await getOperationalServiceDetail(manager, "service-1");

    const query = mocks.prisma.service.findFirst.mock.calls[0][0] as {
      include: { plannedShifts: { where?: { companyId?: string } } };
    };
    expect(query.include.plannedShifts.where).toEqual({ companyId: "company-1" });
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

    const call = mocks.prisma.worksite.findMany.mock.calls[0][0] as {
      where: Record<string, unknown>;
      select: Record<string, unknown>;
    };
    const fields = Object.keys(call.select);
    expect(fields).toEqual(expect.arrayContaining(["name", "address", "city", "radiusMeters"]));
    expect(fields).not.toContain("_count");
    expect(fields).not.toContain("latitude");
    expect(call.where).toEqual(
      expect.objectContaining({
        plannedShifts: { some: { employeeId: "employee-1" } },
      })
    );
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

/**
 * Recording a client is the first thing anybody does in a new workspace and
 * the thing every other record hangs off. Until this existed, a worksite could
 * not be linked to anyone and no service could be created at all.
 */
describe("recording a client", () => {
  const input = { name: "Redwood Offices Ltd.", city: "Madrid" };

  beforeEach(() => {
    mocks.transaction.customer.findFirst.mockResolvedValue(null);
    mocks.transaction.customer.create.mockResolvedValue({
      id: "customer-1",
      name: "Redwood Offices Ltd.",
      city: "Madrid",
      type: "BUSINESS",
      status: "ACTIVE",
    });
  });

  it("stores the client against the acting company, never a requested one", async () => {
    await createOperationalCustomer(manager, { ...input, companyId: "company-2" });
    expect(mocks.transaction.customer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ companyId: "company-1", name: "Redwood Offices Ltd." }),
      })
    );
  });

  it("needs nothing but a name, so a pilot is not blocked on billing details", async () => {
    await expect(createOperationalCustomer(manager, { name: "Redwood Offices Ltd." })).resolves.toMatchObject({
      id: "customer-1",
    });
  });

  it("stores an untouched optional field as absent rather than as an empty string", async () => {
    await createOperationalCustomer(manager, { ...input, email: "", phone: "" });
    const { data } = mocks.transaction.customer.create.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(data.email).toBeNull();
    expect(data.phone).toBeNull();
  });

  it("refuses a second client with the same name, whatever the casing", async () => {
    mocks.transaction.customer.findFirst.mockResolvedValue({ id: "customer-existing" });
    await expect(createOperationalCustomer(manager, { name: "redwood offices ltd." })).rejects.toMatchObject({
      code: "CUSTOMER_ALREADY_EXISTS",
    });
    expect(mocks.transaction.customer.create).not.toHaveBeenCalled();
  });

  it("looks for that duplicate within the company only", async () => {
    await createOperationalCustomer(manager, input);
    expect(mocks.transaction.customer.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId: "company-1" }),
      })
    );
  });

  it("refuses a field worker, who has no reason to edit the client register", async () => {
    await expect(createOperationalCustomer(worker, input)).rejects.toThrow(/cannot create customers/);
    expect(mocks.transaction.customer.create).not.toHaveBeenCalled();
  });

  it("records the creation in the audit trail", async () => {
    await createOperationalCustomer(manager, input);
    expect(mocks.transaction.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "customer.created",
          entity: "Customer",
          entityId: "customer-1",
          userId: "user-manager",
        }),
      })
    );
  });

  it("refuses a name too short to identify anybody", async () => {
    await expect(createOperationalCustomer(manager, { name: "R" })).rejects.toMatchObject({
      name: "ZodError",
    });
  });
});
