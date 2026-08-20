import "server-only";

import { generateText, gateway, Output } from "ai";
import { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import { WiaDomainError } from "@/lib/wia-control/domain";
import { type WiaActor } from "@/lib/wia-control/service";
import { runGuardedAiCall } from "@/lib/ai/usage";
import { assertSafeAiOutput } from "@/lib/ai/evaluation";
import { storeIncidentDraft } from "@/lib/ai/communication-workflow";

const audienceSchema = z.enum(["INTERNAL_COORDINATION", "CUSTOMER_UPDATE"]);
const draftSchema = z.object({
  subject: z.string().trim().min(5).max(160),
  message: z.string().trim().min(30).max(1_200),
});

export const AI_DRAFT_MODEL = "openai/gpt-5.4-mini";

export type IncidentDraftAudience = z.infer<typeof audienceSchema>;
export type IncidentCommunicationDraft = z.infer<typeof draftSchema>;

type IncidentDraftFacts = {
  incidentId: string;
  type: string;
  severity: string;
  status: string;
  worksite: string;
  shift: string;
  detectedAt: string;
  dueAt?: string;
  hasAssignedEmployee: boolean;
};

/**
 * Produces a draft message about an incident and stores it for human approval.
 *
 * Three things bound it. The gate decides whether this workspace may call AI at
 * all; the model receives only the minimised facts below, never names, free
 * text, or coordinates; and the output is checked for leaked terms, invented
 * references, claimed actions, and legal or employment claims before it is
 * stored. Nothing here sends anything.
 */
export async function generateIncidentCommunicationDraft(
  actor: WiaActor,
  incidentId: string,
  audience: IncidentDraftAudience
) {
  const prisma = getPrisma();
  const incident = await prisma.attendanceIncident.findFirst({
    where: { id: incidentId, companyId: actor.companyId },
    select: {
      id: true,
      type: true,
      severity: true,
      status: true,
      detectedAt: true,
      dueAt: true,
      employeeId: true,
      worksite: { select: { name: true } },
      shift: { select: { title: true } },
      employee: { select: { user: { select: { firstName: true, lastName: true } } } },
    },
  });
  if (!incident) {
    throw new WiaDomainError("INCIDENT_NOT_FOUND", "The incident does not belong to this workspace.");
  }

  const facts: IncidentDraftFacts = {
    incidentId: incident.id,
    type: incident.type,
    severity: incident.severity,
    status: incident.status,
    worksite: incident.worksite.name,
    shift: incident.shift.title,
    detectedAt: incident.detectedAt.toISOString(),
    ...(incident.dueAt ? { dueAt: incident.dueAt.toISOString() } : {}),
    hasAssignedEmployee: Boolean(incident.employeeId),
  };

  // The affected person's name is never sent to the model, so it must never
  // come back either.
  const forbiddenTerms = incident.employee
    ? [
        `${incident.employee.user.firstName} ${incident.employee.user.lastName}`.trim(),
        incident.employee.user.firstName,
        incident.employee.user.lastName,
      ]
    : [];

  const audienceInstruction =
    audience === "CUSTOMER_UPDATE"
      ? "Write a calm, factual customer update. Do not disclose employee information or make promises."
      : "Write a concise internal coordination update with a clear request for human follow-up.";

  const draft = await runGuardedAiCall(
    {
      actor,
      feature: "incident_communication_draft",
      model: AI_DRAFT_MODEL,
      entity: { entity: "AttendanceIncident", entityId: incident.id },
      metadata: { audience, sourceFields: Object.keys(facts) },
    },
    async () => {
      const { output, usage } = await generateText({
        model: gateway(AI_DRAFT_MODEL),
        system:
          "You are WIAControl's operations assistant. Work only from supplied facts. Do not invent events, claim legal compliance, make employment decisions, assign staff, or state that a message was sent. Produce an English draft requiring human approval.",
        prompt: `${audienceInstruction} Do not expose employee names, incident free text, GPS data, addresses, or internal identifiers.\n${JSON.stringify(facts)}`,
        output: Output.object({ schema: draftSchema, name: "incident_communication_draft" }),
      });
      if (!output) {
        throw new WiaDomainError("AI_INVALID_OUTPUT", "The model did not return a usable draft.");
      }
      assertSafeAiOutput(`${output.subject}\n${output.message}`, {
        allowedIds: [incident.id],
        forbiddenTerms,
      });
      return {
        result: output,
        tokens: {
          promptTokens: usage?.inputTokens ?? 0,
          completionTokens: usage?.outputTokens ?? 0,
        },
      };
    }
  );

  return storeIncidentDraft({
    actor,
    incidentId: incident.id,
    audience,
    model: AI_DRAFT_MODEL,
    subject: draft.subject,
    message: draft.message,
  });
}

export const __test__ = { audienceSchema };
