-- Private evidence attachments. Only metadata is stored here; the file lives
-- in a private bucket under a tenant-prefixed key and is only ever read
-- through a short-lived signed URL.
CREATE TYPE "EvidenceScanStatus" AS ENUM ('PENDING', 'CLEAN', 'REJECTED');

CREATE TABLE "EvidenceAttachment" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "shiftId" TEXT NOT NULL,
  "employeeId" TEXT,
  "uploadedByUserId" TEXT,
  "storageKey" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "checksum" TEXT,
  "status" "EvidenceScanStatus" NOT NULL DEFAULT 'PENDING',
  "scanDetail" TEXT,
  "retentionUntil" TIMESTAMP(3) NOT NULL,
  "confirmedAt" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EvidenceAttachment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EvidenceAttachment_storageKey_key" ON "EvidenceAttachment"("storageKey");
CREATE INDEX "EvidenceAttachment_companyId_createdAt_idx" ON "EvidenceAttachment"("companyId", "createdAt");
CREATE INDEX "EvidenceAttachment_shiftId_createdAt_idx" ON "EvidenceAttachment"("shiftId", "createdAt");
CREATE INDEX "EvidenceAttachment_companyId_status_idx" ON "EvidenceAttachment"("companyId", "status");
CREATE INDEX "EvidenceAttachment_retentionUntil_idx" ON "EvidenceAttachment"("retentionUntil");

ALTER TABLE "EvidenceAttachment" ADD CONSTRAINT "EvidenceAttachment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EvidenceAttachment" ADD CONSTRAINT "EvidenceAttachment_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "PlannedShift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EvidenceAttachment" ADD CONSTRAINT "EvidenceAttachment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EvidenceAttachment" ADD CONSTRAINT "EvidenceAttachment_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- The storage key must always start with the owning company, so a tampered or
-- mistakenly built key can never address another tenant's evidence.
ALTER TABLE "EvidenceAttachment"
  ADD CONSTRAINT "EvidenceAttachment_storageKey_tenant_prefix"
  CHECK ("storageKey" LIKE 'companies/' || "companyId" || '/%');
