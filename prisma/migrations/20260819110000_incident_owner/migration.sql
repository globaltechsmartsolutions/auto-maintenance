-- Stage 3: incident ownership (the "assign" action).

ALTER TABLE "AttendanceIncident"
  ADD COLUMN "ownerId" TEXT;

ALTER TABLE "AttendanceIncident"
  ADD CONSTRAINT "AttendanceIncident_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "AttendanceIncident_ownerId_status_idx"
  ON "AttendanceIncident" ("ownerId", "status");
