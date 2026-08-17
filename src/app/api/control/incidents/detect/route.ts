import { z } from "zod";
import { apiRoute } from "@/lib/http/api-route";
import { requireWiaApiContext } from "@/lib/wia-control/api-context";
import { detectIncompleteAttendance } from "@/lib/wia-control/service";

const requestSchema = z.object({
  companyId: z.string().min(1).optional(),
  now: z.string().datetime({ offset: true }).optional(),
});

export const POST = apiRoute(async (request: Request) => {
  const payload = requestSchema.parse(await request.json());
  const context = await requireWiaApiContext(
    ["SUPER_ADMIN", "ADMIN", "MANAGER"],
    payload.companyId
  );
  if (context.response) return context.response;
  if (context.demo) return Response.json({ inspected: 0, created: 0, incidentIds: [] });

  return Response.json(
    await detectIncompleteAttendance(context.actor, payload.now ? new Date(payload.now) : new Date())
  );
});
