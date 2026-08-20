-- A worker crash must not leave a message permanently PROCESSING. The
-- application reclaims records whose processing lease has expired.
ALTER TABLE "CommunicationOutbox"
  ADD COLUMN "processingStartedAt" TIMESTAMP(3);
