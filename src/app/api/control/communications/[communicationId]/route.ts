import { z } from "zod";
import { apiRoute } from "@/lib/http/api-route";
import { communicationActionSchema } from "@/lib/wia-control/domain";
import { requireWiaApiContext, requestedCompanyIdFromBody } from "@/lib/wia-control/api-context";
import { acknowledgeCommunication, resendCommunication } from "@/lib/wia-control/service";

const requestSchema = communicationActionSchema.and(
    z.object({ companyId: z.string().min(1).optional() })
);

export const PATCH = apiRoute(async (
    request: Request,
    context: { params: Promise<{ communicationId: string }> }
) => {
    const { communicationId } = await context.params;
    const rawPayload = await request.json();
    const apiContext = await requireWiaApiContext(
        ["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE"],
        requestedCompanyIdFromBody(rawPayload)
    );
    if (apiContext.response) return apiContext.response;
    const payload = requestSchema.parse(rawPayload);
    if (apiContext.demo) {
        return Response.json({ communication: { id: communicationId, ...payload } });
    }

    const communication =
        payload.action === "RESEND"
            ? await resendCommunication(apiContext.actor, communicationId)
            : await acknowledgeCommunication(apiContext.actor, communicationId);

    return Response.json({ communication });
});
