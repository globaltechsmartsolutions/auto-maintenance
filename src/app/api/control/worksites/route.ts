import { z } from "zod";
import { apiRoute } from "@/lib/http/api-route";
import { worksiteInputSchema } from "@/lib/wia-control/domain";
import { requireWiaApiContext } from "@/lib/wia-control/api-context";
import { createWorksite, listWorksites } from "@/lib/wia-control/service";

const requestSchema = worksiteInputSchema.extend({ companyId: z.string().min(1).optional() });

export const GET = apiRoute(async (request: Request) => {
  const url = new URL(request.url);
  const companyId = url.searchParams.get("companyId") ?? undefined;
  const context = await requireWiaApiContext(
    ["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE"],
    companyId
  );
  if (context.response) return context.response;
  if (context.demo) return Response.json({ mode: "demo", worksites: [] });

  return Response.json({ mode: "database", worksites: await listWorksites(context.actor) });
});

export const POST = apiRoute(async (request: Request) => {
  const payload = requestSchema.parse(await request.json());
  const context = await requireWiaApiContext(
    ["SUPER_ADMIN", "ADMIN", "MANAGER"],
    payload.companyId
  );
  if (context.response) return context.response;
  if (context.demo) {
    return Response.json({ worksite: { ...payload, id: `demo-worksite-${Date.now()}` } }, { status: 201 });
  }

  const worksite = await createWorksite(context.actor, payload);
  return Response.json({ worksite }, { status: 201 });
});
