-- Message templates become versioned, messages become de-duplicable, and the
-- provider's own reference is kept so a delivery can be traced end to end.
ALTER TABLE "CommunicationOutbox" ADD COLUMN "templateVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "CommunicationOutbox" ADD COLUMN "dedupeKey" TEXT;
ALTER TABLE "CommunicationOutbox" ADD COLUMN "providerReference" TEXT;

-- The unique index is what makes "never duplicated" a database guarantee.
-- NULL keys are allowed and never collide, so messages queued before this
-- migration remain valid.
CREATE UNIQUE INDEX "CommunicationOutbox_companyId_dedupeKey_key" ON "CommunicationOutbox"("companyId", "dedupeKey");

-- Channel consent. Email defaults to on because these messages are about the
-- work the person already agreed to do; SMS defaults to off and stays off
-- until there is both an opt-in and a provider.
ALTER TABLE "Employee" ADD COLUMN "contactEmailOptIn" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Employee" ADD COLUMN "contactSmsOptIn" BOOLEAN NOT NULL DEFAULT false;
