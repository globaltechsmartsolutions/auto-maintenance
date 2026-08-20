import { apiRoute } from "@/lib/http/api-route";
import { requireWiaApiContext } from "@/lib/wia-control/api-context";
import { getOperationalServiceDetail } from "@/lib/wia-control/service";
import { listServiceSubmissions } from "@/lib/wia-control/delivery-service";

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
  const [service, submissions] = await Promise.all([
    getOperationalServiceDetail(context.actor, serviceId),
    listServiceSubmissions(context.actor, serviceId),
  ]);
  const submissionsByShift = new Map<string, number>();
  for (const submission of submissions) {
    submissionsByShift.set(submission.shift.id, (submissionsByShift.get(submission.shift.id) ?? 0) + 1);
  }
  const rows: Array<Array<string | number | boolean | null | undefined>> = [
    ["Service", "Customer", "Shift", "Worksite", "Scheduled start", "Scheduled end", "Assigned employee", "Shift status", "Completion outcome", "Completion time", "Completion note", "Clock events", "Open incidents", "Coverage decisions", "Delivery submissions"],
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
      submissionsByShift.get(shift.id) ?? 0,
    ]),
  ];

  // The answered delivery templates follow as their own block, so the pack
  // proves not only that a shift was worked but what was actually reported,
  // against the template version the worker saw.
  if (submissions.length) {
    rows.push([]);
    rows.push(["Delivery submissions"]);
    rows.push(["Shift", "Template", "Version", "Submitted at", "Captured offline", "Submitted by", "Answers", "Linked evidence"]);
    for (const submission of submissions) {
      rows.push([
        submission.shift.title,
        submission.templateKey,
        submission.templateVersion,
        submission.submittedAt.toISOString(),
        submission.capturedOffline,
        submission.employee
          ? `${submission.employee.user.firstName} ${submission.employee.user.lastName}`.trim()
          : null,
        submission.summary,
        submission.evidence.map((file) => file.fileName).join(" | "),
      ]);
    }
  }
  const csv = `\ufeff${rows.map((row) => row.map(cell).join(";")).join("\n")}`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="wia-control-service-evidence-${serviceId}.csv"`,
      "Cache-Control": "no-store",
    },
  });
});
