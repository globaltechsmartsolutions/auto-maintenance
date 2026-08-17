import { z } from "zod";
import { apiRoute } from "@/lib/http/api-route";
import { correctionRequestSchema } from "@/lib/wia-control/domain";
import { requireWiaApiContext } from "@/lib/wia-control/api-context";
import { listTimeCorrections, requestTimeCorrection } from "@/lib/wia-control/service";

const requestSchema = correctionRequestSchema.extend({ companyId: z.string().min(1).optional() });

export const GET = apiRoute(async (request: Request) => {
  const companyId = new URL(request.url).searchParams.get("companyId") ?? undefined;
  const context = await requireWiaApiContext(
    ["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE"],
    companyId
  );
  if (context.response) return context.response;
  if (context.demo) return Response.json({ mode: "demo", corrections: [] });

  return Response.json({
    mode: "database",
    corrections: await listTimeCorrections(context.actor),
  });
});

export const POST = apiRoute(async (request: Request) => {
  const payload = requestSchema.parse(await request.json());
  const context = await requireWiaApiContext(
    ["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE"],
    payload.companyId
  );
  if (context.response) return context.response;
  if (context.demo) {
    return Response.json(
      { correction: { ...payload, id: `demo-correction-${Date.now()}`, status: "PENDING" } },
      { status: 201 }
    );
  }

  const correction = await requestTimeCorrection(context.actor, payload);
  return Response.json({ correction }, { status: 201 });
});
