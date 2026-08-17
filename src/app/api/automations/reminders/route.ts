import { NextResponse } from "next/server";
import { companyScope, requireApiRole } from "@/lib/auth/api-auth";
import { hasDatabaseConfig, isDemoMode } from "@/lib/demo-mode";
import { automations } from "@/lib/mock-data";
import { getPrisma } from "@/lib/prisma";
import { apiRoute } from "@/lib/http/api-route";

export const GET = apiRoute(async () => {
  if (isDemoMode()) {
    return NextResponse.json({
      reminders: automations.filter((automation) =>
        ["SERVICE_REMINDER", "SERVICE_CONFIRMATION", "REVIEW_REQUEST"].includes(
          automation.trigger
        )
      ),
    });
  }

  if (!hasDatabaseConfig()) {
    return NextResponse.json({ error: "The database is not configured." }, { status: 503 });
  }

  const auth = await requireApiRole(["SUPER_ADMIN", "ADMIN", "MANAGER"]);
  if (auth.response) return auth.response;

  const reminders = await getPrisma().automationRule.findMany({
    where: {
      ...companyScope(auth.profile),
      isActive: true,
      trigger: {
        in: ["SERVICE_REMINDER", "SERVICE_CONFIRMATION", "REVIEW_REQUEST"],
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({
    reminders,
  });
});
