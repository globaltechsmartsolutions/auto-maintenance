import { z } from "zod";
import { WiaDomainError } from "@/lib/wia-control/domain-core";

/**
 * What a field worker is allowed to attach as proof of delivery, and how that
 * file is named, stored, screened, and expired.
 *
 * This module is deliberately free of database and storage access so the rules
 * that decide whether a file is acceptable can be tested exhaustively and
 * cannot drift between the upload path, the download path, and the retention
 * job.
 */

/** Signed download links are short-lived: they are a read, not a share. */
export const EVIDENCE_DOWNLOAD_TTL_SECONDS = 120;
/** An upload link is single-purpose and expires quickly too. */
export const EVIDENCE_UPLOAD_TTL_SECONDS = 300;
/** Bounded so one shift cannot be used as general-purpose file storage. */
export const EVIDENCE_MAX_FILES_PER_SHIFT = 20;
export const EVIDENCE_MAX_BYTES = 20 * 1024 * 1024;
export const EVIDENCE_MIN_BYTES = 64;
/** Enough to cover every signature checked below. */
export const EVIDENCE_SCREEN_PREFIX_BYTES = 32;

const allowedTypes: Record<string, string[]> = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "image/heic": ["heic"],
  "application/pdf": ["pdf"],
};

export const evidenceUploadSchema = z.object({
  shiftId: z.string().trim().min(1).max(160),
  fileName: z.string().trim().min(1).max(200),
  contentType: z.string().trim().min(3).max(120),
  sizeBytes: z.number().int().min(EVIDENCE_MIN_BYTES).max(EVIDENCE_MAX_BYTES),
});

export type EvidenceUploadInput = z.infer<typeof evidenceUploadSchema>;

/**
 * Reduces a client-supplied name to something safe to store and to show.
 * Directory components are dropped rather than escaped, because evidence
 * filenames have no legitimate reason to contain a path.
 */
export function sanitiseEvidenceFileName(fileName: string) {
  const base = fileName.split(/[\\/]/).pop() ?? "";
  const cleaned = base
    .replace(/\s+/g, "-")
    .replace(/[^A-Za-z0-9._-]/g, "")
    .replace(/^[.-]+/, "")
    .slice(0, 120);
  return cleaned || "evidence";
}

export function evidenceFileExtension(fileName: string) {
  const match = /\.([A-Za-z0-9]+)$/.exec(fileName);
  return match ? match[1].toLowerCase() : "";
}

/**
 * Accepts an upload only when the declared type is allowed *and* the file name
 * agrees with it. A name whose real extension disagrees with the declared type
 * — `photo.jpg.exe`, or a PDF announced as an image — is refused before a
 * storage key is ever handed out.
 */
export function assertEvidenceUploadAllowed(input: EvidenceUploadInput) {
  const contentType = input.contentType.split(";")[0].trim().toLowerCase();
  const extensions = allowedTypes[contentType];
  if (!extensions) {
    throw new WiaDomainError(
      "EVIDENCE_TYPE_NOT_ALLOWED",
      "Only JPEG, PNG, WebP, HEIC images and PDF documents can be attached as evidence."
    );
  }

  const safeFileName = sanitiseEvidenceFileName(input.fileName);
  const extension = evidenceFileExtension(safeFileName);
  if (!extension || !extensions.includes(extension)) {
    throw new WiaDomainError(
      "EVIDENCE_NAME_TYPE_MISMATCH",
      `A ${contentType} file must be named with one of: ${extensions.join(", ")}.`
    );
  }

  return { safeFileName, extension, contentType };
}

/**
 * Tenant-first storage key. The company segment comes first so a bucket policy
 * can be expressed as a prefix rule, and so a key can be proven to belong to
 * the company that is asking for it.
 */
export function buildEvidenceStorageKey(input: {
  companyId: string;
  shiftId: string;
  attachmentId: string;
  safeFileName: string;
}) {
  return `companies/${input.companyId}/shifts/${input.shiftId}/${input.attachmentId}-${input.safeFileName}`;
}

export function assertEvidenceKeyBelongsToCompany(storageKey: string, companyId: string) {
  if (!storageKey.startsWith(`companies/${companyId}/`)) {
    throw new WiaDomainError(
      "EVIDENCE_TENANT_MISMATCH",
      "The stored evidence does not belong to this workspace."
    );
  }
  return storageKey;
}

/**
 * Evidence is kept for the same period as the attendance record it supports,
 * so a service can still be proven for as long as the clocks behind it exist.
 */
export function evidenceRetentionUntil(createdAt: Date, retentionYears: number) {
  const until = new Date(createdAt);
  until.setUTCFullYear(until.getUTCFullYear() + Math.max(1, Math.trunc(retentionYears)));
  return until;
}

export type EvidenceScreening = { status: "CLEAN" | "REJECTED"; detail?: string };

const signatures: Array<{ contentType: string; matches: (bytes: Uint8Array) => boolean }> = [
  { contentType: "image/jpeg", matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    contentType: "image/png",
    matches: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  },
  {
    contentType: "image/webp",
    matches: (b) => ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP",
  },
  { contentType: "image/heic", matches: (b) => ascii(b, 4, 4) === "ftyp" },
  { contentType: "application/pdf", matches: (b) => ascii(b, 0, 4) === "%PDF" },
];

function ascii(bytes: Uint8Array, offset: number, length: number) {
  return String.fromCharCode(...Array.from(bytes.slice(offset, offset + length)));
}

/**
 * Content screening, not antivirus.
 *
 * It proves the stored bytes really are the media type they claim to be and
 * rejects the executable and script headers that are the usual payload of a
 * renamed upload. A real malware scanner must still run in front of the bucket
 * before this feature is enabled for a paying customer; this check exists so a
 * missing scanner never means *no* check at all.
 */
export function screenEvidenceBytes(contentType: string, bytes: Uint8Array): EvidenceScreening {
  if (bytes.length < 4) {
    return { status: "REJECTED", detail: "The stored file is empty or truncated." };
  }

  const header = ascii(bytes, 0, 4);
  if (header.startsWith("MZ") || header === "\u007fELF" || header.startsWith("#!")) {
    return { status: "REJECTED", detail: "The file contains an executable or script header." };
  }
  if (ascii(bytes, 0, 2) === "PK") {
    return { status: "REJECTED", detail: "Archive and macro-enabled office files are not accepted." };
  }

  const expected = signatures.find((signature) => signature.contentType === contentType);
  if (!expected) {
    return { status: "REJECTED", detail: "The declared file type is not accepted as evidence." };
  }
  if (!expected.matches(bytes)) {
    return {
      status: "REJECTED",
      detail: `The file content does not match the declared type ${contentType}.`,
    };
  }
  return { status: "CLEAN" };
}
