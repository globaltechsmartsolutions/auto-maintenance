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
  const url = new URL(request.url);
  const context = await requireWiaApiContext(
    ["SUPER_ADMIN", "ADMIN", "MANAGER"],
    url.searchParams.get("companyId") ?? undefined
  );
  if (context.response) return context.response;
  const query = querySchema.parse(Object.fromEntries(url.searchParams));
  if (context.demo) return Response.json({ metrics: { incidentCount: 0, acknowledgedCount: 0, recoveredCount: 0, unresolvedCount: 0, oldestUnresolvedMinutes: null, averageAcknowledgementMinutes: null, averageRecoveryMinutes: null } });
  return Response.json({ metrics: await getCoverageRecoveryMetrics(context.actor, new Date(query.from), new Date(query.to)) });
});
