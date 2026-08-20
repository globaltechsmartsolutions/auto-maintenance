import { z } from "zod";
import { apiRoute } from "@/lib/http/api-route";
import { requireWiaApiContext } from "@/lib/wia-control/api-context";
import { buildExport, exportFileName } from "@/lib/wia-control/exports";
import { exportIncidents } from "@/lib/wia-control/service";

const querySchema = z.object({
  companyId: z.string().min(1).optional(),
  from: z.string().datetime({ offset: true }),
  to: z.string().datetime({ offset: true }),
});

function name(person?: { firstName: string; lastName: string } | null) {
  return person ? `${person.firstName} ${person.lastName}`.trim() : null;
}

export const GET = apiRoute(async (request: Request) => {
  const url = new URL(request.url);
  const payload = querySchema.parse(Object.fromEntries(url.searchParams));
  const context = await requireWiaApiContext(["SUPER_ADMIN", "ADMIN", "MANAGER"], payload.companyId);
  if (context.response) return context.response;

  const from = new Date(payload.from);
  const to = new Date(payload.to);
  const incidents = context.demo ? [] : await exportIncidents(context.actor, from, to);

  const { csv } = buildExport("incidents", incidents, (incident) => ({
    "Incident id": incident.id,
    Type: incident.type,
    Severity: incident.severity,
    Status: incident.status,
    Worksite: incident.worksite.name,
    Service: incident.shift.service?.title ?? null,
    Customer: incident.shift.service?.customer.name ?? null,
    Shift: incident.shift.title,
    "Affected employee": name(incident.employee?.user),
    Owner: name(incident.owner),
    "Detected at": incident.detectedAt,
    "Due at": incident.dueAt,
    "Acknowledged at": incident.acknowledgedAt,
    "Resolved at": incident.resolvedAt,
    "Resolution notes": incident.resolutionNotes,
  }));

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFileName("incidents", from, to)}"`,
      "Cache-Control": "no-store",
    },
  });
});
