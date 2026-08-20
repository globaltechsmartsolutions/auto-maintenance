import { apiRoute } from "@/lib/http/api-route";
import { requireWiaApiContext } from "@/lib/wia-control/api-context";
import { listRecoveryQueue, listRecoveryQueueServices } from "@/lib/wia-control/service";

/**
 * The coordinator's triage queue. Filters are read from the query string so a
 * particular view — one service, one owner, unassigned only — is a shareable
 * link within the workspace.
 */
export const GET = apiRoute(async (request: Request) => {
  const url = new URL(request.url);
  const context = await requireWiaApiContext(
    ["SUPER_ADMIN", "ADMIN", "MANAGER"],
    url.searchParams.get("companyId") ?? undefined
  );
  if (context.response) return context.response;
  if (context.demo) {
    return Response.json({
      mode: "demo",
      queue: { generatedAt: new Date(), counts: { total: 0, overdue: 0, unowned: 0, stale: 0 }, rows: [] },
      services: [],
    });
  }

  const [queue, services] = await Promise.all([
    listRecoveryQueue(context.actor, {
      serviceId: url.searchParams.get("serviceId") ?? undefined,
      ownerId: url.searchParams.get("ownerId") ?? undefined,
      worksiteId: url.searchParams.get("worksiteId") ?? undefined,
      includeClosed: url.searchParams.get("includeClosed") === "true",
    }),
    listRecoveryQueueServices(context.actor),
  ]);

  return Response.json({ mode: "database", queue, services });
});
