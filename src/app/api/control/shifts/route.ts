import { z } from "zod";
import { apiRoute } from "@/lib/http/api-route";
import { plannedShiftInputSchema } from "@/lib/wia-control/domain";
import { requireWiaApiContext } from "@/lib/wia-control/api-context";
import { createPlannedShift } from "@/lib/wia-control/service";

const requestSchema = plannedShiftInputSchema.and(
  z.object({ companyId: z.string().min(1).optional() })
);

export const POST = apiRoute(async (request: Request) => {
  const payload = requestSchema.parse(await request.json());
  const context = await requireWiaApiContext(
    ["SUPER_ADMIN", "ADMIN", "MANAGER"],
    payload.companyId
  );
  if (context.response) return context.response;
  if (context.demo) {
    return Response.json({ shift: { ...payload, id: `demo-shift-${Date.now()}` } }, { status: 201 });
  }

  const shift = await createPlannedShift(context.actor, payload);
  return Response.json({ shift }, { status: 201 });
});
