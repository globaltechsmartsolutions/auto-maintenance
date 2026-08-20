import { z } from "zod";
import { apiRoute } from "@/lib/http/api-route";
import { requireWiaApiContext, requestedCompanyIdFromBody } from "@/lib/wia-control/api-context";
import { generateIncidentCommunicationDraft } from "@/lib/ai/incident-communication-draft";

const requestSchema = z.object({ companyId: z.string().min(1).optional(), incidentId: z.string().min(1), audience: z.enum(["INTERNAL_COORDINATION", "CUSTOMER_UPDATE"]) });

export const POST = apiRoute(async (request: Request) => {
  const raw = await request.json();
  const context = await requireWiaApiContext(["SUPER_ADMIN", "ADMIN", "MANAGER"], requestedCompanyIdFromBody(raw));
  if (context.response) return context.response;
  const payload = requestSchema.parse(raw);
  if (context.demo) return Response.json({ error: "AI communication drafts require an authenticated workspace." }, { status: 403 });
  return Response.json({ draft: await generateIncidentCommunicationDraft(context.actor, payload.incidentId, payload.audience) });
});
