-- Reduce a clock's exact position to the distance that justified it, once the
-- window in which that position is still useful has passed.
--
-- The statutory record is unaffected: time, person, worksite and the
-- verification outcome are all kept for the full retention period. What expires
-- is the coordinate, because the purpose of a time record is when work started
-- and stopped, not where somebody was.

-- Configurable per company, because how long a dispute or a misconfigured
-- worksite takes to surface is a business fact, not a technical one.
ALTER TABLE "Company" ADD COLUMN "clockLocationPrecisionDays" INTEGER NOT NULL DEFAULT 60;

-- Written at capture time, so a decision stays explainable after the exact
-- position is gone.
ALTER TABLE "ClockEvent" ADD COLUMN "distanceMeters" DECIMAL(10,2);
ALTER TABLE "ClockEvent" ADD COLUMN "verifiedAgainstRadiusMeters" INTEGER;
ALTER TABLE "ClockEvent" ADD COLUMN "locationReducedAt" TIMESTAMP(3);

-- The reduction job looks for events that still carry a position.
CREATE INDEX "ClockEvent_pending_location_reduction_idx"
  ON "ClockEvent" ("occurredAt")
  WHERE "locationReducedAt" IS NULL AND "latitude" IS NOT NULL;
