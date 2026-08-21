-- One row per provider event already acted on.
--
-- Stripe retries, and a delivered event can be replayed. Without this, an older
-- but perfectly valid checkout event replayed after a cancellation sets the
-- company back to ACTIVE, reviving paid access for a subscription that no
-- longer exists. The primary key is the provider's own event id, so the insert
-- itself is the deduplication.
CREATE TABLE "ProcessedWebhookEvent" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProcessedWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProcessedWebhookEvent_provider_processedAt_idx"
  ON "ProcessedWebhookEvent" ("provider", "processedAt");
