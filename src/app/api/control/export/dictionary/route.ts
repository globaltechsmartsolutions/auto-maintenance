import { apiRoute } from "@/lib/http/api-route";
import { requireWiaApiContext } from "@/lib/wia-control/api-context";
import { exportFieldDictionary } from "@/lib/wia-control/exports";

/**
 * What every exported column means. Served from the same definitions the
 * exports are built from, so the documentation cannot drift from the files.
 */
export const GET = apiRoute(async (request: Request) => {
  const companyId = new URL(request.url).searchParams.get("companyId") ?? undefined;
  const context = await requireWiaApiContext(["SUPER_ADMIN", "ADMIN", "MANAGER"], companyId);
  if (context.response) return context.response;
  return Response.json({ datasets: exportFieldDictionary() });
});
