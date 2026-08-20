import { apiRoute } from "@/lib/http/api-route";
import { requireWiaApiContext, requestedCompanyIdFromBody } from "@/lib/wia-control/api-context";
import { listShiftEvidence, requestEvidenceUpload } from "@/lib/wia-control/evidence-service";

const roles = ["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE"] as const;

/** Metadata for one shift's evidence. Never returns a URL. */
export const GET = apiRoute(async (request: Request) => {
  const url = new URL(request.url);
  const shiftId = url.searchParams.get("shiftId");
  if (!shiftId) {
    return Response.json({ error: "A shiftId is required.", code: "SHIFT_ID_REQUIRED" }, { status: 400 });
  }
  const context = await requireWiaApiContext([...roles], url.searchParams.get("companyId") ?? undefined);
  if (context.response) return context.response;
  if (context.demo) return Response.json({ mode: "demo", evidence: [] });
  return Response.json({ mode: "database", evidence: await listShiftEvidence(context.actor, shiftId) });
});

/** Reserves an attachment and returns a short-lived private upload link. */
export const POST = apiRoute(async (request: Request) => {
  const body = await request.json();
  const context = await requireWiaApiContext([...roles], requestedCompanyIdFromBody(body));
  if (context.response) return context.response;
  if (context.demo) {
    return Response.json(
      { error: "Evidence upload requires a connected workspace and private storage.", code: "DEMO_MODE" },
      { status: 403 }
    );
  }
  return Response.json({ upload: await requestEvidenceUpload(context.actor, body) }, { status: 201 });
});
