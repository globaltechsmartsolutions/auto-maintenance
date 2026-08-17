import "server-only";

import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api-auth";
import type { Role } from "@/lib/auth/roles";
import { hasDatabaseConfig, isDemoMode } from "@/lib/demo-mode";
import { resolveWiaActor } from "@/lib/wia-control/api-actor";
import type { WiaActor } from "@/lib/wia-control/service";

export type WiaApiContext =
  | { actor: WiaActor; demo: boolean; response?: never }
  | { actor?: never; demo?: never; response: NextResponse };

export async function requireWiaApiContext(
  allowedRoles: Role[],
  requestedCompanyId?: string
): Promise<WiaApiContext> {
  if (!isDemoMode() && !hasDatabaseConfig()) {
    return {
      response: NextResponse.json(
        { error: "The database is not configured.", code: "DATABASE_UNAVAILABLE" },
        { status: 503 }
      ),
    };
  }

  const auth = await requireApiRole(allowedRoles);
  if (auth.response) return { response: auth.response };

  return {
    actor: await resolveWiaActor(auth.profile, requestedCompanyId),
    demo: isDemoMode(),
  };
}
