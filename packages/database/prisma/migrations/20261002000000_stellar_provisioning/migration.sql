CREATE TYPE "StellarProvisioningStatus" AS ENUM (
  'pending',
  'signing',
  'submitted',
  'active',
  'failed'
);

CREATE TABLE "stellar_account_provisionings" (
  "id" UUID NOT NULL,
  "producer_id" UUID NOT NULL,
  "wallet_account_id" UUID NOT NULL,
  "network" VARCHAR(32) NOT NULL,
  "asset_code" VARCHAR(12) NOT NULL,
  "asset_issuer" VARCHAR(56) NOT NULL,
  "status" "StellarProvisioningStatus" NOT NULL DEFAULT 'pending',
  "transaction_hash" VARCHAR(64),
  "failure_code" VARCHAR(80),
  "activated_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "stellar_account_provisionings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "stellar_account_provisionings_producer_id_key"
  ON "stellar_account_provisionings"("producer_id");
CREATE UNIQUE INDEX "stellar_account_provisionings_wallet_account_id_key"
  ON "stellar_account_provisionings"("wallet_account_id");
CREATE UNIQUE INDEX "stellar_account_provisionings_transaction_hash_key"
  ON "stellar_account_provisionings"("transaction_hash");

ALTER TABLE "stellar_account_provisionings"
  ADD CONSTRAINT "stellar_account_provisionings_producer_id_fkey"
  FOREIGN KEY ("producer_id") REFERENCES "producer_profiles"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "stellar_account_provisionings"
  ADD CONSTRAINT "stellar_account_provisionings_wallet_account_id_fkey"
  FOREIGN KEY ("wallet_account_id") REFERENCES "wallet_accounts"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "stellar_account_provisionings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stellar_account_provisionings" FORCE ROW LEVEL SECURITY;

CREATE POLICY "stellar_account_provisionings_producer_isolation"
  ON "stellar_account_provisionings"
  FOR ALL
  TO access_app_runtime
  USING (
    "producer_id" = NULLIF(current_setting('app.current_producer_id', true), '')::uuid
  )
  WITH CHECK (
    "producer_id" = NULLIF(current_setting('app.current_producer_id', true), '')::uuid
  );

GRANT USAGE ON TYPE "StellarProvisioningStatus" TO access_app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE "stellar_account_provisionings"
  TO access_app_runtime;
