import { apiRoute } from "@/lib/http/api-route";
import { requireWiaApiContext } from "@/lib/wia-control/api-context";
import { listCommunicationOutbox } from "@/lib/wia-control/service";

export const GET = apiRoute(async (request: Request) => {
  const companyId = new URL(request.url).searchParams.get("companyId") ?? undefined;
  const context = await requireWiaApiContext(
    ["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE"],
    companyId
  );
  if (context.response) return context.response;
  if (context.demo) return Response.json({ mode: "demo", communications: [] });

  const records = await listCommunicationOutbox(context.actor);

  return Response.json({
    mode: "database",
    communications: records.map((record) => ({
      id: record.id,
      shiftId: record.shiftId ?? undefined,
      shiftTitle: record.shift?.title,
      recipientEmployeeId: record.recipientEmployeeId ?? undefined,
      recipientEmployeeName: record.recipientEmployee
        ? `${record.recipientEmployee.user.firstName} ${record.recipientEmployee.user.lastName}`.trim()
        : undefined,
      channel: record.channel,
      template: record.template,
      status: record.status,
      attempts: record.attempts,
      lastError: record.lastError ?? undefined,
      sentAt: record.sentAt?.toISOString(),
      acknowledgedAt: record.acknowledgedAt?.toISOString(),
      nextAttemptAt: record.nextAttemptAt.toISOString(),
      createdAt: record.createdAt.toISOString(),
    })),
  });
});