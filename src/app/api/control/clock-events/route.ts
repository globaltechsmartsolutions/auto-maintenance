import { z } from "zod";
import { apiRoute } from "@/lib/http/api-route";
import { clockCommandSchema } from "@/lib/wia-control/domain";
import { requireWiaApiContext } from "@/lib/wia-control/api-context";
import { recordClockEvent } from "@/lib/wia-control/service";

const requestSchema = clockCommandSchema.extend({ companyId: z.string().min(1).optional() });

export const POST = apiRoute(async (request: Request) => {
  const payload = requestSchema.parse(await request.json());
  const context = await requireWiaApiContext(
    ["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE"],
    payload.companyId
  );
  if (context.response) return context.response;
  if (context.demo) {
    return Response.json(
      { event: { ...payload, id: `demo-clock-${Date.now()}` }, created: true },
      { status: 201 }
    );
  }

  const result = await recordClockEvent(context.actor, payload);
  return Response.json(result, { status: result.created ? 201 : 200 });
});
