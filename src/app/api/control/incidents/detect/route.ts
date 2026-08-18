import { z } from "zod";
import { apiRoute } from "@/lib/http/api-route";
import { requireWiaApiContext, requestedCompanyIdFromBody } from "@/lib/wia-control/api-context";
import { detectIncompleteAttendance } from "@/lib/wia-control/service";

const requestSchema = z.object({
  companyId: z.string().min(1).optional(),
  now: z.string().datetime({ offset: true }).optional(),
});

export const POST = apiRoute(async (request: Request) => {
  const rawPayload = await request.json();
  const context = await requireWiaApiContext(
    ["SUPER_ADMIN", "ADMIN", "MANAGER"],
    requestedCompanyIdFromBody(rawPayload)
  );
  if (context.response) return context.response;
  const payload = requestSchema.parse(rawPayload);
  if (context.demo) return Response.json({ inspected: 0, created: 0, incidentIds: [] });

  return Response.json(
    await detectIncompleteAttendance(context.actor, payload.now ? new Date(payload.now) : new Date())
  );
});
