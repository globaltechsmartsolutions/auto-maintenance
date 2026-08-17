import { apiRoute } from "@/lib/http/api-route";
import { requireWiaApiContext } from "@/lib/wia-control/api-context";
import { listEmployees } from "@/lib/wia-control/service";

export const GET = apiRoute(async (request: Request) => {
  const companyId = new URL(request.url).searchParams.get("companyId") ?? undefined;
  const context = await requireWiaApiContext(
    ["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE"],
    companyId
  );
  if (context.response) return context.response;
  if (context.demo) return Response.json({ mode: "demo", employees: [] });

  return Response.json({ mode: "database", employees: await listEmployees(context.actor) });
});
