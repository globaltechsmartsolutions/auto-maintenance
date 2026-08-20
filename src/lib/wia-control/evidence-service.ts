import "server-only";

import { createHash } from "node:crypto";
import { getPrisma } from "@/lib/prisma";
import { WiaDomainError } from "@/lib/wia-control/domain";
import {
  assertEvidenceKeyBelongsToCompany,
  assertEvidenceUploadAllowed,
  buildEvidenceStorageKey,
  EVIDENCE_DOWNLOAD_TTL_SECONDS,
  EVIDENCE_MAX_FILES_PER_SHIFT,
  EVIDENCE_UPLOAD_TTL_SECONDS,
  evidenceRetentionUntil,
  evidenceUploadSchema,
  screenEvidenceBytes,
} from "@/lib/wia-control/evidence-policy";
import { getEvidenceStorage, type EvidenceStorage } from "@/lib/wia-control/evidence-storage";
import type { WiaActor } from "@/lib/wia-control/service";

/**
 * Private evidence of service delivery.
 *
 * A file is never public and never reachable by a stable URL: the browser gets
 * a short-lived signed link, the metadata row is the only durable reference,
 * every read is audited, and retention deletes the object as well as marking
 * the row.
 */

export type EvidenceMetadata = {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  status: "PENDING" | "CLEAN" | "REJECTED";
  scanDetail?: string;
  uploadedAt: Date;
  retentionUntil: Date;
};

function assertActorCompany(actor: WiaActor) {
  if (!actor.companyId) {
    throw new WiaDomainError("COMPANY_REQUIRED", "The operation requires an active company.");
  }
}

/**
 * A field worker may only attach or read evidence for a shift that is actually
 * theirs; a coordinator sees the whole company. The employee filter is applied
 * in the query, not after it, so an unrelated shift is simply not found.
 */
function shiftScope(actor: WiaActor, shiftId: string) {
  return {
    id: shiftId,
    companyId: actor.companyId,
    ...(actor.role === "EMPLOYEE" ? { employeeId: actor.employeeId ?? "__missing_employee__" } : {}),
  };
}

/**
 * Reserves one attachment and returns a short-lived upload link. Nothing is
 * marked as usable evidence yet: the row stays PENDING until the stored bytes
 * have been screened, so an abandoned or hostile upload never becomes part of
 * a service's evidence pack.
 */
export async function requestEvidenceUpload(
  actor: WiaActor,
  input: unknown,
  storage: EvidenceStorage = getEvidenceStorage()
) {
  assertActorCompany(actor);
  const payload = evidenceUploadSchema.parse(input);
  const { safeFileName, contentType } = assertEvidenceUploadAllowed(payload);
  const prisma = getPrisma();

  const shift = await prisma.plannedShift.findFirst({
    where: shiftScope(actor, payload.shiftId),
    select: { id: true, employeeId: true, status: true },
  });
  if (!shift) {
    throw new WiaDomainError("SHIFT_NOT_FOUND", "The shift does not belong to this workspace.");
  }
  if (shift.status === "CANCELLED") {
    throw new WiaDomainError("SHIFT_CANCELLED", "A cancelled shift cannot receive evidence.");
  }

  const existing = await prisma.evidenceAttachment.count({
    where: { shiftId: shift.id, deletedAt: null, status: { not: "REJECTED" } },
  });
  if (existing >= EVIDENCE_MAX_FILES_PER_SHIFT) {
    throw new WiaDomainError(
      "EVIDENCE_LIMIT_REACHED",
      `A shift can hold at most ${EVIDENCE_MAX_FILES_PER_SHIFT} evidence files.`
    );
  }

  // A file may only be attached to a delivery answer from the same shift, so a
  // photo can never be filed against another visit's evidence.
  if (payload.submissionId) {
    const submission = await prisma.templateSubmission.findFirst({
      where: { id: payload.submissionId, companyId: actor.companyId, shiftId: shift.id },
      select: { id: true },
    });
    if (!submission) {
      throw new WiaDomainError(
        "SUBMISSION_NOT_FOUND",
        "The delivery answer does not belong to this shift."
      );
    }
  }

  const company = await prisma.company.findUnique({
    where: { id: actor.companyId },
    select: { clockRetentionYears: true },
  });

  const attachment = await prisma.evidenceAttachment.create({
    data: {
      companyId: actor.companyId,
      shiftId: shift.id,
      employeeId: shift.employeeId,
      uploadedByUserId: actor.userId,
      submissionId: payload.submissionId,
      storageKey: "",
      fileName: safeFileName,
      contentType,
      sizeBytes: payload.sizeBytes,
      retentionUntil: evidenceRetentionUntil(new Date(), company?.clockRetentionYears ?? 4),
    },
    select: { id: true, createdAt: true },
  });

  const storageKey = buildEvidenceStorageKey({
    companyId: actor.companyId,
    shiftId: shift.id,
    attachmentId: attachment.id,
    safeFileName,
  });
  await prisma.evidenceAttachment.update({
    where: { id: attachment.id },
    data: { storageKey },
  });

  const upload = await storage.createUploadUrl(storageKey, {
    contentType,
    expiresInSeconds: EVIDENCE_UPLOAD_TTL_SECONDS,
  });

  await prisma.auditLog.create({
    data: {
      companyId: actor.companyId,
      userId: actor.userId,
      action: "evidence.upload_requested",
      entity: "EvidenceAttachment",
      entityId: attachment.id,
      metadata: { shiftId: shift.id, contentType, sizeBytes: payload.sizeBytes },
    },
  });

  return {
    attachmentId: attachment.id,
    storageKey,
    uploadUrl: upload.url,
    uploadToken: upload.token,
    expiresInSeconds: EVIDENCE_UPLOAD_TTL_SECONDS,
  };
}

/**
 * Screens what was actually stored and records its checksum. A file that does
 * not match its declared type, or that carries an executable header, is
 * deleted from storage immediately and its row is kept as a rejected record so
 * the attempt remains visible.
 */
export async function confirmEvidenceUpload(
  actor: WiaActor,
  attachmentId: string,
  storage: EvidenceStorage = getEvidenceStorage()
) {
  assertActorCompany(actor);
  const prisma = getPrisma();

  const attachment = await prisma.evidenceAttachment.findFirst({
    where: {
      id: attachmentId,
      companyId: actor.companyId,
      deletedAt: null,
    },
    select: {
      id: true,
      shiftId: true,
      storageKey: true,
      contentType: true,
      status: true,
      shift: { select: { employeeId: true } },
    },
  });
  if (!attachment) {
    throw new WiaDomainError("EVIDENCE_NOT_FOUND", "The evidence does not belong to this workspace.");
  }
  if (actor.role === "EMPLOYEE" && attachment.shift.employeeId !== actor.employeeId) {
    throw new WiaDomainError("FORBIDDEN", "This evidence belongs to another person's shift.");
  }
  if (attachment.status !== "PENDING") {
    throw new WiaDomainError("EVIDENCE_ALREADY_CONFIRMED", "This evidence was already processed.");
  }
  assertEvidenceKeyBelongsToCompany(attachment.storageKey, actor.companyId);

  const bytes = await storage.read(attachment.storageKey);
  const screening = screenEvidenceBytes(attachment.contentType, bytes);

  if (screening.status === "REJECTED") {
    await storage.remove([attachment.storageKey]);
    await prisma.evidenceAttachment.update({
      where: { id: attachment.id },
      data: { status: "REJECTED", scanDetail: screening.detail, deletedAt: new Date() },
    });
    await prisma.auditLog.create({
      data: {
        companyId: actor.companyId,
        userId: actor.userId,
        action: "evidence.rejected",
        entity: "EvidenceAttachment",
        entityId: attachment.id,
        metadata: { shiftId: attachment.shiftId, detail: screening.detail },
      },
    });
    throw new WiaDomainError(
      "EVIDENCE_REJECTED",
      screening.detail ?? "The uploaded file was rejected and deleted."
    );
  }

  const confirmed = await prisma.evidenceAttachment.update({
    where: { id: attachment.id },
    data: {
      status: "CLEAN",
      sizeBytes: bytes.byteLength,
      checksum: createHash("sha256").update(bytes).digest("hex"),
      confirmedAt: new Date(),
      scanDetail: null,
    },
    select: {
      id: true,
      fileName: true,
      contentType: true,
      sizeBytes: true,
      checksum: true,
      status: true,
      createdAt: true,
      retentionUntil: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      companyId: actor.companyId,
      userId: actor.userId,
      action: "evidence.confirmed",
      entity: "EvidenceAttachment",
      entityId: attachment.id,
      metadata: {
        shiftId: attachment.shiftId,
        sizeBytes: confirmed.sizeBytes,
        checksum: confirmed.checksum,
      },
    },
  });

  return confirmed;
}

/** Metadata only. A URL is never part of a listing; it is requested per read. */
export async function listShiftEvidence(actor: WiaActor, shiftId: string) {
  assertActorCompany(actor);
  const prisma = getPrisma();

  const shift = await prisma.plannedShift.findFirst({
    where: shiftScope(actor, shiftId),
    select: { id: true },
  });
  if (!shift) {
    throw new WiaDomainError("SHIFT_NOT_FOUND", "The shift does not belong to this workspace.");
  }

  const attachments = await prisma.evidenceAttachment.findMany({
    where: { shiftId: shift.id, companyId: actor.companyId, deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      fileName: true,
      contentType: true,
      sizeBytes: true,
      status: true,
      scanDetail: true,
      checksum: true,
      createdAt: true,
      retentionUntil: true,
    },
  });
  return attachments;
}

/**
 * Issues one short-lived signed read. Every issued link is audited, because an
 * evidence read is itself an event a customer or a worker may later ask about.
 */
export async function createEvidenceDownloadUrl(
  actor: WiaActor,
  attachmentId: string,
  storage: EvidenceStorage = getEvidenceStorage()
) {
  assertActorCompany(actor);
  const prisma = getPrisma();

  const attachment = await prisma.evidenceAttachment.findFirst({
    where: { id: attachmentId, companyId: actor.companyId, status: "CLEAN", deletedAt: null },
    select: {
      id: true,
      shiftId: true,
      storageKey: true,
      fileName: true,
      shift: { select: { employeeId: true } },
    },
  });
  if (!attachment) {
    throw new WiaDomainError("EVIDENCE_NOT_FOUND", "The evidence does not belong to this workspace.");
  }
  if (actor.role === "EMPLOYEE" && attachment.shift.employeeId !== actor.employeeId) {
    throw new WiaDomainError("FORBIDDEN", "This evidence belongs to another person's shift.");
  }
  assertEvidenceKeyBelongsToCompany(attachment.storageKey, actor.companyId);

  const url = await storage.createDownloadUrl(attachment.storageKey, EVIDENCE_DOWNLOAD_TTL_SECONDS);

  await prisma.auditLog.create({
    data: {
      companyId: actor.companyId,
      userId: actor.userId,
      action: "evidence.downloaded",
      entity: "EvidenceAttachment",
      entityId: attachment.id,
      metadata: { shiftId: attachment.shiftId, ttlSeconds: EVIDENCE_DOWNLOAD_TTL_SECONDS },
    },
  });

  return { url, fileName: attachment.fileName, expiresInSeconds: EVIDENCE_DOWNLOAD_TTL_SECONDS };
}

/**
 * Retention job. Deletes the stored object first and only then marks the row,
 * so a storage failure leaves the record intact and the file is retried on the
 * next run rather than being reported as deleted while it still exists.
 */
export async function purgeExpiredEvidence(
  now = new Date(),
  storage: EvidenceStorage = getEvidenceStorage(),
  batchSize = 100
) {
  const prisma = getPrisma();
  const expired = await prisma.evidenceAttachment.findMany({
    where: { retentionUntil: { lte: now }, deletedAt: null },
    orderBy: { retentionUntil: "asc" },
    take: batchSize,
    select: { id: true, companyId: true, storageKey: true, shiftId: true },
  });

  let deleted = 0;
  const failures: Array<{ id: string; error: string }> = [];

  for (const attachment of expired) {
    try {
      await storage.remove([attachment.storageKey]);
      await prisma.evidenceAttachment.update({
        where: { id: attachment.id },
        data: { deletedAt: now, scanDetail: "Deleted by the retention policy." },
      });
      await prisma.auditLog.create({
        data: {
          companyId: attachment.companyId,
          action: "evidence.retention_deleted",
          entity: "EvidenceAttachment",
          entityId: attachment.id,
          metadata: { shiftId: attachment.shiftId },
        },
      });
      deleted += 1;
    } catch (error) {
      failures.push({
        id: attachment.id,
        error: error instanceof Error ? error.message : "Unknown storage error.",
      });
    }
  }

  return { examined: expired.length, deleted, failures };
}
