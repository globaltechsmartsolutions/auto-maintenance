import { z } from "zod";
import { apiRoute } from "@/lib/http/api-route";
import {
  correctionAcknowledgementSchema,
  correctionReviewSchema,
} from "@/lib/wia-control/domain";
import { requireWiaApiContext } from "@/lib/wia-control/api-context";
import {
  acknowledgeTimeCorrection,
  reviewTimeCorrection,
} from "@/lib/wia-control/service";

const requestSchema = z.discriminatedUnion("action", [
  correctionReviewSchema.extend({
    action: z.literal("REVIEW"),
    companyId: z.string().min(1).optional(),
  }),
  correctionAcknowledgementSchema.extend({
    action: z.literal("ACKNOWLEDGE"),
    companyId: z.string().min(1).optional(),
  }),
]);

export const PATCH = apiRoute(async (
  request: Request,
  context: { params: Promise<{ correctionId: string }> }
) => {
  const { correctionId } = await context.params;
  const payload = requestSchema.parse(await request.json());
  const roles = payload.action === "REVIEW"
    ? (["SUPER_ADMIN", "ADMIN", "MANAGER"] as const)
    : (["EMPLOYEE"] as const);
  const apiContext = await requireWiaApiContext([...roles], payload.companyId);
  if (apiContext.response) return apiContext.response;
  if (apiContext.demo) return Response.json({ correction: { id: correctionId, ...payload } });

  const correction = payload.action === "REVIEW"
    ? await reviewTimeCorrection(apiContext.actor, correctionId, payload)
    : await acknowledgeTimeCorrection(apiContext.actor, correctionId, payload);
  return Response.json({ correction });
});
