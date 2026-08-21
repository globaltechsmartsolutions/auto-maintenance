import { z } from "zod";
import { apiRoute } from "@/lib/http/api-route";
import { customerInputSchema } from "@/lib/wia-control/domain";
import { requireWiaApiContext, requestedCompanyIdFromBody } from "@/lib/wia-control/api-context";
import { createOperationalCustomer, listOperationalCustomers } from "@/lib/wia-control/service";

const requestSchema = customerInputSchema.extend({ companyId: z.string().min(1).optional() });

export const GET = apiRoute(async (request: Request) => {
  const url = new URL(request.url);
  const context = await requireWiaApiContext(
    ["SUPER_ADMIN", "ADMIN", "MANAGER"],
    url.searchParams.get("companyId") ?? undefined
  );
  if (context.response) return context.response;
  if (context.demo) return Response.json({ mode: "demo", customers: [] });

  return Response.json({
    mode: "database",
    customers: await listOperationalCustomers(context.actor),
  });
});

export const POST = apiRoute(async (request: Request) => {
  const rawPayload = await request.json();
  const context = await requireWiaApiContext(
    ["SUPER_ADMIN", "ADMIN", "MANAGER"],
    requestedCompanyIdFromBody(rawPayload)
  );
  if (context.response) return context.response;
  const payload = requestSchema.parse(rawPayload);
  if (context.demo) {
    return Response.json(
      { customer: { id: `demo-customer-${Date.now()}`, name: payload.name, city: payload.city ?? null } },
      { status: 201 }
    );
  }

  const customer = await createOperationalCustomer(context.actor, payload);
  return Response.json({ customer }, { status: 201 });
});
