import { z } from "zod";
import { apiRoute } from "@/lib/http/api-route";
import { incidentUpdateSchema } from "@/lib/wia-control/domain";
import { requireWiaApiContext } from "@/lib/wia-control/api-context";
import { updateAttendanceIncident } from "@/lib/wia-control/service";

const requestSchema = incidentUpdateSchema.and(
  z.object({ companyId: z.string().min(1).optional() })
);

export const PATCH = apiRoute(async (
  request: Request,
  context: { params: Promise<{ incidentId: string }> }
) => {
  const { incidentId } = await context.params;
  const payload = requestSchema.parse(await request.json());
  const apiContext = await requireWiaApiContext(
    ["SUPER_ADMIN", "ADMIN", "MANAGER"],
    payload.companyId
  );
  if (apiContext.response) return apiContext.response;
  if (apiContext.demo) return Response.json({ incident: { id: incidentId, ...payload } });

  return Response.json({
    incident: await updateAttendanceIncident(apiContext.actor, incidentId, payload),
  });
});
