import "server-only";

import { getPrisma } from "@/lib/prisma";
import { WiaDomainError } from "@/lib/wia-control/domain";
import {
  assertSubmittableVersion,
  describeSubmission,
  templateSubmissionSchema,
  validateTemplateAnswers,
  type TemplateAnswerValue,
  type TemplateKey,
} from "@/lib/wia-control/delivery-templates";
import type { WiaActor } from "@/lib/wia-control/service";

/**
 * Capture and read of answered delivery templates.
 *
 * A submission is append-only and idempotent by the identifier the device
 * generated, which is what makes offline capture safe: the same visit can be
 * resent as many times as the network requires and still produce exactly one
 * record.
 */

function shiftScope(actor: WiaActor, shiftId: string) {
  return {
    id: shiftId,
    companyId: actor.companyId,
    ...(actor.role === "EMPLOYEE" ? { employeeId: actor.employeeId ?? "__missing_employee__" } : {}),
  };
}

export async function submitDeliveryTemplate(actor: WiaActor, input: unknown) {
  if (!actor.companyId) {
    throw new WiaDomainError("COMPANY_REQUIRED", "The operation requires an active company.");
  }
  const payload = templateSubmissionSchema.parse(input);
  assertSubmittableVersion(payload.templateKey, payload.templateVersion);
  const { answers } = validateTemplateAnswers(
    payload.templateKey,
    payload.templateVersion,
    payload.answers
  );

  const prisma = getPrisma();

  // Resending a queued submission must never create a second record. The check
  // runs before the shift lookup so a retry stays cheap and always answers with
  // the record it already created.
  const existing = await prisma.templateSubmission.findFirst({
    where: { companyId: actor.companyId, clientSubmissionId: payload.clientSubmissionId },
    select: {
      id: true,
      shiftId: true,
      employeeId: true,
      templateKey: true,
      templateVersion: true,
      answers: true,
      submittedAt: true,
    },
  });
  if (existing) {
    // A resend is the same submission arriving twice, not any request carrying
    // an identifier somebody else generated. Answering before this check would
    // hand a colleague's answers to whoever guessed their submission id.
    if (actor.role === "EMPLOYEE" && existing.employeeId !== actor.employeeId) {
      throw new WiaDomainError("FORBIDDEN", "That submission belongs to another person's shift.");
    }
    if (existing.shiftId !== payload.shiftId) {
      throw new WiaDomainError(
        "SUBMISSION_ID_REUSED",
        "That submission id was already used for a different shift. Generate a new one."
      );
    }
    const { employeeId: _ownership, ...submission } = existing;
    return { submission, created: false };
  }

  const shift = await prisma.plannedShift.findFirst({
    where: shiftScope(actor, payload.shiftId),
    select: { id: true, employeeId: true, status: true },
  });
  if (!shift) {
    throw new WiaDomainError("SHIFT_NOT_FOUND", "The shift does not belong to this workspace.");
  }
  if (shift.status === "CANCELLED") {
    throw new WiaDomainError("SHIFT_CANCELLED", "A cancelled shift cannot receive delivery answers.");
  }

  const submittedAt = payload.submittedAt ? new Date(payload.submittedAt) : new Date();

  const submission = await prisma.templateSubmission.create({
    data: {
      companyId: actor.companyId,
      shiftId: shift.id,
      employeeId: shift.employeeId,
      actorUserId: actor.userId,
      templateKey: payload.templateKey,
      templateVersion: payload.templateVersion,
      answers,
      clientSubmissionId: payload.clientSubmissionId,
      capturedOffline: Boolean(payload.submittedAt),
      submittedAt,
    },
    select: {
      id: true,
      shiftId: true,
      templateKey: true,
      templateVersion: true,
      answers: true,
      submittedAt: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      companyId: actor.companyId,
      userId: actor.userId,
      action: "delivery_template.submitted",
      entity: "TemplateSubmission",
      entityId: submission.id,
      metadata: {
        shiftId: shift.id,
        templateKey: payload.templateKey,
        templateVersion: payload.templateVersion,
      },
    },
  });

  return { submission, created: true };
}

export async function listShiftSubmissions(actor: WiaActor, shiftId: string) {
  if (!actor.companyId) {
    throw new WiaDomainError("COMPANY_REQUIRED", "The operation requires an active company.");
  }
  const prisma = getPrisma();
  const shift = await prisma.plannedShift.findFirst({
    where: shiftScope(actor, shiftId),
    select: { id: true },
  });
  if (!shift) {
    throw new WiaDomainError("SHIFT_NOT_FOUND", "The shift does not belong to this workspace.");
  }

  const submissions = await prisma.templateSubmission.findMany({
    where: { companyId: actor.companyId, shiftId: shift.id },
    orderBy: { submittedAt: "asc" },
    select: {
      id: true,
      templateKey: true,
      templateVersion: true,
      answers: true,
      capturedOffline: true,
      submittedAt: true,
      employee: { select: { user: { select: { firstName: true, lastName: true } } } },
      evidence: {
        where: { status: "CLEAN", deletedAt: null },
        select: { id: true, fileName: true },
      },
    },
  });

  return submissions.map((submission) => ({
    ...submission,
    summary: describeSubmission(
      submission.templateKey as TemplateKey,
      submission.templateVersion,
      (submission.answers ?? {}) as Record<string, TemplateAnswerValue>
    ),
  }));
}

/** Every submission behind one client service, for the evidence pack. */
export async function listServiceSubmissions(actor: WiaActor, serviceId: string) {
  if (!actor.companyId) {
    throw new WiaDomainError("COMPANY_REQUIRED", "The operation requires an active company.");
  }
  if (actor.role === "EMPLOYEE") {
    throw new WiaDomainError("FORBIDDEN", "An employee cannot read the company service register.");
  }
  const prisma = getPrisma();

  const submissions = await prisma.templateSubmission.findMany({
    where: { companyId: actor.companyId, shift: { serviceId } },
    orderBy: { submittedAt: "asc" },
    select: {
      id: true,
      templateKey: true,
      templateVersion: true,
      answers: true,
      capturedOffline: true,
      submittedAt: true,
      shift: { select: { id: true, title: true } },
      employee: { select: { user: { select: { firstName: true, lastName: true } } } },
      evidence: { where: { status: "CLEAN", deletedAt: null }, select: { id: true, fileName: true } },
    },
  });

  return submissions.map((submission) => ({
    ...submission,
    summary: describeSubmission(
      submission.templateKey as TemplateKey,
      submission.templateVersion,
      (submission.answers ?? {}) as Record<string, TemplateAnswerValue>
    ),
  }));
}
