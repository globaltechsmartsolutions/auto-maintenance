-- A shift's clock events must form one line, not a tree.
--
-- Each event stores the integrity hash of the one before it. The application
-- reads the latest event and then writes the next, which is a read followed by
-- a write: two clock-outs arriving together both read the same clock-in and
-- both store it as their parent. The result is two events claiming the same
-- position in the chain, and an attendance record that no longer reconstructs
-- to a single sequence.
--
-- The chain is the integrity story for a statutory record, so the guarantee
-- belongs in the database, where those two transactions actually meet.

-- No two events on a shift may claim the same parent.
CREATE UNIQUE INDEX "ClockEvent_shift_chain_is_linear"
  ON "ClockEvent" ("shiftId", "previousEventHash")
  WHERE "previousEventHash" IS NOT NULL;

-- And a shift has exactly one first event. NULLs do not collide in a unique
-- index, so the root needs its own partial index rather than relying on the one
-- above. Written this way instead of NULLS NOT DISTINCT so the migration does
-- not depend on the PostgreSQL version.
CREATE UNIQUE INDEX "ClockEvent_shift_chain_has_one_root"
  ON "ClockEvent" ("shiftId")
  WHERE "previousEventHash" IS NULL;

-- NOTE FOR DEPLOYMENT
-- These indexes fail to build if a shift already has a forked chain, which
-- would mean the race described above has already happened. Find them first:
--
--   SELECT "shiftId", "previousEventHash", count(*)
--   FROM "ClockEvent"
--   GROUP BY "shiftId", "previousEventHash"
--   HAVING count(*) > 1;
--
-- Do not delete a clock event to make this pass. They are append-only
-- statutory records: investigate which duplicate is real, and correct the
-- other through the time-correction workflow so the decision stays attributable.
