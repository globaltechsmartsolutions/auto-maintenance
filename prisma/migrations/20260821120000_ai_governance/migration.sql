-- AI stays off unless a company explicitly turns it on and authorises a budget.
-- The defaults below are deliberately the "no AI runs here" state.
ALTER TABLE "Company" ADD COLUMN "aiFeatures" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Company" ADD COLUMN "aiMonthlyTokenBudget" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Company" ADD COLUMN "aiDisabledAt" TIMESTAMP(3);

CREATE TYPE "AiDraftStatus" AS ENUM ('DRAFT', 'APPROVED', 'CANCELLED');

-- Every AI call, including the ones the gate refused, so cost and behaviour can
-- be measured before the feature is offered to a customer.
CREATE TABLE "AiUsageRecord" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT,
  "feature" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "outcome" TEXT NOT NULL,
  "promptTokens" INTEGER NOT NULL DEFAULT 0,
  "completionTokens" INTEGER NOT NULL DEFAULT 0,
  "detail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiUsageRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiUsageRecord_companyId_createdAt_idx" ON "AiUsageRecord"("companyId", "createdAt");
CREATE INDEX "AiUsageRecord_companyId_feature_createdAt_idx" ON "AiUsageRecord"("companyId", "feature", "createdAt");

ALTER TABLE "AiUsageRecord" ADD CONSTRAINT "AiUsageRecord_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiUsageRecord" ADD CONSTRAINT "AiUsageRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- An AI-written message on its way to a human decision. Nothing is sent from
-- this table: approval copies the accepted text into the communication outbox.
CREATE TABLE "AiCommunicationDraft" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "incidentId" TEXT NOT NULL,
  "audience" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "generatedSubject" TEXT NOT NULL,
  "generatedMessage" TEXT NOT NULL,
  "finalSubject" TEXT NOT NULL,
  "finalMessage" TEXT NOT NULL,
  "status" "AiDraftStatus" NOT NULL DEFAULT 'DRAFT',
  "createdByUserId" TEXT,
  "approvedByUserId" TEXT,
  "approvedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "outboxId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiCommunicationDraft_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiCommunicationDraft_companyId_status_createdAt_idx" ON "AiCommunicationDraft"("companyId", "status", "createdAt");
CREATE INDEX "AiCommunicationDraft_incidentId_createdAt_idx" ON "AiCommunicationDraft"("incidentId", "createdAt");

ALTER TABLE "AiCommunicationDraft" ADD CONSTRAINT "AiCommunicationDraft_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiCommunicationDraft" ADD CONSTRAINT "AiCommunicationDraft_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "AttendanceIncident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AiCommunicationDraft" ADD CONSTRAINT "AiCommunicationDraft_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AiCommunicationDraft" ADD CONSTRAINT "AiCommunicationDraft_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- An approved draft must name the person who approved it and when. This is the
-- database's own version of "no AI message reaches a recipient without a named
-- human approver".
ALTER TABLE "AiCommunicationDraft"
  ADD CONSTRAINT "AiCommunicationDraft_approval_is_attributed"
  CHECK (
    "status" <> 'APPROVED'
    OR ("approvedByUserId" IS NOT NULL AND "approvedAt" IS NOT NULL)
  );
