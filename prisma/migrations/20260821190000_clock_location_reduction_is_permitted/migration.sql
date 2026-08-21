-- The append-only trigger on ClockEvent blocked the one update the product is
-- supposed to make: dropping the exact coordinate once the company's precision
-- window has passed.
--
-- The two rules were written months apart and never met. The trigger, from the
-- baseline, refuses every UPDATE unconditionally. The reduction job added in
-- 20260821160000_clock_location_precision issues exactly such an UPDATE. The
-- result is that the job cannot have worked: it raises on the first row it
-- touches, and the coordinates it exists to remove stay in the database for the
-- full retention period.
--
-- Nothing in the application could see this. The unit tests mock Prisma, so the
-- update always "succeeded"; only a real PostgreSQL refuses it.
--
-- The fix narrows the trigger rather than removing it. Exactly one shape of
-- update is allowed: a row that still carries a position becomes a row that
-- carries none, and nothing else about it changes. Deletion stays impossible.
--
-- The whole-row comparison is deliberate. Enumerating the columns that must not
-- change would silently stop protecting any column added later; comparing the
-- rows means a future column is covered the moment it exists.
CREATE OR REPLACE FUNCTION "prevent_clock_event_mutation"()
RETURNS trigger AS $$
DECLARE
  candidate "ClockEvent"%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE'
     -- Reduction happens once: a row already reduced is closed for good.
     AND OLD."locationReducedAt" IS NULL
     AND NEW."locationReducedAt" IS NOT NULL
     -- The position must actually be gone, not merely marked as gone.
     AND NEW."latitude" IS NULL
     AND NEW."longitude" IS NULL
  THEN
    -- Everything except the three reduction fields must be untouched. Rebuild
    -- the incoming row with the old values for those three and require it to be
    -- identical to what is stored.
    candidate := NEW;
    candidate."latitude" := OLD."latitude";
    candidate."longitude" := OLD."longitude";
    candidate."locationReducedAt" := OLD."locationReducedAt";

    IF candidate IS NOT DISTINCT FROM OLD THEN
      RETURN NEW;
    END IF;
  END IF;

  RAISE EXCEPTION 'ClockEvent is append-only; create a correction request instead. The only permitted update is removing an expired location.';
END;
$$ LANGUAGE plpgsql;
