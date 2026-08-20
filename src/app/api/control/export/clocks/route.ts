import { z } from "zod";
import { apiRoute } from "@/lib/http/api-route";
import { requireWiaApiContext } from "@/lib/wia-control/api-context";
import { buildExport, exportFileName } from "@/lib/wia-control/exports";
import { exportClockEvents } from "@/lib/wia-control/service";

const querySchema = z.object({
  companyId: z.string().min(1).optional(),
  from: z.string().datetime({ offset: true }),
  to: z.string().datetime({ offset: true }),
});

export const GET = apiRoute(async (request: Request) => {
  const url = new URL(request.url);
  const payload = querySchema.parse(Object.fromEntries(url.searchParams));
  const context = await requireWiaApiContext(
    ["SUPER_ADMIN", "ADMIN", "MANAGER"],
    payload.companyId
  );
  if (context.response) return context.response;

  const from = new Date(payload.from);
  const to = new Date(payload.to);
  const events: Awaited<ReturnType<typeof exportClockEvents>> = context.demo
    ? []
    : await exportClockEvents(context.actor, from, to);

  const { csv } = buildExport("attendance", events, (event) => ({
    "Event id": event.id,
    Employee: `${event.employee.user.firstName} ${event.employee.user.lastName}`.trim(),
    Worksite: event.worksite.name,
    City: event.worksite.city,
    Shift: event.shift.title,
    Event: event.type,
    "Occurred at": event.occurredAt,
    "Recorded at": event.recordedAt,
    Method: event.method,
    "Location verified": event.locationVerified,
    "Captured offline": event.isOffline,
  }));

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFileName("attendance", from, to)}"`,
      "Cache-Control": "no-store",
    },
  });
});
