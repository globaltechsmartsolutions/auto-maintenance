import { z } from "zod";
import { apiRoute } from "@/lib/http/api-route";
import { requireWiaApiContext } from "@/lib/wia-control/api-context";
import { exportClockEvents } from "@/lib/wia-control/service";

const querySchema = z.object({
  companyId: z.string().min(1).optional(),
  from: z.string().datetime({ offset: true }),
  to: z.string().datetime({ offset: true }),
});

function csvCell(value: string | number | boolean) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

export const GET = apiRoute(async (request: Request) => {
  const url = new URL(request.url);
  const payload = querySchema.parse(Object.fromEntries(url.searchParams));
  const context = await requireWiaApiContext(
    ["SUPER_ADMIN", "ADMIN", "MANAGER"],
    payload.companyId
  );
  if (context.response) return context.response;

  const events: Awaited<ReturnType<typeof exportClockEvents>> = context.demo
    ? []
    : await exportClockEvents(context.actor, new Date(payload.from), new Date(payload.to));
  const rows = [
    ["Employee", "Worksite", "City", "Event", "Date and time", "Method", "Location verified"],
    ...events.map((event) => [
      `${event.employee.user.firstName} ${event.employee.user.lastName}`.trim(),
      event.worksite.name,
      event.worksite.city,
      event.type,
      event.occurredAt.toISOString(),
      event.method,
      event.locationVerified,
    ]),
  ];
  const csv = `\ufeff${rows.map((row) => row.map(csvCell).join(";")).join("\n")}`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="wia-control-time-tracking-${payload.from.slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
});
