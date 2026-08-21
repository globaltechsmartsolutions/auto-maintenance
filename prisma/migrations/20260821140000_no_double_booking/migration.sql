-- One person cannot be in two places at once.
--
-- The application checks for an overlapping shift before it writes, but that is
-- a read followed by a write: two coordinators assigning the same person at the
-- same moment both read "no conflict" and both insert. The check is worth
-- keeping, because it produces a good error message — but the guarantee has to
-- live in the database, where the two transactions actually meet.
--
-- An exclusion constraint is the right shape for this: unlike a unique index it
-- can express "these two ranges must not intersect".
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Only live shifts compete for a person's time. A cancelled or completed shift
-- is history and must not block anything, so the constraint is partial.
ALTER TABLE "PlannedShift"
  ADD CONSTRAINT "PlannedShift_no_employee_double_booking"
  EXCLUDE USING gist (
    "employeeId" WITH =,
    tsrange("scheduledStart", "scheduledEnd", '[)') WITH &&
  )
  WHERE ("employeeId" IS NOT NULL AND "status" NOT IN ('CANCELLED', 'COMPLETED'));

-- NOTE FOR DEPLOYMENT
-- This migration fails if the database already contains overlapping shifts for
-- the same person. That failure is information, not an obstacle: it means the
-- double-booking this constraint prevents has already happened. Find them with
-- the query below, resolve each one deliberately, then re-run the migration.
--
--   SELECT a."id", b."id", a."employeeId", a."scheduledStart", b."scheduledStart"
--   FROM "PlannedShift" a
--   JOIN "PlannedShift" b
--     ON a."employeeId" = b."employeeId"
--    AND a."id" < b."id"
--    AND a."scheduledStart" < b."scheduledEnd"
--    AND b."scheduledStart" < a."scheduledEnd"
--   WHERE a."employeeId" IS NOT NULL
--     AND a."status" NOT IN ('CANCELLED', 'COMPLETED')
--     AND b."status" NOT IN ('CANCELLED', 'COMPLETED');
