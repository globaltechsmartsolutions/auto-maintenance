import { z } from "zod";
import { apiRoute } from "@/lib/http/api-route";
import { plannedShiftUpdateSchema } from "@/lib/wia-control/domain";
import { requireWiaApiContext, requestedCompanyIdFromBody } from "@/lib/wia-control/api-context";
import { updatePlannedShift } from "@/lib/wia-control/service";

const requestSchema = plannedShiftUpdateSchema.and(
  z.object({ companyId: z.string().min(1).optional() })
);

export const PATCH = apiRoute(async (
  request: Request,
  context: { params: Promise<{ shiftId: string }> }
) => {
  const { shiftId } = await context.params;
  const rawPayload = await request.json();
  const apiContext = await requireWiaApiContext(
    ["SUPER_ADMIN", "ADMIN", "MANAGER"],
    requestedCompanyIdFromBody(rawPayload)
  );
  if (apiContext.response) return apiContext.response;
  const payload = requestSchema.parse(rawPayload);
  if (apiContext.demo) return Response.json({ shift: { id: shiftId, ...payload } });

  return Response.json({
    shift: await updatePlannedShift(apiContext.actor, shiftId, payload),
  });
});
