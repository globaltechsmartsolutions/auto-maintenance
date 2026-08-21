import { hasDatabaseConfig, hasSupabaseConfig, isDemoMode } from "@/lib/demo-mode";
import { apiRoute } from "@/lib/http/api-route";
import { getPrisma } from "@/lib/prisma";
import { summariseHealth, type HealthCheck } from "@/lib/observability";
import { getGlobalCommunicationHealth } from "@/lib/wia-control/service";

export const dynamic = "force-dynamic";

/**
 * Liveness for an uptime monitor, and operational detail for whoever operates
 * the deployment.
 *
 * The public answer is deliberately thin: whether the database and
 * authentication are reachable, and nothing else. Counts of failed messages or
 * pending evidence are business signal, and they cost a database query each, so
 * an unauthenticated caller gets neither.
 *
 * Presenting the cron secret — the same one the scheduled jobs already use —
 * adds the operational checks. **503** means the product cannot serve its core
 * promise and someone should be paged; **207** means it is serving normally but
 * something needs a person today. That distinction is why an outbox backlog
 * does not wake anyone at 3am while a database outage does.
 */
function isOperator(request: Request) {
  const expected = process.env.CRON_SECRET;
  return Boolean(expected) && request.headers.get("authorization") === `Bearer ${expected}`;
}

export const GET = apiRoute(async (request: Request) => {
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

  // Only an operator gets the operational detail, and only once the basics are
  // reachable — there is nothing to measure through a database that is down.
  if (isOperator(request) && checks.every((check) => check.status === "ok")) {
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
