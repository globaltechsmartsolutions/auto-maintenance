import { apiRoute } from "@/lib/http/api-route";
import { requireWiaApiContext } from "@/lib/wia-control/api-context";
import { confirmEvidenceUpload } from "@/lib/wia-control/evidence-service";

/**
 * Called once the browser has finished writing to the signed upload URL. The
 * server screens the stored bytes here, so nothing becomes usable evidence
 * purely because an upload succeeded.
 */
export const POST = apiRoute(async (
  request: Request,
  routeContext: { params: Promise<{ attachmentId: string }> }
) => {
  const { attachmentId } = await routeContext.params;
  const context = await requireWiaApiContext(["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE"]);
  if (context.response) return context.response;
  if (context.demo) {
    return Response.json(
      { error: "Evidence upload requires a connected workspace and private storage.", code: "DEMO_MODE" },
      { status: 403 }
    );
  }
  return Response.json({ evidence: await confirmEvidenceUpload(context.actor, attachmentId) });
});
