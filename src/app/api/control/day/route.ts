import { z } from "zod";
import { apiRoute } from "@/lib/http/api-route";
import { requireWiaApiContext } from "@/lib/wia-control/api-context";
import { getCompanyTimezone, listControlDay } from "@/lib/wia-control/service";

const querySchema = z.object({
  date: z.string().date(),
  companyId: z.string().min(1).optional(),
});

export const GET = apiRoute(async (request: Request) => {
  const url = new URL(request.url);
  const context = await requireWiaApiContext(
    ["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE"],
    url.searchParams.get("companyId") ?? undefined
  );
  if (context.response) return context.response;
  const query = querySchema.parse({
    date: url.searchParams.get("date"),
    companyId: url.searchParams.get("companyId") ?? undefined,
  });

  if (context.demo) {
    return Response.json({
      mode: "demo",
      date: query.date,
      shifts: [],
      companyTimezone: "Europe/Madrid",
    });
  }

  const [shifts, companyTimezone] = await Promise.all([
    listControlDay(context.actor, query.date),
    getCompanyTimezone(context.actor.companyId),
  ]);
  return Response.json({ mode: "database", date: query.date, shifts, companyTimezone });
});
