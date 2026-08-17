import { z } from "zod";
import { apiRoute } from "@/lib/http/api-route";
import { coverageRecommendationSchema } from "@/lib/wia-control/domain";
import { requireWiaApiContext } from "@/lib/wia-control/api-context";
import { recommendCoverageCandidates } from "@/lib/wia-control/service";

const requestSchema = coverageRecommendationSchema.extend({
  companyId: z.string().min(1).optional(),
});

export const POST = apiRoute(async (request: Request) => {
  const payload = requestSchema.parse(await request.json());
  const context = await requireWiaApiContext(
    ["SUPER_ADMIN", "ADMIN", "MANAGER"],
    payload.companyId
  );
  if (context.response) return context.response;
  if (context.demo) {
    return Response.json({ incidentId: payload.incidentId, candidates: [], recommended: null });
  }

  return Response.json(await recommendCoverageCandidates(context.actor, payload));
});
