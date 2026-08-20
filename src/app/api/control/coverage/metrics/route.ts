import { z } from "zod";
import { apiRoute } from "@/lib/http/api-route";
import { requireWiaApiContext } from "@/lib/wia-control/api-context";
import { getCoverageRecoveryMetrics } from "@/lib/wia-control/service";

const querySchema = z.object({
  companyId: z.string().min(1).optional(),
  from: z.string().datetime({ offset: true }),
  to: z.string().datetime({ offset: true }),
});

export const GET = apiRoute(async (request: Request) => {
  const query = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  const context = await requireWiaApiContext(["SUPER_ADMIN", "ADMIN", "MANAGER"], query.companyId);
  if (context.response) return context.response;
  if (context.demo) return Response.json({ metrics: { incidentCount: 0, acknowledgedCount: 0, recoveredCount: 0, averageAcknowledgementMinutes: null, averageRecoveryMinutes: null } });
  return Response.json({ metrics: await getCoverageRecoveryMetrics(context.actor, new Date(query.from), new Date(query.to)) });
});
