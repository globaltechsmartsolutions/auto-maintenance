import { apiRoute } from "@/lib/http/api-route";
import { requireWiaApiContext } from "@/lib/wia-control/api-context";
import { listIncidentDrafts } from "@/lib/ai/communication-workflow";

/** Every draft written for one incident, generated text beside final text. */
export const GET = apiRoute(async (request: Request) => {
  const url = new URL(request.url);
  const incidentId = url.searchParams.get("incidentId");
  if (!incidentId) {
    return Response.json({ error: "An incidentId is required.", code: "INCIDENT_ID_REQUIRED" }, { status: 400 });
  }
  const context = await requireWiaApiContext(
    ["SUPER_ADMIN", "ADMIN", "MANAGER"],
    url.searchParams.get("companyId") ?? undefined
  );
  if (context.response) return context.response;
  if (context.demo) return Response.json({ mode: "demo", drafts: [] });
  return Response.json({ mode: "database", drafts: await listIncidentDrafts(context.actor, incidentId) });
});
