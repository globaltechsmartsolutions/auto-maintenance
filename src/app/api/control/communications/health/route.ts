import { apiRoute } from "@/lib/http/api-route";
import { requireWiaApiContext } from "@/lib/wia-control/api-context";
import { getCommunicationHealth } from "@/lib/wia-control/service";

/**
 * Operational health of the message outbox for this workspace. It answers the
 * only question that matters after a reassignment: is anything stuck, and has
 * anything given up?
 */
export const GET = apiRoute(async (request: Request) => {
  const companyId = new URL(request.url).searchParams.get("companyId") ?? undefined;
  const context = await requireWiaApiContext(["SUPER_ADMIN", "ADMIN", "MANAGER"], companyId);
  if (context.response) return context.response;
  if (context.demo) {
    return Response.json({
      mode: "demo",
      health: {
        pending: 0,
        retrying: 0,
        processing: 0,
        failed: 0,
        sentLast24h: 0,
        unacknowledgedLast24h: 0,
        oldestPendingMinutes: null,
        needsAttention: false,
      },
    });
  }
  return Response.json({ mode: "database", health: await getCommunicationHealth(context.actor) });
});
