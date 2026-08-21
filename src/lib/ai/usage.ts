import "server-only";

import { getPrisma } from "@/lib/prisma";
import { WiaDomainError } from "@/lib/wia-control/domain";
import { redactLogFields } from "@/lib/observability";
import type { WiaActor } from "@/lib/wia-control/service";
import {
  aiAuditAction,
  assertAiGate,
  hourStart,
  isAiEnvironmentConfigured,
  isGlobalAiKillSwitchOn,
  monthStart,
  type AiFeature,
  type AiGateFacts,
  type AiOutcome,
} from "@/lib/ai/governance";

/**
 * Reads the facts the gate needs, runs the gate, and records what happened.
 *
 * Every AI call leaves a usage record — including the ones that were refused —
 * because "how often did we refuse, and why" is exactly what has to be reviewed
 * before this is offered to a customer.
 */

export type AiTokenUsage = { promptTokens?: number; completionTokens?: number };

export async function loadAiGateFacts(
  actor: WiaActor,
  feature: AiFeature,
  now = new Date()
): Promise<AiGateFacts> {
  if (!actor.companyId) {
    throw new WiaDomainError("COMPANY_REQUIRED", "The operation requires an active company.");
  }
  const prisma = getPrisma();
  const company = await prisma.company.findUnique({
    where: { id: actor.companyId },
    select: { aiFeatures: true, aiMonthlyTokenBudget: true, aiDisabledAt: true },
  });

  const [monthly, requestsLastHour] = await Promise.all([
    prisma.aiUsageRecord.aggregate({
      where: { companyId: actor.companyId, createdAt: { gte: monthStart(now) } },
      _sum: { promptTokens: true, completionTokens: true },
    }),
    prisma.aiUsageRecord.count({
      where: { companyId: actor.companyId, feature, createdAt: { gte: hourStart(now) } },
    }),
  ]);

  return {
    feature,
    environmentConfigured: isAiEnvironmentConfigured(),
    globalKillSwitch: isGlobalAiKillSwitchOn(),
    companyFeatures: company?.aiFeatures ?? [],
    companyDisabledAt: company?.aiDisabledAt ?? null,
    monthlyTokenBudget: company?.aiMonthlyTokenBudget ?? 0,
    monthlyTokensUsed:
      (monthly._sum.promptTokens ?? 0) + (monthly._sum.completionTokens ?? 0),
    requestsLastHour,
  };
}

export async function recordAiUsage(input: {
  actor: WiaActor;
  feature: AiFeature;
  model: string;
  outcome: AiOutcome;
  tokens?: AiTokenUsage;
  detail?: string;
  entity?: { entity: string; entityId: string };
  metadata?: Record<string, unknown>;
}) {
  const prisma = getPrisma();
  await prisma.aiUsageRecord.create({
    data: {
      companyId: input.actor.companyId,
      userId: input.actor.userId,
      feature: input.feature,
      model: input.model,
      outcome: input.outcome,
      promptTokens: input.tokens?.promptTokens ?? 0,
      completionTokens: input.tokens?.completionTokens ?? 0,
      detail: input.detail?.slice(0, 500),
    },
  });
  await prisma.auditLog.create({
    data: {
      companyId: input.actor.companyId,
      userId: input.actor.userId,
      action: aiAuditAction(input.feature, input.outcome),
      entity: input.entity?.entity ?? "AiUsageRecord",
      entityId: input.entity?.entityId ?? input.feature,
      // Never the prompt or the model's text: an audit entry records that a
      // call happened and on what, not the personal data inside it. Caller
      // metadata passes the same redaction as a log line, because "do not put
      // personal data in here" cannot rely on every future caller remembering.
      metadata: {
        model: input.model,
        outcome: input.outcome,
        ...(redactLogFields(input.metadata ?? {}) as Record<string, unknown>),
      },
    },
  });
}

/**
 * Runs one AI call behind the gate. A refusal is recorded and rethrown before
 * any provider is contacted, and a provider failure is recorded too, so a
 * silent AI outage is impossible to have without evidence.
 */
export async function runGuardedAiCall<TResult>(
  input: {
    actor: WiaActor;
    feature: AiFeature;
    model: string;
    entity?: { entity: string; entityId: string };
    metadata?: Record<string, unknown>;
    now?: Date;
  },
  call: () => Promise<{ result: TResult; tokens?: AiTokenUsage }>
): Promise<TResult> {
  const now = input.now ?? new Date();
  const prisma = getPrisma();
  const facts = await loadAiGateFacts(input.actor, input.feature, now);

  try {
    assertAiGate(facts);
  } catch (error) {
    await recordAiUsage({
      actor: input.actor,
      feature: input.feature,
      model: input.model,
      outcome: "refused",
      detail: error instanceof Error ? error.message : "Refused by the AI gate.",
      entity: input.entity,
      metadata: input.metadata,
    });
    throw error;
  }

  // The usage row is written BEFORE the provider is contacted, so a call that
  // is still in flight is visible to every other request's gate read. Without
  // it, thirty simultaneous requests each read the same "29 so far" and all
  // thirty went through.
  //
  // Honest about what this does and does not fix: the hourly rate limit is now
  // enforced against calls in flight. The token budget still cannot be, because
  // the cost of a call is not known until it returns, so a burst can overshoot
  // the budget by whatever those concurrent calls end up spending. Closing that
  // properly needs a reserved-token counter, and is recorded as such.
  const reservation = await prisma.aiUsageRecord.create({
    data: {
      companyId: input.actor.companyId,
      userId: input.actor.userId,
      feature: input.feature,
      model: input.model,
      outcome: "started",
    },
    select: { id: true },
  });

  try {
    const { result, tokens } = await call();

    // Re-read after the call: a kill switch pulled while the provider was
    // working must stop the output being used, not merely the next request.
    if (isGlobalAiKillSwitchOn()) {
      await prisma.aiUsageRecord.update({
        where: { id: reservation.id },
        data: {
          outcome: "refused",
          detail: "Stopped by the kill switch while the call was in flight.",
          promptTokens: tokens?.promptTokens ?? 0,
          completionTokens: tokens?.completionTokens ?? 0,
        },
      });
      await writeAiAudit(input, "refused");
      throw new WiaDomainError(
        "AI_KILL_SWITCH",
        "AI features were stopped while this request was running."
      );
    }

    await prisma.aiUsageRecord.update({
      where: { id: reservation.id },
      data: {
        outcome: "generated",
        promptTokens: tokens?.promptTokens ?? 0,
        completionTokens: tokens?.completionTokens ?? 0,
      },
    });
    await writeAiAudit(input, "generated");
    return result;
  } catch (error) {
    if (error instanceof WiaDomainError && error.code === "AI_KILL_SWITCH") throw error;
    await prisma.aiUsageRecord.update({
      where: { id: reservation.id },
      data: {
        outcome: "failed",
        detail: (error instanceof Error ? error.message : "The AI call failed.").slice(0, 500),
      },
    });
    await writeAiAudit(input, "failed");
    throw error;
  }
}

async function writeAiAudit(
  input: {
    actor: WiaActor;
    feature: AiFeature;
    model: string;
    entity?: { entity: string; entityId: string };
    metadata?: Record<string, unknown>;
  },
  outcome: AiOutcome
) {
  await getPrisma().auditLog.create({
    data: {
      companyId: input.actor.companyId,
      userId: input.actor.userId,
      action: aiAuditAction(input.feature, outcome),
      entity: input.entity?.entity ?? "AiUsageRecord",
      entityId: input.entity?.entityId ?? input.feature,
      metadata: {
        model: input.model,
        outcome,
        ...(redactLogFields(input.metadata ?? {}) as Record<string, unknown>),
      },
    },
  });
}

/** What the workspace has spent and how its calls ended, for the pilot review. */
export async function getAiUsageSummary(actor: WiaActor, now = new Date()) {
  if (!actor.companyId) {
    throw new WiaDomainError("COMPANY_REQUIRED", "The operation requires an active company.");
  }
  if (!actor.userId || !["SUPER_ADMIN", "ADMIN"].includes(actor.role)) {
    throw new WiaDomainError("FORBIDDEN", "Only an administrator can review AI usage.");
  }
  const prisma = getPrisma();
  const since = monthStart(now);

  const [company, totals, byOutcome] = await Promise.all([
    prisma.company.findUnique({
      where: { id: actor.companyId },
      select: { aiFeatures: true, aiMonthlyTokenBudget: true, aiDisabledAt: true },
    }),
    prisma.aiUsageRecord.aggregate({
      where: { companyId: actor.companyId, createdAt: { gte: since } },
      _sum: { promptTokens: true, completionTokens: true },
      _count: true,
    }),
    prisma.aiUsageRecord.groupBy({
      by: ["feature", "outcome"],
      where: { companyId: actor.companyId, createdAt: { gte: since } },
      _count: true,
    }),
  ]);

  const tokensUsed = (totals._sum.promptTokens ?? 0) + (totals._sum.completionTokens ?? 0);
  const budget = company?.aiMonthlyTokenBudget ?? 0;

  return {
    monthStart: since,
    enabledFeatures: company?.aiFeatures ?? [],
    stopped: Boolean(company?.aiDisabledAt),
    globalKillSwitch: isGlobalAiKillSwitchOn(),
    environmentConfigured: isAiEnvironmentConfigured(),
    tokenBudget: budget,
    tokensUsed,
    tokensRemaining: Math.max(0, budget - tokensUsed),
    calls: totals._count,
    byOutcome: byOutcome.map((row) => ({
      feature: row.feature,
      outcome: row.outcome,
      count: row._count,
    })),
  };
}
