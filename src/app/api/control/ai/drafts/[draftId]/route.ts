import { z } from "zod";
import { apiRoute } from "@/lib/http/api-route";
import { requireWiaApiContext, requestedCompanyIdFromBody } from "@/lib/wia-control/api-context";
import {
  approveIncidentDraft,
  cancelIncidentDraft,
  editIncidentDraft,
} from "@/lib/ai/communication-workflow";

const requestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("EDIT"),
    companyId: z.string().min(1).optional(),
    subject: z.string(),
    message: z.string(),
  }),
  z.object({
    action: z.literal("APPROVE"),
    companyId: z.string().min(1).optional(),
    subject: z.string(),
    message: z.string(),
    recipientEmployeeId: z.string().min(1).optional(),
  }),
  z.object({ action: z.literal("CANCEL"), companyId: z.string().min(1).optional() }),
]);

/**
 * Edit, approve, or cancel one AI draft. Approval is the only path to a
 * recipient, and it requires the approver to restate the text they accept.
 */
export const PATCH = apiRoute(async (
  request: Request,
  routeContext: { params: Promise<{ draftId: string }> }
) => {
  const { draftId } = await routeContext.params;
  const raw = await request.json();
  const context = await requireWiaApiContext(
    ["SUPER_ADMIN", "ADMIN", "MANAGER"],
    requestedCompanyIdFromBody(raw)
  );
  if (context.response) return context.response;
  if (context.demo) {
    return Response.json(
      { error: "AI drafts require a connected workspace.", code: "DEMO_MODE" },
      { status: 403 }
    );
  }
  const payload = requestSchema.parse(raw);

  if (payload.action === "EDIT") {
    return Response.json({
      draft: await editIncidentDraft(context.actor, draftId, {
        subject: payload.subject,
        message: payload.message,
      }),
    });
  }
  if (payload.action === "APPROVE") {
    return Response.json({
      draft: await approveIncidentDraft(context.actor, draftId, {
        subject: payload.subject,
        message: payload.message,
        recipientEmployeeId: payload.recipientEmployeeId,
      }),
    });
  }
  return Response.json({ draft: await cancelIncidentDraft(context.actor, draftId) });
});
