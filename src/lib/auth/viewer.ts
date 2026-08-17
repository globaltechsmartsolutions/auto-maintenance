import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { isDemoMode } from "@/lib/demo-mode";
import { isRole, type Role } from "@/lib/auth/roles";
import { getPrisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type DashboardViewer = {
  id?: string;
  role: Role;
  userName: string;
  companyId?: string;
  companyName: string;
  crmEnabled: boolean;
};

export const getDashboardViewer = cache(async (): Promise<DashboardViewer> => {
  if (isDemoMode()) {
    const configuredRole = process.env.DEMO_ROLE;
    return {
      role: isRole(configuredRole) ? configuredRole : "ADMIN",
      userName: "Alejandro Martín",
      companyName: "CleanWorks Demo Ltd",
      crmEnabled: process.env.NEXT_PUBLIC_CRM_ENABLED === "true",
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getPrisma().user.findUnique({
    where: { supabaseUserId: user.id },
    include: { company: { select: { id: true, name: true, crmEnabled: true } } },
  });
  if (!profile || !isRole(profile.role)) redirect("/login?error=Profile%20unavailable");

  return {
    id: profile.id,
    role: profile.role,
    userName: `${profile.firstName} ${profile.lastName}`.trim(),
    companyId: profile.company?.id,
    companyName: profile.company?.name ?? "WIA Administration",
    crmEnabled: profile.company?.crmEnabled ?? false,
  };
});
