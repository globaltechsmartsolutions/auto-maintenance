import { z } from "zod";
import { WiaDomainError } from "@/lib/wia-control/domain-core";

/**
 * Versioned cleaning delivery templates.
 *
 * A field worker answers the same questions every time, and a manager can
 * later prove *which* version of those questions was answered. Templates are
 * therefore code, not customer-editable data: every published version stays in
 * this registry forever so an old submission remains readable exactly as it was
 * captured, while only the active version may be submitted today.
 */

export const templateKeySchema = z.enum([
  "OPENING_CHECK",
  "COMMON_AREAS",
  "INCIDENT_NOTE",
  "COMPLETION_CONFIRMATION",
]);
export type TemplateKey = z.infer<typeof templateKeySchema>;

export type TemplateField =
  | { key: string; label: string; type: "boolean"; required: boolean }
  | { key: string; label: string; type: "text"; required: boolean; maxLength: number; minLength?: number }
  | { key: string; label: string; type: "number"; required: boolean; min: number; max: number }
  | { key: string; label: string; type: "choice"; required: boolean; options: string[] };

export type DeliveryTemplate = {
  key: TemplateKey;
  version: number;
  title: string;
  description: string;
  fields: TemplateField[];
};

/**
 * Every published version, newest last. Never edit a published entry: add a new
 * version instead, or a submission's stored answers stop matching the questions
 * that produced them.
 */
const registry: DeliveryTemplate[] = [
  {
    key: "OPENING_CHECK",
    version: 1,
    title: "Opening check",
    description: "Completed on arrival, before the work starts.",
    fields: [
      { key: "siteAccessed", label: "Access to the site was obtained", type: "boolean", required: true },
      { key: "keysCollected", label: "Keys or access device collected", type: "boolean", required: false },
      { key: "suppliesAvailable", label: "Materials and supplies available", type: "boolean", required: true },
      { key: "blockers", label: "Anything blocking the work", type: "text", required: false, maxLength: 500 },
    ],
  },
  {
    key: "COMMON_AREAS",
    version: 1,
    title: "Common areas check",
    description: "The recurring cleaning scope for a shared building.",
    fields: [
      { key: "entranceCleaned", label: "Entrance and lobby cleaned", type: "boolean", required: true },
      { key: "stairsCleaned", label: "Stairs and landings cleaned", type: "boolean", required: true },
      { key: "liftCleaned", label: "Lift cleaned", type: "boolean", required: false },
      { key: "wasteRemoved", label: "Waste removed", type: "boolean", required: true },
      { key: "areasSkipped", label: "Areas that could not be done, and why", type: "text", required: false, maxLength: 500 },
    ],
  },
  {
    key: "INCIDENT_NOTE",
    version: 1,
    title: "Incident note",
    description: "Anything the coordinator or the customer needs to know about.",
    fields: [
      {
        key: "incidentType",
        label: "What kind of incident",
        type: "choice",
        required: true,
        options: ["ACCESS", "DAMAGE", "SAFETY", "MATERIALS", "OTHER"],
      },
      { key: "description", label: "What happened", type: "text", required: true, minLength: 10, maxLength: 2_000 },
      { key: "immediateAction", label: "What was done straight away", type: "text", required: false, maxLength: 1_000 },
      { key: "customerInformed", label: "The customer was informed on site", type: "boolean", required: true },
    ],
  },
  {
    key: "COMPLETION_CONFIRMATION",
    version: 1,
    title: "Completion confirmation",
    description: "Closes the visit and states what was delivered.",
    fields: [
      {
        key: "outcome",
        label: "Outcome of the visit",
        type: "choice",
        required: true,
        options: ["COMPLETED", "PARTIALLY_COMPLETED", "NOT_COMPLETED"],
      },
      { key: "minutesOnSite", label: "Minutes on site", type: "number", required: true, min: 0, max: 1_440 },
      { key: "customerSignatureCollected", label: "Customer signature collected", type: "boolean", required: false },
      { key: "note", label: "Note for the coordinator", type: "text", required: false, maxLength: 1_000 },
    ],
  },
];

export function listActiveTemplates(): DeliveryTemplate[] {
  return templateKeySchema.options.map((key) => activeTemplate(key));
}

export function activeTemplate(key: TemplateKey): DeliveryTemplate {
  const versions = registry.filter((template) => template.key === key);
  const latest = versions[versions.length - 1];
  if (!latest) {
    throw new WiaDomainError("TEMPLATE_NOT_FOUND", `There is no template called ${key}.`);
  }
  return latest;
}

/** Any published version, so an old submission stays readable. */
export function findTemplate(key: TemplateKey, version: number): DeliveryTemplate | undefined {
  return registry.find((template) => template.key === key && template.version === version);
}

export type TemplateAnswerValue = string | number | boolean;

export const templateSubmissionSchema = z.object({
  shiftId: z.string().trim().min(1).max(160),
  templateKey: templateKeySchema,
  templateVersion: z.number().int().min(1).max(1_000),
  /**
   * Generated on the device when the worker taps submit and reused for every
   * retry, exactly like the offline clock queue's idempotency key. It is what
   * makes an offline submission safe to resend.
   */
  clientSubmissionId: z.string().trim().min(8).max(120),
  answers: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  submittedAt: z.string().datetime({ offset: true }).optional(),
});

export type TemplateSubmissionInput = z.infer<typeof templateSubmissionSchema>;

export type TemplateAnswerIssue = { field: string; message: string };

export class TemplateValidationError extends WiaDomainError {
  constructor(public readonly issues: TemplateAnswerIssue[]) {
    super("TEMPLATE_ANSWERS_INVALID", issues.map((issue) => `${issue.field}: ${issue.message}`).join(" "));
    this.name = "TemplateValidationError";
  }
}

/**
 * Validates answers against the exact template version they claim, and returns
 * them normalised into template field order. Unknown keys are dropped rather
 * than stored, so a submission can never carry data the template did not ask
 * for — which is also what keeps the answers minimised.
 */
export function validateTemplateAnswers(
  key: TemplateKey,
  version: number,
  answers: Record<string, TemplateAnswerValue>
) {
  const template = findTemplate(key, version);
  if (!template) {
    throw new WiaDomainError(
      "TEMPLATE_VERSION_NOT_FOUND",
      `Template ${key} has no published version ${version}.`
    );
  }

  const issues: TemplateAnswerIssue[] = [];
  const normalised: Record<string, TemplateAnswerValue> = {};

  for (const field of template.fields) {
    const value = answers[field.key];
    const missing = value === undefined || value === null || value === "";

    if (missing) {
      if (field.required) issues.push({ field: field.key, message: "This answer is required." });
      continue;
    }

    if (field.type === "boolean") {
      if (typeof value !== "boolean") {
        issues.push({ field: field.key, message: "Answer yes or no." });
        continue;
      }
      normalised[field.key] = value;
      continue;
    }

    if (field.type === "number") {
      const numeric = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(numeric) || numeric < field.min || numeric > field.max) {
        issues.push({ field: field.key, message: `Use a number between ${field.min} and ${field.max}.` });
        continue;
      }
      normalised[field.key] = numeric;
      continue;
    }

    if (field.type === "choice") {
      if (typeof value !== "string" || !field.options.includes(value)) {
        issues.push({ field: field.key, message: `Choose one of: ${field.options.join(", ")}.` });
        continue;
      }
      normalised[field.key] = value;
      continue;
    }

    const text = String(value).trim();
    if (field.minLength && text.length < field.minLength) {
      issues.push({ field: field.key, message: `Use at least ${field.minLength} characters.` });
      continue;
    }
    if (text.length > field.maxLength) {
      issues.push({ field: field.key, message: `Use at most ${field.maxLength} characters.` });
      continue;
    }
    normalised[field.key] = text;
  }

  if (issues.length) throw new TemplateValidationError(issues);
  return { template, answers: normalised };
}

/**
 * Only the current version may be submitted. An outdated device is told to
 * refresh rather than silently writing answers to superseded questions.
 */
export function assertSubmittableVersion(key: TemplateKey, version: number) {
  const active = activeTemplate(key);
  if (active.version !== version) {
    throw new WiaDomainError(
      "TEMPLATE_VERSION_OUTDATED",
      `Template ${key} is now at version ${active.version}. Reload the form before submitting.`
    );
  }
  return active;
}

/**
 * One readable line per answer, using the labels of the version that was
 * actually answered. Used by the evidence export so a customer can read a
 * submission without knowing the field keys.
 */
export function describeSubmission(
  key: TemplateKey,
  version: number,
  answers: Record<string, TemplateAnswerValue>
) {
  const template = findTemplate(key, version);
  if (!template) return `${key} v${version}: the template version is no longer published.`;
  const parts = template.fields
    .filter((field) => answers[field.key] !== undefined)
    .map((field) => {
      const value = answers[field.key];
      const rendered = typeof value === "boolean" ? (value ? "yes" : "no") : String(value);
      return `${field.label}: ${rendered}`;
    });
  return `${template.title} v${template.version} — ${parts.join(" | ")}`;
}
