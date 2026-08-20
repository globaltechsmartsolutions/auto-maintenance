import { apiRoute } from "@/lib/http/api-route";
import { requireWiaApiContext } from "@/lib/wia-control/api-context";
import { listShiftSubmissions, submitDeliveryTemplate } from "@/lib/wia-control/delivery-service";

const roles = ["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE"] as const;

export const GET = apiRoute(async (
  request: Request,
  routeContext: { params: Promise<{ shiftId: string }> }
) => {
  const { shiftId } = await routeContext.params;
  const context = await requireWiaApiContext([...roles]);
  if (context.response) return context.response;
  if (context.demo) return Response.json({ mode: "demo", submissions: [] });
  return Response.json({
    mode: "database",
    submissions: await listShiftSubmissions(context.actor, shiftId),
  });
});

/**
 * Accepts one answered template. The device's `clientSubmissionId` makes this
 * idempotent, so a queued offline submission can be resent freely: a repeat
 * answers 200 with the record that already exists instead of creating a second.
 */
export const POST = apiRoute(async (
  request: Request,
  routeContext: { params: Promise<{ shiftId: string }> }
) => {
  const { shiftId } = await routeContext.params;
  const body = await request.json();
  const context = await requireWiaApiContext([...roles]);
  if (context.response) return context.response;
  if (context.demo) {
    return Response.json(
      { error: "Delivery capture requires a connected workspace.", code: "DEMO_MODE" },
      { status: 403 }
    );
  }
  const result = await submitDeliveryTemplate(context.actor, { ...body, shiftId });
  return Response.json(result, { status: result.created ? 201 : 200 });
});
