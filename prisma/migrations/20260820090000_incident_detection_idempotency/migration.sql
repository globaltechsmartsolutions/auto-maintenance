-- The detector may be invoked concurrently by the scheduler. One incident
-- of a given type may exist for a company shift, so the database enforces
-- that idempotency boundary rather than relying on a prior read alone.
CREATE UNIQUE INDEX "AttendanceIncident_companyId_shiftId_type_key"
  ON "AttendanceIncident" ("companyId", "shiftId", "type");
