import { apiRoute } from "@/lib/http/api-route";
import { requireWiaApiContext } from "@/lib/wia-control/api-context";
import { getOperationalServiceDetail } from "@/lib/wia-control/service";

function cell(value: string | number | boolean | null | undefined) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export const GET = apiRoute(async (
  request: Request,
  routeContext: { params: Promise<{ serviceId: string }> }
) => {
  const { serviceId } = await routeContext.params;
  const companyId = new URL(request.url).searchParams.get("companyId") ?? undefined;
  const context = await requireWiaApiContext(["SUPER_ADMIN", "ADMIN", "MANAGER"], companyId);
  if (context.response) return context.response;
  if (context.demo) return new Response("Service evidence export requires a connected workspace.", { status: 400 });
  const service = await getOperationalServiceDetail(context.actor, serviceId);
  const rows: Array<Array<string | number | boolean | null | undefined>> = [
    ["Service", "Customer", "Shift", "Worksite", "Scheduled start", "Scheduled end", "Assigned employee", "Shift status", "Completion outcome", "Completion time", "Completion note", "Clock events", "Open incidents", "Coverage decisions"],
    ...service.plannedShifts.map((shift) => [
      service.title,
      service.customer.name,
      shift.title,
      shift.worksite.name,
      shift.scheduledStart.toISOString(),
      shift.scheduledEnd.toISOString(),
      shift.employee ? `${shift.employee.user.firstName} ${shift.employee.user.lastName}`.trim() : null,
      shift.status,
      shift.completion?.outcome,
      shift.completion?.completedAt.toISOString(),
      shift.completion?.note,
      shift.clockEvents.length,
      shift.incidents.filter((incident) => ["OPEN", "ACKNOWLEDGED"].includes(incident.status)).length,
      shift.coverageDecisions.length,
    ]),
  ];
  const csv = `\ufeff${rows.map((row) => row.map(cell).join(";")).join("\n")}`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="wia-control-service-evidence-${serviceId}.csv"`,
      "Cache-Control": "no-store",
    },
  });
});
