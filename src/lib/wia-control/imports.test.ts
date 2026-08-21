import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const transaction = {
    worksite: { findFirst: vi.fn(), create: vi.fn() },
    service: { findFirst: vi.fn(), create: vi.fn() },
    customer: { findFirst: vi.fn() },
    plannedShift: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() },
    attendanceIncident: { create: vi.fn() },
    user: { create: vi.fn() },
    employee: { create: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  const prisma = {
    $transaction: vi.fn(async (callback: (client: typeof transaction) => unknown) => callback(transaction)),
    auditLog: { findFirst: vi.fn(), create: vi.fn() },
    user: { findFirst: vi.fn() },
  };
  return { prisma, transaction };
});

vi.mock("@/lib/prisma", () => ({ getPrisma: () => mocks.prisma }));

import {
  confirmEmployeeCsvImport,
  confirmOperationalCsvImport,
  type EmployeeLoginProvisioner,
  type WiaActor,
} from "@/lib/wia-control/service";
import { importTemplateCsv, previewCsvImport } from "@/lib/wia-control/csv-import";

const manager: WiaActor = { companyId: "company-1", userId: "user-manager", role: "MANAGER" };
const fieldWorker: WiaActor = { companyId: "company-1", userId: "user-employee", role: "EMPLOYEE", employeeId: "employee-1" };

const worksitesCsv = [
  "name,address,city,timezone",
  "Main office,1 Gran Via,Madrid,Europe/Madrid",
  "North depot,22 Calle Norte,Madrid,Europe/Madrid",
].join("\n");

const servicesCsv = [
  "customer,title,serviceType,recurrence",
  "Acme Facilities,Daily office cleaning,cleaning,WEEKLY",
  "Ghost Client,Night cleaning,cleaning,WEEKLY",
].join("\n");

const employeesCsv = [
  "firstName,lastName,email,position,skills,zones",
  "Ana,Lopez,ana@example.com,Operative,floors;windows,Madrid Centro",
  "Luis,Marin,luis@example.com,Operative,floors,Madrid Sur",
].join("\n");

function auditActions(create: { mock: { calls: unknown[][] } }) {
  return create.mock.calls.map((call) => (call[0] as { data: { action: string } }).data.action);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.auditLog.findFirst.mockResolvedValue(null);
  mocks.transaction.worksite.findFirst.mockResolvedValue(null);
  mocks.transaction.service.findFirst.mockResolvedValue(null);
  mocks.transaction.plannedShift.findFirst.mockResolvedValue(null);
  mocks.transaction.plannedShift.findMany.mockResolvedValue([]);
  mocks.prisma.user.findFirst.mockResolvedValue(null);
});

describe("operational CSV confirmation", () => {
  it("writes every valid row and records one auditable import", async () => {
    mocks.transaction.worksite.create
      .mockResolvedValueOnce({ id: "worksite-1", name: "Main office", city: "Madrid" })
      .mockResolvedValueOnce({ id: "worksite-2", name: "North depot", city: "Madrid" });

    const result = await confirmOperationalCsvImport(manager, "WORKSITES", worksitesCsv);

    expect(result).toEqual(
      expect.objectContaining({ committed: true, replayed: false, totalRows: 2, imported: 2, skipped: 0, failed: 0 })
    );
    expect(result.rows.map((row) => row.reference)).toEqual(["worksite-1", "worksite-2"]);
    expect(mocks.transaction.worksite.create).toHaveBeenCalledTimes(2);
    expect(auditActions(mocks.transaction.auditLog.create)).toContain("csv_import.confirmed");
  });

  it("skips a row that already exists in the workspace instead of duplicating it", async () => {
    mocks.transaction.worksite.findFirst
      .mockResolvedValueOnce({ id: "worksite-existing" })
      .mockResolvedValueOnce(null);
    mocks.transaction.worksite.create.mockResolvedValue({ id: "worksite-2", name: "North depot", city: "Madrid" });

    const result = await confirmOperationalCsvImport(manager, "WORKSITES", worksitesCsv);

    expect(result).toEqual(expect.objectContaining({ committed: true, imported: 1, skipped: 1, failed: 0 }));
    expect(result.rows[0]).toEqual(
      expect.objectContaining({ row: 2, status: "SKIPPED_DUPLICATE", reference: "worksite-existing" })
    );
    expect(mocks.transaction.worksite.create).toHaveBeenCalledTimes(1);
  });

  it("rolls the whole file back when one row cannot be imported", async () => {
    // Only the first row's customer exists; the second names a customer that
    // was never created in this workspace.
    mocks.transaction.customer.findFirst.mockImplementation(
      async ({ where }: { where: { id?: string; name?: { equals: string } } }) => {
        if (where.id) return { id: where.id };
        return where.name?.equals === "Acme Facilities" ? { id: "customer-1" } : null;
      }
    );
    mocks.transaction.service.create.mockResolvedValue({ id: "service-1", recurrence: "WEEKLY" });

    const result = await confirmOperationalCsvImport(manager, "SERVICES", servicesCsv);

    expect(result.committed).toBe(false);
    expect(result.rows).toEqual([
      expect.objectContaining({ row: 2, status: "IMPORTED" }),
      expect.objectContaining({ row: 3, status: "FAILED", code: "CUSTOMER_NOT_FOUND" }),
    ]);
    // The successful write is discarded with the transaction, and no import is
    // marked as confirmed inside it.
    expect(auditActions(mocks.transaction.auditLog.create)).not.toContain("csv_import.confirmed");
    // The rejection itself is recorded outside the rolled-back transaction.
    expect(auditActions(mocks.prisma.auditLog.create)).toEqual(["csv_import.rejected"]);
  });

  it("replays an identical file without writing anything a second time", async () => {
    mocks.prisma.auditLog.findFirst.mockResolvedValue({
      metadata: { rows: [{ row: 2, status: "IMPORTED", message: "Imported." }] },
    });

    const result = await confirmOperationalCsvImport(manager, "WORKSITES", worksitesCsv);

    expect(result).toEqual(expect.objectContaining({ committed: true, replayed: true, imported: 1 }));
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("refuses a file that still has validation issues", async () => {
    await expect(
      confirmOperationalCsvImport(manager, "WORKSITES", "name,address,city\nMain office,,Madrid")
    ).rejects.toThrow(/Correct every CSV validation issue/);
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("refuses a file with more rows than one transaction should carry", async () => {
    const header = "name,address,city";
    const rows = Array.from({ length: 2_001 }, (_, index) => `Site ${index},${index} Main Street,Madrid`);

    await expect(
      confirmOperationalCsvImport(manager, "WORKSITES", [header, ...rows].join("\n"))
    ).rejects.toThrow(/limited to 2000 rows/);
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("refuses an employee file and a field worker", async () => {
    await expect(confirmOperationalCsvImport(manager, "EMPLOYEES", employeesCsv)).rejects.toThrow(
      /invitation workflow/
    );
    await expect(confirmOperationalCsvImport(fieldWorker, "WORKSITES", worksitesCsv)).rejects.toThrow(
      /administrator or manager/
    );
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("employee CSV invitations", () => {
  function provisioner(overrides: Partial<EmployeeLoginProvisioner> = {}): EmployeeLoginProvisioner {
    return {
      invite: vi.fn(async (email: string) => ({ supabaseUserId: `auth-${email}` })),
      revoke: vi.fn(async () => undefined),
      ...overrides,
    };
  }

  it("invites each new address through the invitation workflow", async () => {
    mocks.transaction.user.create.mockResolvedValue({ id: "user-1" });
    mocks.transaction.employee.create
      .mockResolvedValueOnce({ id: "employee-1" })
      .mockResolvedValueOnce({ id: "employee-2" });
    const login = provisioner();

    const result = await confirmEmployeeCsvImport(manager, employeesCsv, login);

    expect(result).toEqual(expect.objectContaining({ committed: true, imported: 2, skipped: 0, failed: 0 }));
    expect(login.invite).toHaveBeenCalledWith("ana@example.com");
    expect(mocks.transaction.employee.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ skills: ["floors", "windows"], zones: ["Madrid Centro"] }),
      })
    );
    expect(auditActions(mocks.prisma.auditLog.create)).toEqual(["csv_import.employees_invited"]);
  });

  it("skips an address that already has an account", async () => {
    mocks.prisma.user.findFirst
      .mockResolvedValueOnce({ id: "user-existing", companyId: "company-1" })
      .mockResolvedValueOnce({ id: "user-other", companyId: "company-2" });
    const login = provisioner();

    const result = await confirmEmployeeCsvImport(manager, employeesCsv, login);

    expect(result).toEqual(expect.objectContaining({ imported: 0, skipped: 2 }));
    expect(result.rows[1].message).toMatch(/already registered/);
    expect(login.invite).not.toHaveBeenCalled();
  });

  it("reports a login it could not revoke, so the retry does not fail unexplained", async () => {
    mocks.transaction.user.create
      .mockRejectedValueOnce(new Error("duplicate key value"))
      .mockResolvedValueOnce({ id: "user-2" });
    mocks.transaction.employee.create.mockResolvedValue({ id: "employee-2" });
    const login = provisioner({
      revoke: vi.fn().mockRejectedValue(new Error("auth service unavailable")),
    });

    const result = await confirmEmployeeCsvImport(manager, employeesCsv, login);

    expect(result.rows[0]).toEqual(
      expect.objectContaining({ row: 2, status: "FAILED", code: "ORPHANED_LOGIN" })
    );
    expect(result.rows[0].message).toMatch(/Support must delete that login/);
    // The rest of the file still processes.
    expect(result.rows[1]).toEqual(expect.objectContaining({ row: 3, status: "IMPORTED" }));
  });

  it("revokes the login it created when the profile cannot be written, and keeps going", async () => {
    mocks.transaction.user.create
      .mockRejectedValueOnce(new Error("duplicate key value violates unique constraint"))
      .mockResolvedValueOnce({ id: "user-2" });
    mocks.transaction.employee.create.mockResolvedValue({ id: "employee-2" });
    const login = provisioner();

    const result = await confirmEmployeeCsvImport(manager, employeesCsv, login);

    expect(login.revoke).toHaveBeenCalledWith("auth-ana@example.com");
    expect(result).toEqual(expect.objectContaining({ committed: true, imported: 1, failed: 1 }));
    expect(result.rows[0]).toEqual(expect.objectContaining({ row: 2, status: "FAILED" }));
    expect(result.rows[1]).toEqual(expect.objectContaining({ row: 3, status: "IMPORTED" }));
  });
});

describe("import templates", () => {
  it("ships a template that its own validator accepts", () => {
    for (const kind of ["EMPLOYEES", "WORKSITES", "SERVICES", "SHIFTS"] as const) {
      const preview = previewCsvImport(kind, importTemplateCsv(kind));
      expect({ kind, invalidRows: preview.invalidRows, issues: preview.issues }).toEqual({
        kind,
        invalidRows: 0,
        issues: [],
      });
    }
  });
});
