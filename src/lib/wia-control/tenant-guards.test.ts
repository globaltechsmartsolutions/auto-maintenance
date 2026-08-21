import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  customer: { findFirst: vi.fn() },
  user: { findFirst: vi.fn() },
  employee: { count: vi.fn() },
  service: { count: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({
  getPrisma: () => ({
    customer: mocks.customer,
    user: mocks.user,
    employee: mocks.employee,
    service: mocks.service,
  }),
}));

import { ApiRouteError } from "@/lib/http/api-route";
import {
  assertCustomerInCompany,
  assertEmployeesInCompany,
  assertServicesInCompany,
  assertUserInCompany,
} from "@/lib/wia-control/tenant-guards";

/**
 * These guards are the only thing standing between a request body and another
 * company's rows in the secondary modules. Reading is already scoped by the
 * acting company; writing a *reference* is not, so an identifier that arrives
 * in JSON has to be proved to belong here before anything stores it.
 *
 * Every case below is written from the attacker's side: what happens when the
 * identifier is real but belongs to somebody else.
 */

beforeEach(() => {
  vi.clearAllMocks();
  mocks.customer.findFirst.mockResolvedValue(null);
  mocks.user.findFirst.mockResolvedValue(null);
  mocks.employee.count.mockResolvedValue(0);
  mocks.service.count.mockResolvedValue(0);
});

describe("customer ownership", () => {
  it("accepts a customer that belongs to the acting company", async () => {
    mocks.customer.findFirst.mockResolvedValue({ id: "customer-1" });
    await expect(assertCustomerInCompany("company-1", "customer-1")).resolves.toBeUndefined();
  });

  it("looks the customer up by company as well as by id, never by id alone", async () => {
    mocks.customer.findFirst.mockResolvedValue({ id: "customer-1" });
    await assertCustomerInCompany("company-1", "customer-1");
    expect(mocks.customer.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "customer-1", companyId: "company-1" } })
    );
  });

  it("refuses a customer id that exists but belongs to another company", async () => {
    await expect(assertCustomerInCompany("company-1", "customer-of-company-2")).rejects.toThrow(
      ApiRouteError
    );
  });

  it("answers not-found rather than forbidden, so a refusal never confirms the row exists elsewhere", async () => {
    await expect(assertCustomerInCompany("company-1", "customer-of-company-2")).rejects.toMatchObject({
      status: 404,
      code: "CUSTOMER_NOT_FOUND",
      message: expect.stringContaining("does not belong to this workspace"),
    });
  });

  it("asks the database nothing when no customer was named", async () => {
    await expect(assertCustomerInCompany("company-1")).resolves.toBeUndefined();
    await expect(assertCustomerInCompany("company-1", null)).resolves.toBeUndefined();
    await expect(assertCustomerInCompany("company-1", "")).resolves.toBeUndefined();
    expect(mocks.customer.findFirst).not.toHaveBeenCalled();
  });
});

describe("user ownership", () => {
  it("accepts a user of the acting company and scopes the lookup to it", async () => {
    mocks.user.findFirst.mockResolvedValue({ id: "user-1" });
    await assertUserInCompany("company-1", "user-1");
    expect(mocks.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "user-1", companyId: "company-1" } })
    );
  });

  it("refuses a user from another company with the same not-found contract", async () => {
    await expect(assertUserInCompany("company-1", "user-of-company-2")).rejects.toMatchObject({
      status: 404,
      code: "USER_NOT_FOUND",
    });
  });

  it("asks the database nothing when no user was named", async () => {
    await expect(assertUserInCompany("company-1", null)).resolves.toBeUndefined();
    expect(mocks.user.findFirst).not.toHaveBeenCalled();
  });
});

describe("employee ownership", () => {
  it("accepts a set where every employee belongs to the acting company", async () => {
    mocks.employee.count.mockResolvedValue(2);
    await expect(
      assertEmployeesInCompany("company-1", ["employee-1", "employee-2"])
    ).resolves.toBeUndefined();
  });

  it("counts within the company, so a foreign employee cannot make up the total", async () => {
    mocks.employee.count.mockResolvedValue(2);
    await assertEmployeesInCompany("company-1", ["employee-1", "employee-2"]);
    expect(mocks.employee.count).toHaveBeenCalledWith({
      where: { id: { in: ["employee-1", "employee-2"] }, companyId: "company-1" },
    });
  });

  it("refuses the whole set when one member belongs to another company", async () => {
    mocks.employee.count.mockResolvedValue(1);
    await expect(
      assertEmployeesInCompany("company-1", ["employee-1", "employee-of-company-2"])
    ).rejects.toMatchObject({ status: 404, code: "EMPLOYEE_NOT_FOUND" });
  });

  it("compares against the distinct ids, so a repeated id cannot fail a legitimate set", async () => {
    mocks.employee.count.mockResolvedValue(1);
    await expect(
      assertEmployeesInCompany("company-1", ["employee-1", "employee-1"])
    ).resolves.toBeUndefined();
    expect(mocks.employee.count).toHaveBeenCalledWith({
      where: { id: { in: ["employee-1"] }, companyId: "company-1" },
    });
  });

  it("asks the database nothing when the set is empty or absent", async () => {
    await expect(assertEmployeesInCompany("company-1", [])).resolves.toBeUndefined();
    await expect(assertEmployeesInCompany("company-1", null)).resolves.toBeUndefined();
    await expect(assertEmployeesInCompany("company-1")).resolves.toBeUndefined();
    expect(mocks.employee.count).not.toHaveBeenCalled();
  });
});

describe("service ownership", () => {
  it("accepts a set where every service belongs to the acting company", async () => {
    mocks.service.count.mockResolvedValue(2);
    await expect(
      assertServicesInCompany("company-1", ["service-1", "service-2"])
    ).resolves.toBeUndefined();
  });

  it("drops the blanks a request body carries and checks only the real ids", async () => {
    mocks.service.count.mockResolvedValue(1);
    await assertServicesInCompany("company-1", [null, undefined, "service-1", ""]);
    expect(mocks.service.count).toHaveBeenCalledWith({
      where: { id: { in: ["service-1"] }, companyId: "company-1" },
    });
  });

  it("refuses the whole set when one service belongs to another company", async () => {
    mocks.service.count.mockResolvedValue(1);
    await expect(
      assertServicesInCompany("company-1", ["service-1", "service-of-company-2"])
    ).rejects.toMatchObject({ status: 404, code: "SERVICE_NOT_FOUND" });
  });

  it("compares against the distinct ids, so a repeated id cannot fail a legitimate set", async () => {
    mocks.service.count.mockResolvedValue(1);
    await expect(
      assertServicesInCompany("company-1", ["service-1", "service-1"])
    ).resolves.toBeUndefined();
  });

  it("asks the database nothing when nothing survives the filter", async () => {
    await expect(assertServicesInCompany("company-1", [])).resolves.toBeUndefined();
    await expect(assertServicesInCompany("company-1", [null, undefined])).resolves.toBeUndefined();
    expect(mocks.service.count).not.toHaveBeenCalled();
  });
});
