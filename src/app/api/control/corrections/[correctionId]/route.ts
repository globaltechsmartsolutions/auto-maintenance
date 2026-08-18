import { z } from "zod";
import { apiRoute } from "@/lib/http/api-route";
import {
  correctionAcknowledgementSchema,
  correctionReviewSchema,
} from "@/lib/wia-control/domain";
import { requireWiaApiContext, requestedCompanyIdFromBody } from "@/lib/wia-control/api-context";
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
  const rawPayload = await request.json();
  const apiContext = await requireWiaApiContext(
    ["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE"],
    requestedCompanyIdFromBody(rawPayload)
  );
  if (apiContext.response) return apiContext.response;
  const payload = requestSchema.parse(rawPayload);
  if (apiContext.demo) return Response.json({ correction: { id: correctionId, ...payload } });

  const correction = payload.action === "REVIEW"
    ? await reviewTimeCorrection(apiContext.actor, correctionId, payload)
    : await acknowledgeTimeCorrection(apiContext.actor, correctionId, payload);
  return Response.json({ correction });
});
