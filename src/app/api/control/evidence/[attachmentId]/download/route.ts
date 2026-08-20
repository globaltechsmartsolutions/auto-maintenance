import { apiRoute } from "@/lib/http/api-route";
import { requireWiaApiContext } from "@/lib/wia-control/api-context";
import { createEvidenceDownloadUrl } from "@/lib/wia-control/evidence-service";

/**
 * Issues one short-lived signed read and records it. The link is returned in
 * the body rather than as a redirect so the caller cannot accidentally cache or
 * share a location header, and every issued link is auditable.
 */
export const GET = apiRoute(async (
  request: Request,
  routeContext: { params: Promise<{ attachmentId: string }> }
) => {
  const { attachmentId } = await routeContext.params;
  const context = await requireWiaApiContext(["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE"]);
  if (context.response) return context.response;
  if (context.demo) {
    return Response.json(
      { error: "Evidence download requires a connected workspace and private storage.", code: "DEMO_MODE" },
      { status: 403 }
    );
  }
  const download = await createEvidenceDownloadUrl(context.actor, attachmentId);
  return Response.json(download, { headers: { "Cache-Control": "no-store" } });
});
