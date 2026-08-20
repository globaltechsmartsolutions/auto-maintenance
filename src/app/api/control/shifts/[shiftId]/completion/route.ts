import { apiRoute } from "@/lib/http/api-route";
import { shiftCompletionSchema } from "@/lib/wia-control/domain";
import { requireWiaApiContext } from "@/lib/wia-control/api-context";
import { completePlannedShift } from "@/lib/wia-control/service";

export const POST = apiRoute(async (
  request: Request,
  routeContext: { params: Promise<{ shiftId: string }> }
) => {
  const { shiftId } = await routeContext.params;
  const payload = shiftCompletionSchema.parse(await request.json());
  const context = await requireWiaApiContext(["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE"]);
  if (context.response) return context.response;
  if (context.demo) return Response.json({ completion: { id: `demo-completion-${Date.now()}`, ...payload } }, { status: 201 });
  return Response.json({ completion: await completePlannedShift(context.actor, shiftId, payload) }, { status: 201 });
});
