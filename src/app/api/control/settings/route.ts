import { z } from "zod";
import { apiRoute } from "@/lib/http/api-route";
import { companySettingsSchema } from "@/lib/wia-control/domain";
import { requireWiaApiContext, requestedCompanyIdFromBody } from "@/lib/wia-control/api-context";
import { getCompanySettings, updateCompanySettings } from "@/lib/wia-control/service";

const requestSchema = companySettingsSchema.extend({
  companyId: z.string().min(1).optional(),
});

export const GET = apiRoute(async (request: Request) => {
  const companyId = new URL(request.url).searchParams.get("companyId") ?? undefined;
  const context = await requireWiaApiContext(["SUPER_ADMIN", "ADMIN"], companyId);
  if (context.response) return context.response;
  if (context.demo) {
    return Response.json({
      settings: {
        name: "CleanWorks Demo Ltd",
        timezone: "Europe/Madrid",
        clockRetentionYears: 4,
        crmEnabled: process.env.NEXT_PUBLIC_CRM_ENABLED === "true",
      },
    });
  }
  return Response.json({ settings: await getCompanySettings(context.actor) });
});

export const PATCH = apiRoute(async (request: Request) => {
  const rawPayload = await request.json();
  const context = await requireWiaApiContext(
    ["SUPER_ADMIN", "ADMIN"],
    requestedCompanyIdFromBody(rawPayload)
  );
  if (context.response) return context.response;
  const payload = requestSchema.parse(rawPayload);
  if (context.demo) return Response.json({ settings: payload });

  return Response.json({ settings: await updateCompanySettings(context.actor, payload) });
});
