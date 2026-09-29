CREATE TYPE "OutboxEventStatus" AS ENUM ('pending', 'processing', 'processed', 'failed');

CREATE TABLE "outbox_events" (
  "id" UUID NOT NULL,
  "deduplication_key" TEXT NOT NULL,
  "aggregate_type" TEXT NOT NULL,
  "aggregate_id" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "OutboxEventStatus" NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processed_at" TIMESTAMP(3),
  "last_error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "outbox_events_deduplication_key_key"
  ON "outbox_events"("deduplication_key");

CREATE INDEX "outbox_events_status_available_at_created_at_idx"
  ON "outbox_events"("status", "available_at", "created_at");

CREATE INDEX "outbox_events_aggregate_type_aggregate_id_idx"
  ON "outbox_events"("aggregate_type", "aggregate_id");
