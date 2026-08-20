import { z } from "zod";
import { apiRoute } from "@/lib/http/api-route";
import { requireWiaApiContext, requestedCompanyIdFromBody } from "@/lib/wia-control/api-context";
import { generateOperationsBrief, isOperationsBriefEnabled } from "@/lib/ai/operations-brief";

const requestSchema = z.object({ companyId: z.string().min(1).optional(), date: z.string().date() });

export const POST = apiRoute(async (request: Request) => {
  const raw = await request.json();
  const context = await requireWiaApiContext(["SUPER_ADMIN", "ADMIN", "MANAGER"], requestedCompanyIdFromBody(raw));
  if (context.response) return context.response;
  const payload = requestSchema.parse(raw);
  if (!isOperationsBriefEnabled()) {
    return Response.json({ error: "AI operations briefs are not configured for this environment." }, { status: 503 });
  }
  if (context.demo) {
    return Response.json({ error: "AI operations briefs require an authenticated workspace." }, { status: 403 });
  }
  return Response.json({ brief: await generateOperationsBrief(context.actor, payload.date) });
});
