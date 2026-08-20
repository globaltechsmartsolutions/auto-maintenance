import { z } from "zod";
import { apiRoute } from "@/lib/http/api-route";
import { operationalServiceUpdateSchema } from "@/lib/wia-control/domain";
import { requireWiaApiContext, requestedCompanyIdFromBody } from "@/lib/wia-control/api-context";
import { getOperationalServiceDetail, updateOperationalService } from "@/lib/wia-control/service";

const requestSchema = operationalServiceUpdateSchema.extend({
  companyId: z.string().min(1).optional(),
});

export const GET = apiRoute(async (
  request: Request,
  routeContext: { params: Promise<{ serviceId: string }> }
) => {
  const { serviceId } = await routeContext.params;
  const companyId = new URL(request.url).searchParams.get("companyId") ?? undefined;
  const context = await requireWiaApiContext(["SUPER_ADMIN", "ADMIN", "MANAGER"], companyId);
  if (context.response) return context.response;
  if (context.demo) return Response.json({ service: null, message: "Service evidence is available with a connected workspace." });
  return Response.json({ service: await getOperationalServiceDetail(context.actor, serviceId) });
});

export const PATCH = apiRoute(async (
  request: Request,
  routeContext: { params: Promise<{ serviceId: string }> }
) => {
  const { serviceId } = await routeContext.params;
  const rawPayload = await request.json();
  const context = await requireWiaApiContext(
    ["SUPER_ADMIN", "ADMIN", "MANAGER"],
    requestedCompanyIdFromBody(rawPayload)
  );
  if (context.response) return context.response;
  const payload = requestSchema.parse(rawPayload);
  if (context.demo) return Response.json({ service: { ...payload, id: serviceId } });

  return Response.json({ service: await updateOperationalService(context.actor, serviceId, payload) });
});
