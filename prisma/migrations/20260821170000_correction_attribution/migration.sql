-- Who raised a correction, and why it was decided the way it was.
--
-- The 2026 digital time-record rules require that any change to the record
-- leaves who changed it, when, and why. The correction record already carried
-- the when and the affected worker, but not who actually raised it - a
-- coordinator raising one on a worker's behalf read as the worker's own
-- request - and the coordinator's reason lived only in the audit log.
ALTER TABLE "TimeCorrectionRequest" ADD COLUMN "requestedByUserId" TEXT;
ALTER TABLE "TimeCorrectionRequest" ADD COLUMN "reviewNote" TEXT;

ALTER TABLE "TimeCorrectionRequest"
  ADD CONSTRAINT "TimeCorrectionRequest_requestedByUserId_fkey"
  FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "TimeCorrectionRequest_requestedByUserId_idx"
  ON "TimeCorrectionRequest" ("requestedByUserId");
