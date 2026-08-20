-- One immutable operational completion record per planned shift. Attendance
-- clock events remain a separate append-only evidence trail.
CREATE TYPE "ShiftCompletionOutcome" AS ENUM ('COMPLETED', 'PARTIALLY_COMPLETED', 'NOT_COMPLETED');

CREATE TABLE "ShiftCompletion" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "shiftId" TEXT NOT NULL,
  "employeeId" TEXT,
  "actorUserId" TEXT,
  "outcome" "ShiftCompletionOutcome" NOT NULL,
  "checklist" JSONB,
  "note" TEXT,
  "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShiftCompletion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ShiftCompletion_shiftId_key" ON "ShiftCompletion"("shiftId");
CREATE INDEX "ShiftCompletion_companyId_completedAt_idx" ON "ShiftCompletion"("companyId", "completedAt");
CREATE INDEX "ShiftCompletion_employeeId_completedAt_idx" ON "ShiftCompletion"("employeeId", "completedAt");

ALTER TABLE "ShiftCompletion" ADD CONSTRAINT "ShiftCompletion_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShiftCompletion" ADD CONSTRAINT "ShiftCompletion_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "PlannedShift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShiftCompletion" ADD CONSTRAINT "ShiftCompletion_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ShiftCompletion" ADD CONSTRAINT "ShiftCompletion_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION "prevent_shift_completion_mutation"()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'ShiftCompletion is append-only; create an incident or correction trail instead.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ShiftCompletion_prevent_update"
BEFORE UPDATE ON "ShiftCompletion"
FOR EACH ROW EXECUTE FUNCTION "prevent_shift_completion_mutation"();

CREATE TRIGGER "ShiftCompletion_prevent_delete"
BEFORE DELETE ON "ShiftCompletion"
FOR EACH ROW EXECUTE FUNCTION "prevent_shift_completion_mutation"();
