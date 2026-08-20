import "server-only";

import { generateText, gateway, Output } from "ai";
import { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import { type WiaActor } from "@/lib/wia-control/service";
import { isOperationsBriefEnabled } from "@/lib/ai/operations-brief";

const audienceSchema = z.enum(["INTERNAL_COORDINATION", "CUSTOMER_UPDATE"]);
const draftSchema = z.object({
  subject: z.string().trim().min(5).max(160),
  message: z.string().trim().min(30).max(1_200),
});

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

export async function generateIncidentCommunicationDraft(actor: WiaActor, incidentId: string, audience: IncidentDraftAudience) {
  if (!isOperationsBriefEnabled()) throw new Error("AI_NOT_CONFIGURED");
  const prisma = getPrisma();
  const incident = await prisma.attendanceIncident.findFirst({
    where: { id: incidentId, companyId: actor.companyId },
    select: { id: true, type: true, severity: true, status: true, detectedAt: true, dueAt: true, employeeId: true, worksite: { select: { name: true } }, shift: { select: { title: true } } },
  });
  if (!incident) throw new Error("INCIDENT_NOT_FOUND");
  const facts: IncidentDraftFacts = { incidentId: incident.id, type: incident.type, severity: incident.severity, status: incident.status, worksite: incident.worksite.name, shift: incident.shift.title, detectedAt: incident.detectedAt.toISOString(), ...(incident.dueAt ? { dueAt: incident.dueAt.toISOString() } : {}), hasAssignedEmployee: Boolean(incident.employeeId) };
  const audienceInstruction = audience === "CUSTOMER_UPDATE" ? "Write a calm, factual customer update. Do not disclose employee information or make promises." : "Write a concise internal coordination update with a clear request for human follow-up.";
  const { output } = await generateText({
    model: gateway("openai/gpt-5.4-mini"),
    system: "You are WIAControl's operations assistant. Work only from supplied facts. Do not invent events, claim legal compliance, make employment decisions, assign staff, or state that a message was sent. Produce an English draft requiring human approval.",
    prompt: `${audienceInstruction} Do not expose employee names, incident free text, GPS data, addresses, or internal identifiers.\n${JSON.stringify(facts)}`,
    output: Output.object({ schema: draftSchema, name: "incident_communication_draft" }),
  });
  if (!output) throw new Error("AI_INVALID_OUTPUT");
  await prisma.auditLog.create({ data: { companyId: actor.companyId, userId: actor.userId, action: "ai.incident_communication_draft.generated", entity: "AttendanceIncident", entityId: incident.id, metadata: { audience, model: "openai/gpt-5.4-mini", sourceFields: Object.keys(facts) } } });
  return output;
}

export const __test__ = { audienceSchema };
