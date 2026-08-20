import { z } from "zod";
import { apiRoute } from "@/lib/http/api-route";
import { requireWiaApiContext } from "@/lib/wia-control/api-context";
import { buildExport, exportFileName } from "@/lib/wia-control/exports";
import { exportCoverageDecisions } from "@/lib/wia-control/service";

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
  const decisions = context.demo ? [] : await exportCoverageDecisions(context.actor, from, to);

  const { csv } = buildExport("coverage", decisions, (decision) => ({
    "Decision id": decision.id,
    "Decided at": decision.createdAt,
    Type: decision.type,
    "Incident id": decision.incidentId,
    Shift: decision.shift.title,
    Worksite: decision.shift.worksite.name,
    "Recommended employee": name(decision.recommendedEmployee?.user),
    "Selected employee": name(decision.selectedEmployee?.user),
    Score: decision.score,
    Reasons: decision.reasons.join(" | "),
    "Override reason": decision.overrideReason,
    "Decided by": name(decision.actor),
  }));

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFileName("coverage", from, to)}"`,
      "Cache-Control": "no-store",
    },
  });
});
