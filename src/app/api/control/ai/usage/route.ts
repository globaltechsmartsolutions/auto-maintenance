import { apiRoute } from "@/lib/http/api-route";
import { requireWiaApiContext } from "@/lib/wia-control/api-context";
import { getAiUsageSummary } from "@/lib/ai/usage";

/**
 * What this workspace has spent on AI this month and how its calls ended,
 * including the refusals. This is the record the pilot review reads.
 */
export const GET = apiRoute(async (request: Request) => {
  const companyId = new URL(request.url).searchParams.get("companyId") ?? undefined;
  const context = await requireWiaApiContext(["SUPER_ADMIN", "ADMIN"], companyId);
  if (context.response) return context.response;
  if (context.demo) return Response.json({ mode: "demo", usage: null });
  return Response.json({ mode: "database", usage: await getAiUsageSummary(context.actor) });
});
