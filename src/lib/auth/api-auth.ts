import { NextResponse } from "next/server";
import type { Role } from "@/lib/auth/roles";
import { isRole } from "@/lib/auth/roles";
import { hasSupabaseConfig, isDemoMode } from "@/lib/demo-mode";
import { getPrisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ApiProfile = {
  id: string;
  companyId: string | null;
  role: Role;
};

export type ApiAuthResult =
  | {
      profile: ApiProfile | null;
      response?: never;
    }
  | {
      profile?: never;
      response: NextResponse;
    };

export async function requireApiRole(allowedRoles: Role[]): Promise<ApiAuthResult> {
  if (isDemoMode() || !hasSupabaseConfig()) {
    return { profile: null };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const profile = await getPrisma().user.findUnique({
    where: { supabaseUserId: user.id },
    select: {
      id: true,
      companyId: true,
      role: true,
    },
  });

  if (!profile || !isRole(profile.role)) {
    return {
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  if (!allowedRoles.includes(profile.role)) {
    return {
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { profile };
}

export function companyScope(profile: ApiProfile | null) {
  if (!profile || profile.role === "SUPER_ADMIN") {
    return {};
  }

  return { companyId: profile.companyId ?? "__missing_company__" };
}

export function resolveCompanyId(
  profile: ApiProfile | null,
  requestedCompanyId: string
) {
  if (!profile || profile.role === "SUPER_ADMIN") {
    return requestedCompanyId;
  }

  return profile.companyId ?? requestedCompanyId;
}
