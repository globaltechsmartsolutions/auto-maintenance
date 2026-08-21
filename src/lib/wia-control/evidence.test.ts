import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const prisma = {
    plannedShift: { findFirst: vi.fn() },
    evidenceAttachment: {
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    company: { findUnique: vi.fn() },
    templateSubmission: { findFirst: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  return { prisma };
});

vi.mock("@/lib/prisma", () => ({ getPrisma: () => mocks.prisma }));

import {
  assertEvidenceKeyBelongsToCompany,
  assertEvidenceUploadAllowed,
  buildEvidenceStorageKey,
  evidenceRetentionUntil,
  sanitiseEvidenceFileName,
  screenEvidenceBytes,
} from "@/lib/wia-control/evidence-policy";
import {
  confirmEvidenceUpload,
  createEvidenceDownloadUrl,
  purgeExpiredEvidence,
  requestEvidenceUpload,
} from "@/lib/wia-control/evidence-service";
import type { EvidenceStorage } from "@/lib/wia-control/evidence-storage";
import type { WiaActor } from "@/lib/wia-control/service";

const manager: WiaActor = { companyId: "company-1", userId: "user-manager", role: "MANAGER" };
const worker: WiaActor = {
  companyId: "company-1",
  userId: "user-worker",
  role: "EMPLOYEE",
  employeeId: "employee-1",
};

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const windowsExecutable = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]);
const zipArchive = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);

function fakeStorage(overrides: Partial<EvidenceStorage> = {}): EvidenceStorage {
  return {
    createUploadUrl: vi.fn(async () => ({ url: "https://storage.example/signed-upload", token: "tok" })),
    createDownloadUrl: vi.fn(async () => "https://storage.example/signed-download"),
    read: vi.fn(async () => jpeg),
    remove: vi.fn(async () => undefined),
    ...overrides,
  };
}

function audited() {
  return mocks.prisma.auditLog.create.mock.calls.map(
    (call) => (call[0] as { data: { action: string } }).data.action
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.evidenceAttachment.count.mockResolvedValue(0);
  mocks.prisma.company.findUnique.mockResolvedValue({ clockRetentionYears: 4 });
});

describe("evidence policy", () => {
  it("strips any path and unsafe characters from a client-supplied name", () => {
    expect(sanitiseEvidenceFileName("../../etc/passwd")).toBe("passwd");
    expect(sanitiseEvidenceFileName("C:\\Users\\ana\\before after.JPG")).toBe("before-after.JPG");
    expect(sanitiseEvidenceFileName("...")).toBe("evidence");
  });

  it("refuses a type it does not accept and a name that disagrees with the type", () => {
    expect(() =>
      assertEvidenceUploadAllowed({
        shiftId: "shift-1",
        fileName: "macro.docm",
        contentType: "application/vnd.ms-word.document.macroEnabled.12",
        sizeBytes: 1024,
      })
    ).toThrow(/Only JPEG, PNG, WebP, HEIC images and PDF/);

    expect(() =>
      assertEvidenceUploadAllowed({
        shiftId: "shift-1",
        fileName: "photo.jpg.exe",
        contentType: "image/jpeg",
        sizeBytes: 1024,
      })
    ).toThrow(/must be named with one of/);

    expect(
      assertEvidenceUploadAllowed({
        shiftId: "shift-1",
        fileName: "opening photo.JPEG",
        contentType: "image/jpeg; charset=binary",
        sizeBytes: 1024,
      })
    ).toEqual({ safeFileName: "opening-photo.JPEG", extension: "jpeg", contentType: "image/jpeg" });
  });

  it("builds a tenant-prefixed key and refuses one from another workspace", () => {
    const key = buildEvidenceStorageKey({
      companyId: "company-1",
      shiftId: "shift-1",
      attachmentId: "attachment-1",
      safeFileName: "photo.jpg",
    });
    expect(key).toBe("companies/company-1/shifts/shift-1/attachment-1-photo.jpg");
    expect(assertEvidenceKeyBelongsToCompany(key, "company-1")).toBe(key);
    expect(() => assertEvidenceKeyBelongsToCompany(key, "company-2")).toThrow(/does not belong/);
  });

  it("keeps evidence for the same period as the attendance record behind it", () => {
    expect(evidenceRetentionUntil(new Date("2026-08-20T00:00:00Z"), 4).toISOString()).toBe(
      "2030-08-20T00:00:00.000Z"
    );
  });

  it("screens the stored bytes rather than trusting the declared type", () => {
    expect(screenEvidenceBytes("image/jpeg", jpeg)).toEqual({ status: "CLEAN" });
    expect(screenEvidenceBytes("image/jpeg", png).status).toBe("REJECTED");
    expect(screenEvidenceBytes("image/jpeg", windowsExecutable).detail).toMatch(/executable/);
    expect(screenEvidenceBytes("application/pdf", zipArchive).detail).toMatch(/Archive/);
    expect(screenEvidenceBytes("image/jpeg", new Uint8Array([0xff])).detail).toMatch(/truncated/);
  });
});

describe("evidence upload", () => {
  it("reserves a private key, keeps the row pending, and audits the request", async () => {
    mocks.prisma.plannedShift.findFirst.mockResolvedValue({
      id: "shift-1",
      employeeId: "employee-1",
      status: "PLANNED",
    });
    mocks.prisma.evidenceAttachment.create.mockResolvedValue({
      id: "attachment-1",
      createdAt: new Date("2026-08-20T10:00:00Z"),
    });
    const storage = fakeStorage();

    const result = await requestEvidenceUpload(
      worker,
      { shiftId: "shift-1", fileName: "opening.jpg", contentType: "image/jpeg", sizeBytes: 2048 },
      storage
    );

    expect(result.storageKey).toBe("companies/company-1/shifts/shift-1/attachment-1-opening.jpg");
    expect(result.uploadUrl).toBe("https://storage.example/signed-upload");
    expect(mocks.prisma.evidenceAttachment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ companyId: "company-1" }) })
    );
    expect(audited()).toEqual(["evidence.upload_requested"]);
  });

  it("does not reserve anything for a shift the worker is not assigned to", async () => {
    mocks.prisma.plannedShift.findFirst.mockResolvedValue(null);
    const storage = fakeStorage();

    await expect(
      requestEvidenceUpload(
        worker,
        { shiftId: "shift-other", fileName: "opening.jpg", contentType: "image/jpeg", sizeBytes: 2048 },
        storage
      )
    ).rejects.toThrow(/does not belong to this workspace/);
    expect(mocks.prisma.plannedShift.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ employeeId: "employee-1" }) })
    );
    expect(storage.createUploadUrl).not.toHaveBeenCalled();
  });

  it("only attaches a file to a delivery answer from the same shift", async () => {
    mocks.prisma.plannedShift.findFirst.mockResolvedValue({
      id: "shift-1",
      employeeId: "employee-1",
      status: "ACTIVE",
    });
    mocks.prisma.templateSubmission.findFirst.mockResolvedValue(null);

    await expect(
      requestEvidenceUpload(
        worker,
        {
          shiftId: "shift-1",
          submissionId: "submission-from-another-visit",
          fileName: "opening.jpg",
          contentType: "image/jpeg",
          sizeBytes: 2048,
        },
        fakeStorage()
      )
    ).rejects.toThrow(/does not belong to this shift/);
    expect(mocks.prisma.evidenceAttachment.create).not.toHaveBeenCalled();
  });

  it("stops a shift being used as general file storage", async () => {
    mocks.prisma.plannedShift.findFirst.mockResolvedValue({ id: "shift-1", employeeId: "employee-1", status: "PLANNED" });
    mocks.prisma.evidenceAttachment.count.mockResolvedValue(20);

    await expect(
      requestEvidenceUpload(
        manager,
        { shiftId: "shift-1", fileName: "opening.jpg", contentType: "image/jpeg", sizeBytes: 2048 },
        fakeStorage()
      )
    ).rejects.toThrow(/at most 20 evidence files/);
  });
});

describe("evidence confirmation", () => {
  const pending = {
    id: "attachment-1",
    shiftId: "shift-1",
    storageKey: "companies/company-1/shifts/shift-1/attachment-1-opening.jpg",
    contentType: "image/jpeg",
    status: "PENDING",
    shift: { employeeId: "employee-1" },
  };

  it("records the checksum of what was actually stored", async () => {
    mocks.prisma.evidenceAttachment.findFirst.mockResolvedValue(pending);
    mocks.prisma.evidenceAttachment.update.mockResolvedValue({ id: "attachment-1", status: "CLEAN" });
    const storage = fakeStorage();

    await confirmEvidenceUpload(manager, "attachment-1", storage);

    expect(mocks.prisma.evidenceAttachment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "CLEAN",
          checksum: createHash("sha256").update(jpeg).digest("hex"),
          sizeBytes: jpeg.byteLength,
        }),
      })
    );
    expect(audited()).toEqual(["evidence.confirmed"]);
  });

  it("deletes a file whose content contradicts its declared type and keeps the rejection visible", async () => {
    mocks.prisma.evidenceAttachment.findFirst.mockResolvedValue(pending);
    const storage = fakeStorage({ read: vi.fn(async () => windowsExecutable) });

    await expect(confirmEvidenceUpload(manager, "attachment-1", storage)).rejects.toThrow(/executable/);

    expect(storage.remove).toHaveBeenCalledWith([pending.storageKey]);
    expect(mocks.prisma.evidenceAttachment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "REJECTED", deletedAt: expect.any(Date) }),
      })
    );
    expect(audited()).toEqual(["evidence.rejected"]);
  });

  it("refuses a file larger than the limit whatever the reservation declared", async () => {
    mocks.prisma.evidenceAttachment.findFirst.mockResolvedValue(pending);
    const oversized = new Uint8Array(21 * 1024 * 1024);
    oversized.set(jpeg);
    const storage = fakeStorage({ read: vi.fn(async () => oversized) });

    await expect(confirmEvidenceUpload(manager, "attachment-1", storage)).rejects.toThrow(
      /larger than the 20 MB limit/
    );
    expect(mocks.prisma.evidenceAttachment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "REJECTED" }) })
    );
  });

  it("still marks a rejection when the file cannot be removed from storage", async () => {
    mocks.prisma.evidenceAttachment.findFirst.mockResolvedValue(pending);
    const storage = fakeStorage({
      read: vi.fn(async () => windowsExecutable),
      remove: vi.fn().mockRejectedValue(new Error("bucket unavailable")),
    });

    await expect(confirmEvidenceUpload(manager, "attachment-1", storage)).rejects.toThrow(/executable/);

    // The record must not stay pending just because the cleanup failed.
    expect(mocks.prisma.evidenceAttachment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "REJECTED", deletedAt: expect.any(Date) }),
      })
    );
  });

  it("refuses evidence attached to another person's shift", async () => {
    mocks.prisma.evidenceAttachment.findFirst.mockResolvedValue({
      ...pending,
      shift: { employeeId: "employee-2" },
    });

    await expect(confirmEvidenceUpload(worker, "attachment-1", fakeStorage())).rejects.toThrow(
      /another person's shift/
    );
  });
});

describe("evidence download", () => {
  it("issues a short-lived link and audits the read", async () => {
    mocks.prisma.evidenceAttachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      shiftId: "shift-1",
      storageKey: "companies/company-1/shifts/shift-1/attachment-1-opening.jpg",
      fileName: "opening.jpg",
      shift: { employeeId: "employee-1" },
    });
    const storage = fakeStorage();

    const download = await createEvidenceDownloadUrl(manager, "attachment-1", storage);

    expect(download).toEqual({
      url: "https://storage.example/signed-download",
      fileName: "opening.jpg",
      expiresInSeconds: 120,
    });
    expect(storage.createDownloadUrl).toHaveBeenCalledWith(
      "companies/company-1/shifts/shift-1/attachment-1-opening.jpg",
      120
    );
    expect(audited()).toEqual(["evidence.downloaded"]);
  });

  it("never issues a link for a rejected or deleted attachment", async () => {
    mocks.prisma.evidenceAttachment.findFirst.mockResolvedValue(null);

    await expect(createEvidenceDownloadUrl(manager, "attachment-1", fakeStorage())).rejects.toThrow(
      /does not belong to this workspace/
    );
    expect(mocks.prisma.evidenceAttachment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "CLEAN", deletedAt: null }),
      })
    );
  });
});

describe("evidence retention", () => {
  const expired = [
    { id: "attachment-1", companyId: "company-1", shiftId: "shift-1", storageKey: "companies/company-1/a" },
    { id: "attachment-2", companyId: "company-1", shiftId: "shift-2", storageKey: "companies/company-1/b" },
  ];

  it("deletes the stored object and then marks the row", async () => {
    mocks.prisma.evidenceAttachment.findMany.mockResolvedValue(expired);
    const storage = fakeStorage();

    const result = await purgeExpiredEvidence(new Date("2031-01-01T00:00:00Z"), storage);

    expect(result).toEqual({ examined: 2, deleted: 2, failures: [] });
    expect(storage.remove).toHaveBeenCalledTimes(2);
    expect(audited()).toEqual(["evidence.retention_deleted", "evidence.retention_deleted"]);
  });

  it("keeps the record when the object cannot be deleted, so the next run retries it", async () => {
    mocks.prisma.evidenceAttachment.findMany.mockResolvedValue(expired);
    const storage = fakeStorage({
      remove: vi
        .fn()
        .mockRejectedValueOnce(new Error("bucket unavailable"))
        .mockResolvedValueOnce(undefined),
    });

    const result = await purgeExpiredEvidence(new Date("2031-01-01T00:00:00Z"), storage);

    expect(result.deleted).toBe(1);
    expect(result.failures).toEqual([{ id: "attachment-1", error: "bucket unavailable" }]);
    expect(mocks.prisma.evidenceAttachment.update).toHaveBeenCalledTimes(1);
  });
});
