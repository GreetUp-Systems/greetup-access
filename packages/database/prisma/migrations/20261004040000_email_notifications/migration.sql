-- SPEC-008 7B: the NotifyWorker records one e-mail per purchase and reads only what the e-mail needs.

CREATE TYPE "EmailNotificationKind" AS ENUM ('tickets_ready');
CREATE TYPE "EmailNotificationStatus" AS ENUM ('pending', 'sent', 'failed');

CREATE TABLE "email_notifications" (
  "id" UUID NOT NULL,
  "kind" "EmailNotificationKind" NOT NULL,
  "reference_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "status" "EmailNotificationStatus" NOT NULL DEFAULT 'pending',
  "provider_message_id" VARCHAR(64),
  "failure_code" VARCHAR(80),
  "sent_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "email_notifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "email_notifications_kind_reference_id_key"
  ON "email_notifications"("kind", "reference_id");

ALTER TABLE "email_notifications"
  ADD CONSTRAINT "email_notifications_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Only the worker touches the table; the API never reads it.
ALTER TABLE "email_notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "email_notifications" FORCE ROW LEVEL SECURITY;

CREATE POLICY "email_notifications_worker"
  ON "email_notifications"
  FOR ALL
  TO access_worker
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON TABLE "email_notifications" TO access_worker;

-- The recipient: users has no RLS (identity table), so the grant is limited to two columns.
GRANT SELECT ("id", "email") ON TABLE "users" TO access_worker;

-- The ticket type name shown in the e-mail.
CREATE POLICY "ticket_types_worker_read"
  ON "ticket_types"
  FOR SELECT
  TO access_worker
  USING (true);

GRANT SELECT ("id", "name") ON TABLE "ticket_types" TO access_worker;
