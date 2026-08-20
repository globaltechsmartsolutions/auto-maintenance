import { WiaDomainError } from "@/lib/wia-control/domain-core";

/**
 * The gate every AI feature passes through.
 *
 * AI is off by default at four independent levels: the environment must be
 * configured, the company must have turned the specific feature on, no kill
 * switch may be set, and the call must fit inside the company's rate limit and
 * its authorised monthly token budget. Any one of them refusing is enough, and
 * each refusal has its own code so the reason is never guessed at.
 *
 * The decision itself is pure. The caller supplies the facts; nothing here
 * reads the database, so every path can be tested exhaustively.
 */

export const aiFeatures = [
  "operations_brief",
  "incident_communication_draft",
  "risk_explanation",
] as const;

export type AiFeature = (typeof aiFeatures)[number];

/** Calls per company per feature per hour. Deliberately small for a pilot. */
export const AI_HOURLY_REQUEST_LIMIT = 30;

export type AiGateFacts = {
  feature: AiFeature;
  /** Provider credentials and the environment-level enablement flag. */
  environmentConfigured: boolean;
  /** Global stop, independent of any company's configuration. */
  globalKillSwitch: boolean;
  /** Features this company has explicitly enabled. */
  companyFeatures: string[];
  /** Set when this company's AI has been stopped. */
  companyDisabledAt?: Date | null;
  /** Company's authorised token ceiling for the current calendar month. */
  monthlyTokenBudget: number;
  /** Tokens already spent this calendar month. */
  monthlyTokensUsed: number;
  /** Calls made for this feature in the last hour. */
  requestsLastHour: number;
};

export type AiGateDecision =
  | { allowed: true }
  | { allowed: false; code: string; message: string };

export function evaluateAiGate(facts: AiGateFacts): AiGateDecision {
  if (facts.globalKillSwitch) {
    return {
      allowed: false,
      code: "AI_KILL_SWITCH",
      message: "AI features are stopped for every workspace.",
    };
  }
  if (!facts.environmentConfigured) {
    return {
      allowed: false,
      code: "AI_NOT_CONFIGURED",
      message: "No AI provider is configured for this environment.",
    };
  }
  if (facts.companyDisabledAt) {
    return {
      allowed: false,
      code: "AI_DISABLED_FOR_COMPANY",
      message: "AI features are stopped for this workspace.",
    };
  }
  if (!facts.companyFeatures.includes(facts.feature)) {
    return {
      allowed: false,
      code: "AI_FEATURE_NOT_ENABLED",
      message: `This workspace has not enabled ${facts.feature.replace(/_/g, " ")}.`,
    };
  }
  if (facts.monthlyTokenBudget <= 0) {
    return {
      allowed: false,
      code: "AI_BUDGET_NOT_AUTHORISED",
      message: "This workspace has no authorised AI budget.",
    };
  }
  if (facts.monthlyTokensUsed >= facts.monthlyTokenBudget) {
    return {
      allowed: false,
      code: "AI_BUDGET_EXHAUSTED",
      message: "This workspace has used its authorised AI budget for the month.",
    };
  }
  if (facts.requestsLastHour >= AI_HOURLY_REQUEST_LIMIT) {
    return {
      allowed: false,
      code: "AI_RATE_LIMITED",
      message: `This workspace has reached ${AI_HOURLY_REQUEST_LIMIT} AI requests in an hour.`,
    };
  }
  return { allowed: true };
}

export function assertAiGate(facts: AiGateFacts) {
  const decision = evaluateAiGate(facts);
  if (!decision.allowed) {
    throw new WiaDomainError(decision.code, decision.message);
  }
}

/**
 * The audit convention: one action name per feature and outcome, so an AI event
 * is greppable and countable without parsing free text.
 */
export function aiAuditAction(feature: AiFeature, outcome: AiOutcome) {
  return `ai.${feature}.${outcome}`;
}

export type AiOutcome = "generated" | "refused" | "failed" | "approved" | "cancelled" | "edited";

export function isGlobalAiKillSwitchOn() {
  return process.env.AI_KILL_SWITCH === "true";
}

export function isAiEnvironmentConfigured() {
  return Boolean(process.env.AI_GATEWAY_API_KEY) && process.env.AI_FEATURES_ENABLED === "true";
}

/** The month a usage figure belongs to, in UTC. */
export function monthStart(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export function hourStart(now: Date) {
  return new Date(now.getTime() - 60 * 60_000);
}
