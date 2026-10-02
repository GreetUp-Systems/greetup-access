CREATE TYPE "EventStatus" AS ENUM (
  'draft',
  'published',
  'cancelled'
);

CREATE TABLE "events" (
  "id" UUID NOT NULL,
  "producer_id" UUID NOT NULL,
  "slug" VARCHAR(100) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "description" VARCHAR(5000),
  "location" VARCHAR(200),
  "starts_at" TIMESTAMPTZ(3) NOT NULL,
  "capacity" INTEGER NOT NULL,
  "refund_policy" VARCHAR(2000),
  "status" "EventStatus" NOT NULL DEFAULT 'draft',
  "published_at" TIMESTAMP(3),
  "cancelled_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "events_capacity_positive" CHECK ("capacity" > 0)
);

CREATE UNIQUE INDEX "events_slug_key" ON "events"("slug");
CREATE UNIQUE INDEX "events_id_producer_id_key" ON "events"("id", "producer_id");
CREATE INDEX "events_producer_id_created_at_idx" ON "events"("producer_id", "created_at");

ALTER TABLE "events"
  ADD CONSTRAINT "events_producer_id_fkey"
  FOREIGN KEY ("producer_id") REFERENCES "producer_profiles"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ticket_types" (
  "id" UUID NOT NULL,
  "event_id" UUID NOT NULL,
  "producer_id" UUID NOT NULL,
  "name" VARCHAR(80) NOT NULL,
  "description" VARCHAR(500),
  "price_cents" INTEGER NOT NULL,
  "quantity" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ticket_types_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ticket_types_price_cents_positive" CHECK ("price_cents" > 0),
  CONSTRAINT "ticket_types_quantity_positive" CHECK ("quantity" > 0)
);

CREATE INDEX "ticket_types_event_id_idx" ON "ticket_types"("event_id");

-- The composite key keeps the denormalized producer_id equal to the event owner.
ALTER TABLE "ticket_types"
  ADD CONSTRAINT "ticket_types_event_id_producer_id_fkey"
  FOREIGN KEY ("event_id", "producer_id") REFERENCES "events"("id", "producer_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "events" FORCE ROW LEVEL SECURITY;
ALTER TABLE "ticket_types" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ticket_types" FORCE ROW LEVEL SECURITY;

CREATE POLICY "events_producer_isolation"
  ON "events"
  FOR ALL
  TO access_app_runtime
  USING (
    "producer_id" = NULLIF(current_setting('app.current_producer_id', true), '')::uuid
  )
  WITH CHECK (
    "producer_id" = NULLIF(current_setting('app.current_producer_id', true), '')::uuid
  );

CREATE POLICY "ticket_types_producer_isolation"
  ON "ticket_types"
  FOR ALL
  TO access_app_runtime
  USING (
    "producer_id" = NULLIF(current_setting('app.current_producer_id', true), '')::uuid
  )
  WITH CHECK (
    "producer_id" = NULLIF(current_setting('app.current_producer_id', true), '')::uuid
  );

-- Public reads apply only to requests without an authenticated user context, so producer
-- isolation stays strict for every authenticated transaction.
CREATE POLICY "events_public_read"
  ON "events"
  FOR SELECT
  TO access_app_runtime
  USING (
    NULLIF(current_setting('app.current_user_id', true), '') IS NULL
    AND "status" IN ('published', 'cancelled')
  );

CREATE POLICY "ticket_types_public_read"
  ON "ticket_types"
  FOR SELECT
  TO access_app_runtime
  USING (
    NULLIF(current_setting('app.current_user_id', true), '') IS NULL
    AND EXISTS (
      SELECT 1
      FROM "events"
      WHERE "events"."id" = "ticket_types"."event_id"
        AND "events"."status" IN ('published', 'cancelled')
    )
  );

CREATE POLICY "producer_profiles_public_read"
  ON "producer_profiles"
  FOR SELECT
  TO access_app_runtime
  USING (
    NULLIF(current_setting('app.current_user_id', true), '') IS NULL
    AND EXISTS (
      SELECT 1
      FROM "events"
      WHERE "events"."producer_id" = "producer_profiles"."id"
        AND "events"."status" IN ('published', 'cancelled')
    )
  );

GRANT USAGE ON TYPE "EventStatus" TO access_app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE "events", "ticket_types"
  TO access_app_runtime;
