import "server-only";

import { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import { WiaDomainError } from "@/lib/wia-control/domain";
import type { WiaActor } from "@/lib/wia-control/service";
import { aiAuditAction } from "@/lib/ai/governance";
import { assertSafeAiOutput } from "@/lib/ai/evaluation";
import {
  activeCommunicationTemplate,
  communicationDedupeKey,
} from "@/lib/wia-control/communication-policy";

/**
 * The human approval path for an AI-written message.
 *
 * A draft is stored, not sent. A coordinator may rewrite it freely; approving
 * it copies the text that person accepted into the communication outbox and
 * records who approved it and what they approved. Nothing here can put a
 * message in front of a recipient without a named human, and the generated text
 * is kept beside the final text so the two can always be compared.
 */

const editSchema = z.object({
  subject: z.string().trim().min(5).max(160),
  message: z.string().trim().min(30).max(1_200),
});

const approvalSchema = z.object({
  /** The coordinator must restate what they are approving. */
  subject: z.string().trim().min(5).max(160),
  message: z.string().trim().min(30).max(1_200),
  /** Who receives it. Omitted means the incident's own affected employee. */
  recipientEmployeeId: z.string().trim().min(1).max(160).optional(),
});

function assertCoordinator(actor: WiaActor) {
  if (!actor.companyId) {
    throw new WiaDomainError("COMPANY_REQUIRED", "The operation requires an active company.");
  }
  if (!actor.userId || !["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(actor.role)) {
    throw new WiaDomainError("FORBIDDEN", "Only a coordinator can handle AI communication drafts.");
  }
}

export async function storeIncidentDraft(input: {
  actor: WiaActor;
  incidentId: string;
  audience: string;
  model: string;
  subject: string;
  message: string;
}) {
  assertCoordinator(input.actor);
  const prisma = getPrisma();
  const incident = await prisma.attendanceIncident.findFirst({
    where: { id: input.incidentId, companyId: input.actor.companyId },
    select: { id: true },
  });
  if (!incident) {
    throw new WiaDomainError("INCIDENT_NOT_FOUND", "The incident does not belong to this workspace.");
  }

  return prisma.aiCommunicationDraft.create({
    data: {
      companyId: input.actor.companyId,
      incidentId: incident.id,
      audience: input.audience,
      model: input.model,
      generatedSubject: input.subject,
      generatedMessage: input.message,
      // The final text starts as the generated text and is whatever the
      // approver last saved; the generated columns are never overwritten.
      finalSubject: input.subject,
      finalMessage: input.message,
      createdByUserId: input.actor.userId,
    },
    select: { id: true, finalSubject: true, finalMessage: true, status: true },
  });
}

export async function listIncidentDrafts(actor: WiaActor, incidentId: string) {
  assertCoordinator(actor);
  return getPrisma().aiCommunicationDraft.findMany({
    where: { companyId: actor.companyId, incidentId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      audience: true,
      model: true,
      status: true,
      generatedSubject: true,
      generatedMessage: true,
      finalSubject: true,
      finalMessage: true,
      approvedAt: true,
      cancelledAt: true,
      outboxId: true,
      createdAt: true,
      approvedBy: { select: { firstName: true, lastName: true } },
    },
  });
}

/** A coordinator's edit. The generated text stays untouched for comparison. */
export async function editIncidentDraft(actor: WiaActor, draftId: string, input: unknown) {
  assertCoordinator(actor);
  const payload = editSchema.parse(input);
  const prisma = getPrisma();

  const draft = await prisma.aiCommunicationDraft.findFirst({
    where: { id: draftId, companyId: actor.companyId },
    select: { id: true, status: true },
  });
  if (!draft) {
    throw new WiaDomainError("AI_DRAFT_NOT_FOUND", "The draft does not belong to this workspace.");
  }
  if (draft.status !== "DRAFT") {
    throw new WiaDomainError("AI_DRAFT_CLOSED", "Only a draft that is still open can be edited.");
  }

  const updated = await prisma.aiCommunicationDraft.update({
    where: { id: draft.id },
    data: { finalSubject: payload.subject, finalMessage: payload.message },
    select: { id: true, finalSubject: true, finalMessage: true, status: true },
  });
  await prisma.auditLog.create({
    data: {
      companyId: actor.companyId,
      userId: actor.userId,
      action: aiAuditAction("incident_communication_draft", "edited"),
      entity: "AiCommunicationDraft",
      entityId: draft.id,
      metadata: { subjectLength: payload.subject.length, messageLength: payload.message.length },
    },
  });
  return updated;
}

/**
 * Approves a draft and queues the approved text for delivery.
 *
 * The approver restates the subject and message they are approving, so what is
 * queued is what a person actually read, not whatever the record happened to
 * hold. The queued message carries the human text, and the audit entry records
 * the approver together with the exact text that was accepted.
 */
export async function approveIncidentDraft(actor: WiaActor, draftId: string, input: unknown) {
  assertCoordinator(actor);
  const payload = approvalSchema.parse(input);
  // The final text is checked once more before it can reach anyone: an edit
  // could have reintroduced a claim the model was refused for.
  assertSafeAiOutput(`${payload.subject}\n${payload.message}`);

  const prisma = getPrisma();
  const template = activeCommunicationTemplate("coordinator_message");

  return prisma.$transaction(async (transaction) => {
    const draft = await transaction.aiCommunicationDraft.findFirst({
      where: { id: draftId, companyId: actor.companyId },
      select: {
        id: true,
        status: true,
        audience: true,
        incident: { select: { id: true, shiftId: true, employeeId: true } },
      },
    });
    if (!draft) {
      throw new WiaDomainError("AI_DRAFT_NOT_FOUND", "The draft does not belong to this workspace.");
    }
    if (draft.status !== "DRAFT") {
      throw new WiaDomainError("AI_DRAFT_CLOSED", "This draft has already been approved or cancelled.");
    }

    const recipientEmployeeId = payload.recipientEmployeeId ?? draft.incident.employeeId;
    if (!recipientEmployeeId) {
      throw new WiaDomainError(
        "RECIPIENT_REQUIRED",
        "Choose who receives this message: the incident has no affected person."
      );
    }
    const recipient = await transaction.employee.findFirst({
      where: { id: recipientEmployeeId, companyId: actor.companyId },
      select: { id: true },
    });
    if (!recipient) {
      throw new WiaDomainError("EMPLOYEE_NOT_FOUND", "The recipient is not part of this workspace.");
    }

    const approvedAt = new Date();
    const dedupeKey = communicationDedupeKey({
      template: "coordinator_message",
      version: template.version,
      channel: "IN_APP",
      shiftId: draft.incident.shiftId,
      recipientEmployeeId: recipient.id,
      discriminator: draft.id,
    });

    const message = await transaction.communicationOutbox.create({
      data: {
        companyId: actor.companyId,
        shiftId: draft.incident.shiftId,
        recipientEmployeeId: recipient.id,
        channel: "IN_APP",
        template: "coordinator_message",
        templateVersion: template.version,
        dedupeKey,
        payload: { subject: payload.subject, body: payload.message },
      },
      select: { id: true },
    });

    const approved = await transaction.aiCommunicationDraft.update({
      where: { id: draft.id },
      data: {
        status: "APPROVED",
        finalSubject: payload.subject,
        finalMessage: payload.message,
        approvedByUserId: actor.userId,
        approvedAt,
        outboxId: message.id,
      },
      select: { id: true, status: true, outboxId: true, approvedAt: true },
    });

    await transaction.auditLog.create({
      data: {
        companyId: actor.companyId,
        userId: actor.userId,
        action: aiAuditAction("incident_communication_draft", "approved"),
        entity: "AiCommunicationDraft",
        entityId: draft.id,
        metadata: {
          approverUserId: actor.userId,
          incidentId: draft.incident.id,
          recipientEmployeeId: recipient.id,
          outboxId: message.id,
          // The approved text itself, because "what exactly did we agree to
          // send" must be answerable from the audit trail alone.
          finalSubject: payload.subject,
          finalMessage: payload.message,
        },
      },
    });

    return approved;
  });
}

export async function cancelIncidentDraft(actor: WiaActor, draftId: string) {
  assertCoordinator(actor);
  const prisma = getPrisma();

  const draft = await prisma.aiCommunicationDraft.findFirst({
    where: { id: draftId, companyId: actor.companyId },
    select: { id: true, status: true },
  });
  if (!draft) {
    throw new WiaDomainError("AI_DRAFT_NOT_FOUND", "The draft does not belong to this workspace.");
  }
  if (draft.status !== "DRAFT") {
    throw new WiaDomainError("AI_DRAFT_CLOSED", "This draft has already been approved or cancelled.");
  }

  const cancelled = await prisma.aiCommunicationDraft.update({
    where: { id: draft.id },
    data: { status: "CANCELLED", cancelledAt: new Date() },
    select: { id: true, status: true },
  });
  await prisma.auditLog.create({
    data: {
      companyId: actor.companyId,
      userId: actor.userId,
      action: aiAuditAction("incident_communication_draft", "cancelled"),
      entity: "AiCommunicationDraft",
      entityId: draft.id,
    },
  });
  return cancelled;
}
