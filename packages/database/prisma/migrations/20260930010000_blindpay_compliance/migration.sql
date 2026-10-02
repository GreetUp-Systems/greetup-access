CREATE TYPE "BlindPayCustomerType" AS ENUM ('individual', 'business');
CREATE TYPE "BlindPayKycStatus" AS ENUM (
  'verifying',
  'approved',
  'rejected',
  'compliance_request',
  'approved_rfi'
);
CREATE TYPE "BlindPayCustomerCreationStatus" AS ENUM ('pending', 'created', 'failed');

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'access_blindpay_webhook') THEN
    CREATE ROLE access_blindpay_webhook
      NOLOGIN
      NOSUPERUSER
      NOBYPASSRLS
      NOCREATEDB
      NOCREATEROLE
      NOREPLICATION;
  END IF;
END
$$;

CREATE TABLE "blindpay_customers" (
  "id" UUID NOT NULL,
  "producer_id" UUID NOT NULL,
  "external_customer_id" TEXT,
  "provider_idempotency_key" VARCHAR(64) NOT NULL,
  "customer_type" "BlindPayCustomerType" NOT NULL,
  "creation_status" "BlindPayCustomerCreationStatus" NOT NULL DEFAULT 'pending',
  "kyc_status" "BlindPayKycStatus",
  "is_current" BOOLEAN NOT NULL DEFAULT true,
  "external_blockchain_wallet_id" TEXT,
  "failure_code" VARCHAR(100),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "blindpay_customers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "blindpay_webhook_deliveries" (
  "id" UUID NOT NULL,
  "provider_message_id" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "resource_id" TEXT,
  "payload_hash" VARCHAR(64) NOT NULL,
  "processed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "blindpay_webhook_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "blindpay_customers_external_customer_id_key"
  ON "blindpay_customers"("external_customer_id");
CREATE UNIQUE INDEX "blindpay_customers_provider_idempotency_key_key"
  ON "blindpay_customers"("provider_idempotency_key");
CREATE UNIQUE INDEX "blindpay_customers_external_blockchain_wallet_id_key"
  ON "blindpay_customers"("external_blockchain_wallet_id");
CREATE INDEX "blindpay_customers_producer_id_created_at_idx"
  ON "blindpay_customers"("producer_id", "created_at");
CREATE UNIQUE INDEX "blindpay_customers_one_current_per_producer"
  ON "blindpay_customers"("producer_id") WHERE "is_current" = true;
CREATE UNIQUE INDEX "blindpay_webhook_deliveries_provider_message_id_key"
  ON "blindpay_webhook_deliveries"("provider_message_id");

ALTER TABLE "blindpay_customers"
  ADD CONSTRAINT "blindpay_customers_producer_id_fkey"
  FOREIGN KEY ("producer_id") REFERENCES "producer_profiles"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "blindpay_customers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "blindpay_customers" FORCE ROW LEVEL SECURITY;

CREATE POLICY "blindpay_customers_producer_isolation"
  ON "blindpay_customers"
  FOR ALL
  TO access_app_runtime
  USING (
    "producer_id" = NULLIF(current_setting('app.current_producer_id', true), '')::uuid
  )
  WITH CHECK (
    "producer_id" = NULLIF(current_setting('app.current_producer_id', true), '')::uuid
  );

CREATE POLICY "blindpay_customers_verified_webhook_access"
  ON "blindpay_customers"
  FOR SELECT
  TO access_blindpay_webhook
  USING (true);

CREATE POLICY "blindpay_customers_verified_webhook_update"
  ON "blindpay_customers"
  FOR UPDATE
  TO access_blindpay_webhook
  USING (true)
  WITH CHECK (true);

GRANT USAGE ON SCHEMA public TO access_blindpay_webhook;
GRANT USAGE ON TYPE "BlindPayCustomerType", "BlindPayKycStatus", "BlindPayCustomerCreationStatus"
  TO access_app_runtime, access_blindpay_webhook;
GRANT USAGE ON TYPE "OutboxEventStatus" TO access_blindpay_webhook;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "blindpay_customers" TO access_app_runtime;
GRANT SELECT, UPDATE ON TABLE "blindpay_customers" TO access_blindpay_webhook;
GRANT SELECT, INSERT, UPDATE ON TABLE "blindpay_webhook_deliveries" TO access_blindpay_webhook;
GRANT SELECT, INSERT ON TABLE "outbox_events" TO access_blindpay_webhook;

REVOKE ALL ON TABLE "blindpay_webhook_deliveries" FROM access_app_runtime;
