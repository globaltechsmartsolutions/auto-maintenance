import { hasDatabaseConfig, hasSupabaseConfig, isDemoMode } from "@/lib/demo-mode";
import { apiRoute } from "@/lib/http/api-route";
import { getPrisma } from "@/lib/prisma";
import { summariseHealth, type HealthCheck } from "@/lib/observability";
import { getGlobalCommunicationHealth } from "@/lib/wia-control/service";

export const dynamic = "force-dynamic";

/**
 * One answer for an uptime monitor, and enough detail for a person.
 *
 * `failing` (503) means the product cannot serve its core promise and someone
 * should be paged. `degraded` (207) means it can, but something needs
 * attention — a message that gave up, an evidence file past retention that the
 * job could not delete. The distinction exists so an outbox backlog does not
 * wake anyone at 3am while a database outage does.
 */
export const GET = apiRoute(async () => {
  if (isDemoMode()) {
    return Response.json(
      { status: "ok", mode: "demo", database: "local", checks: [] },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  const checks: HealthCheck[] = [
    {
      name: "database",
      status: hasDatabaseConfig() ? "ok" : "failing",
      detail: hasDatabaseConfig() ? undefined : "DATABASE_URL is not configured.",
    },
    {
      name: "authentication",
      status: hasSupabaseConfig() ? "ok" : "failing",
      detail: hasSupabaseConfig() ? undefined : "Supabase is not configured.",
    },
  ];

  if (hasDatabaseConfig()) {
    try {
      await getPrisma().$queryRaw`SELECT 1`;
    } catch {
      checks[0] = { name: "database", status: "failing", detail: "The database did not answer." };
    }
  }

  if (checks.every((check) => check.status === "ok")) {
    const outbox = await getGlobalCommunicationHealth();
    checks.push({
      name: "communications",
      status: outbox.needsAttention ? "degraded" : "ok",
      detail: outbox.needsAttention
        ? `${outbox.failed} failed, oldest pending ${outbox.oldestPendingMinutes ?? 0} min.`
        : undefined,
    });

    const overdueEvidence = await getPrisma().evidenceAttachment.count({
      where: { retentionUntil: { lte: new Date() }, deletedAt: null },
    });
    checks.push({
      name: "evidence_retention",
      status: overdueEvidence > 0 ? "degraded" : "ok",
      detail: overdueEvidence > 0 ? `${overdueEvidence} files are past their retention date.` : undefined,
    });
  }

  const summary = summariseHealth(checks);
  return Response.json(
    { status: summary.status, mode: "production", attention: summary.attention, checks: summary.checks },
    { status: summary.httpStatus, headers: { "Cache-Control": "no-store" } }
  );
});
