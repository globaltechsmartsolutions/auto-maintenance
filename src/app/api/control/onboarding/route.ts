import { apiRoute } from "@/lib/http/api-route";
import { requireWiaApiContext } from "@/lib/wia-control/api-context";
import { getPilotOnboardingProgress } from "@/lib/wia-control/service";

export const GET = apiRoute(async (request: Request) => {
  const companyId = new URL(request.url).searchParams.get("companyId") ?? undefined;
  const context = await requireWiaApiContext(["SUPER_ADMIN", "ADMIN", "MANAGER"], companyId);
  if (context.response) return context.response;
  if (context.demo) return Response.json({ progress: { customers: 1, worksites: 1, employees: 1, services: 1, shifts: 1, clockEvents: 0 } });
  return Response.json({ progress: await getPilotOnboardingProgress(context.actor) });
});
