-- CreateEnum
CREATE TYPE "CommunicationChannel" AS ENUM ('IN_APP', 'EMAIL', 'SMS', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "CommunicationStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED');

-- Make the commercial CRM an opt-in module for new companies
ALTER TABLE "Company" ALTER COLUMN "crmEnabled" SET DEFAULT false;

-- CreateTable
CREATE TABLE "CommunicationOutbox" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "shiftId" TEXT,
    "recipientEmployeeId" TEXT,
    "channel" "CommunicationChannel" NOT NULL DEFAULT 'IN_APP',
    "template" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "CommunicationStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunicationOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommunicationOutbox_companyId_status_nextAttemptAt_idx" ON "CommunicationOutbox"("companyId", "status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "CommunicationOutbox_shiftId_createdAt_idx" ON "CommunicationOutbox"("shiftId", "createdAt");

-- CreateIndex
CREATE INDEX "CommunicationOutbox_recipientEmployeeId_createdAt_idx" ON "CommunicationOutbox"("recipientEmployeeId", "createdAt");

-- AddForeignKey
ALTER TABLE "CommunicationOutbox" ADD CONSTRAINT "CommunicationOutbox_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationOutbox" ADD CONSTRAINT "CommunicationOutbox_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "PlannedShift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationOutbox" ADD CONSTRAINT "CommunicationOutbox_recipientEmployeeId_fkey" FOREIGN KEY ("recipientEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
