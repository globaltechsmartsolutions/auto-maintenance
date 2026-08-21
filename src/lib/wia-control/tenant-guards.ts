import "server-only";

import { getPrisma } from "@/lib/prisma";
import { ApiRouteError } from "@/lib/http/api-route";

/**
 * Ownership checks for identifiers that arrive in a request body.
 *
 * The operational core resolves the acting company server-side and scopes every
 * query to it, which stops a caller *reading* another company. It does not, on
 * its own, stop a caller *writing* a reference to another company's row: a
 * `customerId` in a request body is just a string, and a record created under
 * company A pointing at company B's customer will happily return B's data to A
 * on the next read.
 *
 * These helpers exist so the secondary modules — CRM, invoicing, booking — hold
 * the same line as the core.
 */

function notFound(what: string): never {
  throw new ApiRouteError(
    404,
    `${what.toUpperCase()}_NOT_FOUND`,
    `That ${what} does not belong to this workspace.`
  );
}

export async function assertCustomerInCompany(companyId: string, customerId?: string | null) {
  if (!customerId) return;
  const customer = await getPrisma().customer.findFirst({
    where: { id: customerId, companyId },
    select: { id: true },
  });
  if (!customer) notFound("customer");
}

export async function assertUserInCompany(companyId: string, userId?: string | null) {
  if (!userId) return;
  const user = await getPrisma().user.findFirst({
    where: { id: userId, companyId },
    select: { id: true },
  });
  if (!user) notFound("user");
}

export async function assertEmployeesInCompany(companyId: string, employeeIds?: string[] | null) {
  if (!employeeIds?.length) return;
  const unique = [...new Set(employeeIds)];
  const found = await getPrisma().employee.count({
    where: { id: { in: unique }, companyId },
  });
  if (found !== unique.length) notFound("employee");
}

export async function assertServicesInCompany(companyId: string, serviceIds: Array<string | null | undefined>) {
  const unique = [...new Set(serviceIds.filter((id): id is string => Boolean(id)))];
  if (!unique.length) return;
  const found = await getPrisma().service.count({
    where: { id: { in: unique }, companyId },
  });
  if (found !== unique.length) notFound("service");
}
