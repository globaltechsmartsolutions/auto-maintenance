-- Answered delivery templates. Append-only, like ShiftCompletion: a correction
-- is a new submission so the answers a manager reads are always the answers the
-- worker actually gave, against the template version they actually saw.
CREATE TABLE "TemplateSubmission" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "shiftId" TEXT NOT NULL,
  "employeeId" TEXT,
  "actorUserId" TEXT,
  "templateKey" TEXT NOT NULL,
  "templateVersion" INTEGER NOT NULL,
  "answers" JSONB NOT NULL,
  "clientSubmissionId" TEXT NOT NULL,
  "capturedOffline" BOOLEAN NOT NULL DEFAULT false,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TemplateSubmission_pkey" PRIMARY KEY ("id")
);

-- The device generates one submission id and reuses it for every retry, so an
-- offline resend can never create a second submission.
CREATE UNIQUE INDEX "TemplateSubmission_companyId_clientSubmissionId_key" ON "TemplateSubmission"("companyId", "clientSubmissionId");
CREATE INDEX "TemplateSubmission_companyId_submittedAt_idx" ON "TemplateSubmission"("companyId", "submittedAt");
CREATE INDEX "TemplateSubmission_shiftId_submittedAt_idx" ON "TemplateSubmission"("shiftId", "submittedAt");
CREATE INDEX "TemplateSubmission_companyId_templateKey_templateVersion_idx" ON "TemplateSubmission"("companyId", "templateKey", "templateVersion");

ALTER TABLE "TemplateSubmission" ADD CONSTRAINT "TemplateSubmission_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TemplateSubmission" ADD CONSTRAINT "TemplateSubmission_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "PlannedShift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TemplateSubmission" ADD CONSTRAINT "TemplateSubmission_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TemplateSubmission" ADD CONSTRAINT "TemplateSubmission_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION "prevent_template_submission_mutation"()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'TemplateSubmission is append-only; submit a new answer set instead.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "TemplateSubmission_prevent_update"
BEFORE UPDATE ON "TemplateSubmission"
FOR EACH ROW EXECUTE FUNCTION "prevent_template_submission_mutation"();

CREATE TRIGGER "TemplateSubmission_prevent_delete"
BEFORE DELETE ON "TemplateSubmission"
FOR EACH ROW EXECUTE FUNCTION "prevent_template_submission_mutation"();

-- Evidence can point at the submission it supports, so a photo is attached to
-- an answer rather than only to the shift as a whole.
ALTER TABLE "EvidenceAttachment" ADD COLUMN "submissionId" TEXT;
CREATE INDEX "EvidenceAttachment_submissionId_idx" ON "EvidenceAttachment"("submissionId");
ALTER TABLE "EvidenceAttachment" ADD CONSTRAINT "EvidenceAttachment_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "TemplateSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
