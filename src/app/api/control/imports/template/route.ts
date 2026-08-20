import { apiRoute } from "@/lib/http/api-route";
import { requireWiaApiContext } from "@/lib/wia-control/api-context";
import { importKindSchema, importTemplateCsv } from "@/lib/wia-control/csv-import";

/**
 * Serves the starter file for each import kind. It carries no company data, so
 * it is safe in demo mode, but it still requires an authorised session because
 * it documents the workspace's own import contract.
 */
export const GET = apiRoute(async (request: Request) => {
  const url = new URL(request.url);
  const context = await requireWiaApiContext(
    ["SUPER_ADMIN", "ADMIN", "MANAGER"],
    url.searchParams.get("companyId") ?? undefined
  );
  if (context.response) return context.response;

  const kind = importKindSchema.parse(url.searchParams.get("kind"));
  return new Response(importTemplateCsv(kind), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="wiacontrol-${kind.toLowerCase()}-template.csv"`,
      "Cache-Control": "no-store",
    },
  });
});
