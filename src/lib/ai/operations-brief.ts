import "server-only";

import { generateText, gateway, Output } from "ai";
import { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import { listControlDay, type WiaActor } from "@/lib/wia-control/service";

const severitySchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

const briefSchema = z.object({
  headline: z.string().trim().min(10).max(220),
  summary: z.string().trim().min(20).max(900),
  priorities: z.array(z.object({
    shiftId: z.string().trim().min(1),
    severity: severitySchema,
    reason: z.string().trim().min(10).max(360),
    recommendedAction: z.string().trim().min(10).max(360),
  })).max(12),
  draftMessage: z.string().trim().min(20).max(700),
});

export type OperationsBrief = z.infer<typeof briefSchema>;

type BriefFact = {
  shiftId: string;
  service: string;
  worksite: string;
  startsAt: string;
  status: string;
  openIncidents: Array<{ severity: string; title: string; dueAt?: string }>;
  hasClockIn: boolean;
  hasClockOut: boolean;
};

export function isOperationsBriefEnabled() {
  return process.env.AI_OPERATIONS_BRIEF_ENABLED === "true" && Boolean(process.env.AI_GATEWAY_API_KEY);
}

function operationalFacts(day: Awaited<ReturnType<typeof listControlDay>>): BriefFact[] {
  return day.map((shift) => ({
    shiftId: shift.id,
    service: shift.service?.title ?? shift.title,
    worksite: shift.worksite.name,
    startsAt: shift.startsAt,
    status: shift.status,
    openIncidents: shift.incidents
      .filter((incident) => ["OPEN", "ACKNOWLEDGED"].includes(incident.status))
      .map((incident) => ({ severity: incident.severity, title: incident.title, dueAt: incident.dueAt })),
    hasClockIn: shift.clockEvents.some((event) => event.type === "CLOCK_IN"),
    hasClockOut: shift.clockEvents.some((event) => event.type === "CLOCK_OUT"),
  }));
}

export async function generateOperationsBrief(actor: WiaActor, date: string) {
  if (!isOperationsBriefEnabled()) {
    throw new Error("AI_NOT_CONFIGURED");
  }
  const facts = operationalFacts(await listControlDay(actor, date));
  const allowedShiftIds = new Set(facts.map((fact) => fact.shiftId));
  const { output } = await generateText({
    model: gateway("openai/gpt-5.4-mini"),
    system: "You are WIAControl's operations assistant. Work only from the supplied facts. Do not claim legal compliance, make employment decisions, assign employees, or invent missing information. Your output is an internal draft that requires human approval. Use concise professional English.",
    prompt: `Create an operations brief for ${date}. Use only these tenant-scoped operational facts. Do not mention employee names, GPS coordinates, or data not supplied.\n${JSON.stringify(facts)}`,
    output: Output.object({ schema: briefSchema, name: "operations_brief" }),
  });
  if (!output || output.priorities.some((priority) => !allowedShiftIds.has(priority.shiftId))) {
    throw new Error("AI_INVALID_OUTPUT");
  }

  await getPrisma().auditLog.create({
    data: {
      companyId: actor.companyId,
      userId: actor.userId,
      action: "ai.operations_brief.generated",
      entity: "OperationsBrief",
      entityId: date,
      metadata: { date, model: "openai/gpt-5.4-mini", sourceShiftCount: facts.length, priorityCount: output.priorities.length },
    },
  });
  return output;
}

export const __test__ = { operationalFacts };
