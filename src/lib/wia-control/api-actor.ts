import "server-only";

import type { ApiProfile } from "@/lib/auth/api-auth";
import { getPrisma } from "@/lib/prisma";
import { WiaDomainError } from "@/lib/wia-control/domain";
import type { WiaActor } from "@/lib/wia-control/service";

export async function resolveWiaActor(
  profile: ApiProfile | null,
  requestedCompanyId?: string
): Promise<WiaActor> {
  if (!profile) {
    return { companyId: "demo-company", role: "ADMIN", userId: "demo-user" };
  }

  const companyId =
    profile.role === "SUPER_ADMIN" ? requestedCompanyId : profile.companyId ?? undefined;
  if (!companyId) {
    throw new WiaDomainError("COMPANY_REQUIRED", "Select a company to continue.");
  }

  const employee = await getPrisma().employee.findUnique({
    where: { userId: profile.id },
    select: { id: true },
  });

  return {
    companyId,
    userId: profile.id,
    employeeId: employee?.id,
    role: profile.role,
  };
}
