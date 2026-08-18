import { z } from "zod";
import { apiRoute } from "@/lib/http/api-route";
import { coverageDecisionSchema } from "@/lib/wia-control/domain";
import { requireWiaApiContext, requestedCompanyIdFromBody } from "@/lib/wia-control/api-context";
import { confirmCoverage } from "@/lib/wia-control/service";

const requestSchema = coverageDecisionSchema.extend({ companyId: z.string().min(1).optional() });

export const POST = apiRoute(async (request: Request) => {
  const rawPayload = await request.json();
  const context = await requireWiaApiContext(
    ["SUPER_ADMIN", "ADMIN", "MANAGER"],
    requestedCompanyIdFromBody(rawPayload)
  );
  if (context.response) return context.response;
  const payload = requestSchema.parse(rawPayload);
  if (context.demo) {
    return Response.json(
      { decision: { ...payload, id: `demo-coverage-${Date.now()}` } },
      { status: 201 }
    );
  }

  const decision = await confirmCoverage(context.actor, payload);
  return Response.json({ decision }, { status: 201 });
});
