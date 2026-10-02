DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'access_app_runtime') THEN
    CREATE ROLE access_app_runtime
      NOLOGIN
      NOSUPERUSER
      NOBYPASSRLS
      NOCREATEDB
      NOCREATEROLE
      NOREPLICATION;
  END IF;
END
$$;

CREATE TABLE "producer_profiles" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "display_name" VARCHAR(120) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "producer_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "producer_profiles_user_id_key"
  ON "producer_profiles"("user_id");

ALTER TABLE "producer_profiles"
  ADD CONSTRAINT "producer_profiles_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "producer_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "producer_profiles" FORCE ROW LEVEL SECURITY;

CREATE POLICY "producer_profiles_user_isolation"
  ON "producer_profiles"
  FOR ALL
  TO access_app_runtime
  USING (
    "user_id" = NULLIF(current_setting('app.current_user_id', true), '')::uuid
  )
  WITH CHECK (
    "user_id" = NULLIF(current_setting('app.current_user_id', true), '')::uuid
  );

GRANT USAGE ON SCHEMA public TO access_app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE "outbox_events", "users", "wallet_accounts", "producer_profiles"
  TO access_app_runtime;
