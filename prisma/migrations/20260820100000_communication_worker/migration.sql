-- Stage 5: communication delivery worker support.

ALTER TYPE "CommunicationStatus" ADD VALUE 'RETRYING';

ALTER TABLE "CommunicationOutbox"
  ADD COLUMN "acknowledgedAt" TIMESTAMP(3);