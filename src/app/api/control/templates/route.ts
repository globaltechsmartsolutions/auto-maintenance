import { apiRoute } from "@/lib/http/api-route";
import { requireWiaApiContext } from "@/lib/wia-control/api-context";
import { listActiveTemplates } from "@/lib/wia-control/delivery-templates";

/**
 * The delivery templates a device should render. Versions are returned with the
 * fields so a submission can declare exactly which version it answered, and an
 * outdated device is told to reload rather than silently answering superseded
 * questions.
 */
export const GET = apiRoute(async (request: Request) => {
  const companyId = new URL(request.url).searchParams.get("companyId") ?? undefined;
  const context = await requireWiaApiContext(
    ["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE"],
    companyId
  );
  if (context.response) return context.response;
  return Response.json({ templates: listActiveTemplates() });
});
