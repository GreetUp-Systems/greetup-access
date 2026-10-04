-- SPEC-005 6D: a login made by the user's own choice makes the account eligible (D-23).
ALTER TABLE "users" ADD COLUMN "spontaneous_login_at" TIMESTAMP(3);

CREATE TABLE "wallet_activations" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "wallet_account_id" UUID NOT NULL,
  "network" VARCHAR(32) NOT NULL,
  "status" "StellarProvisioningStatus" NOT NULL DEFAULT 'pending',
  "transaction_hash" VARCHAR(64),
  "failure_code" VARCHAR(80),
  "activated_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "wallet_activations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "wallet_activations_user_id_key" ON "wallet_activations"("user_id");
CREATE UNIQUE INDEX "wallet_activations_wallet_account_id_key"
  ON "wallet_activations"("wallet_account_id");
CREATE UNIQUE INDEX "wallet_activations_transaction_hash_key"
  ON "wallet_activations"("transaction_hash");

ALTER TABLE "wallet_activations"
  ADD CONSTRAINT "wallet_activations_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "wallet_activations_wallet_account_id_fkey"
  FOREIGN KEY ("wallet_account_id") REFERENCES "wallet_accounts"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "wallet_activations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "wallet_activations" FORCE ROW LEVEL SECURITY;

CREATE POLICY "wallet_activations_user_isolation"
  ON "wallet_activations"
  FOR ALL
  TO access_app_runtime
  USING ("user_id" = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
  WITH CHECK ("user_id" = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE ON TABLE "wallet_activations" TO access_app_runtime;
