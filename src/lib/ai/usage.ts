import "server-only";

import { getPrisma } from "@/lib/prisma";
import { WiaDomainError } from "@/lib/wia-control/domain";
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
      // call happened and on what, not the personal data inside it.
      metadata: { model: input.model, outcome: input.outcome, ...input.metadata },
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

  try {
    const { result, tokens } = await call();
    await recordAiUsage({
      actor: input.actor,
      feature: input.feature,
      model: input.model,
      outcome: "generated",
      tokens,
      entity: input.entity,
      metadata: input.metadata,
    });
    return result;
  } catch (error) {
    await recordAiUsage({
      actor: input.actor,
      feature: input.feature,
      model: input.model,
      outcome: "failed",
      detail: error instanceof Error ? error.message : "The AI call failed.",
      entity: input.entity,
      metadata: input.metadata,
    });
    throw error;
  }
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
