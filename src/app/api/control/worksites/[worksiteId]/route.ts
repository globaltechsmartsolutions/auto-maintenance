import { z } from "zod";
import { apiRoute } from "@/lib/http/api-route";
import { worksiteUpdateSchema } from "@/lib/wia-control/domain";
import { requireWiaApiContext } from "@/lib/wia-control/api-context";
import { updateWorksite } from "@/lib/wia-control/service";

const requestSchema = worksiteUpdateSchema.and(
  z.object({ companyId: z.string().min(1).optional() })
);

export const PATCH = apiRoute(async (
  request: Request,
  context: { params: Promise<{ worksiteId: string }> }
) => {
  const { worksiteId } = await context.params;
  const payload = requestSchema.parse(await request.json());
  const apiContext = await requireWiaApiContext(
    ["SUPER_ADMIN", "ADMIN", "MANAGER"],
    payload.companyId
  );
  if (apiContext.response) return apiContext.response;
  if (apiContext.demo) return Response.json({ worksite: { id: worksiteId, ...payload } });

  return Response.json({
    worksite: await updateWorksite(apiContext.actor, worksiteId, payload),
  });
});
