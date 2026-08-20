import { z } from "zod";
import { services as demoServiceFixtures } from "@/lib/mock-data";
import { apiRoute } from "@/lib/http/api-route";
import { operationalServiceInputSchema } from "@/lib/wia-control/domain";
import { requireWiaApiContext, requestedCompanyIdFromBody } from "@/lib/wia-control/api-context";
import {
  createOperationalService,
  listOperationalCustomers,
  listOperationalServices,
  listWorksites,
} from "@/lib/wia-control/service";

const requestSchema = operationalServiceInputSchema.extend({
  companyId: z.string().min(1).optional(),
});

export const GET = apiRoute(async (request: Request) => {
  const url = new URL(request.url);
  const context = await requireWiaApiContext(
    ["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE"],
    url.searchParams.get("companyId") ?? undefined
  );
  if (context.response) return context.response;
  if (context.demo) {
    const customers = [...new Set(demoServiceFixtures.map((service) => service.customer))].map(
      (name, index) => ({ id: `demo-customer-${index + 1}`, name, city: "Demo city" })
    );
    const customerByName = new Map(customers.map((customer) => [customer.name, customer]));
    const recurrence = {
      "One-time": "ONE_TIME",
      Daily: "DAILY",
      Weekly: "WEEKLY",
      Monthly: "MONTHLY",
    } as const;
    const status = {
      Pending: "PENDING",
      Scheduled: "SCHEDULED",
      Completed: "COMPLETED",
    } as const;
    return Response.json({
      mode: "demo",
      customers,
      worksites: [],
      services: demoServiceFixtures.map((service) => ({
        id: service.id,
        title: service.title,
        serviceType: "Field service",
        recurrence: recurrence[service.recurrence as keyof typeof recurrence] ?? "CUSTOM",
        status: status[service.status as keyof typeof status] ?? "PENDING",
        scheduledStart: service.start,
        customer: customerByName.get(service.customer),
        plannedShifts: [],
      })),
    });
  }

  const services = await listOperationalServices(context.actor);
  const [customers, worksites] = context.actor.role === "EMPLOYEE"
    ? [[], []]
    : await Promise.all([listOperationalCustomers(context.actor), listWorksites(context.actor)]);
  return Response.json({ mode: "database", services, customers, worksites });
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
    return Response.json({ service: { ...payload, id: `demo-service-${Date.now()}` } }, { status: 201 });
  }

  return Response.json({ service: await createOperationalService(context.actor, payload) }, { status: 201 });
});
