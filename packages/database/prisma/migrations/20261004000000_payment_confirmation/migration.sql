-- SPEC-005 6B: the verified BlindPay webhook confirms payments and creates the tickets to mint.
GRANT USAGE ON TYPE "PurchaseStatus", "TicketStatus" TO access_blindpay_webhook;
GRANT SELECT, UPDATE ON TABLE "purchases" TO access_blindpay_webhook;
GRANT SELECT, INSERT ON TABLE "tickets" TO access_blindpay_webhook;

CREATE POLICY "purchases_verified_webhook_read"
  ON "purchases" FOR SELECT TO access_blindpay_webhook USING (true);

CREATE POLICY "purchases_verified_webhook_update"
  ON "purchases" FOR UPDATE TO access_blindpay_webhook USING (true) WITH CHECK (true);

CREATE POLICY "tickets_verified_webhook_read"
  ON "tickets" FOR SELECT TO access_blindpay_webhook USING (true);

-- Tickets are created only alongside the purchase they belong to.
CREATE POLICY "tickets_verified_webhook_insert"
  ON "tickets" FOR INSERT TO access_blindpay_webhook
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "purchases"
      WHERE "purchases"."id" = "tickets"."purchase_id"
        AND "purchases"."buyer_user_id" = "tickets"."owner_user_id"
        AND "purchases"."producer_id" = "tickets"."producer_id"
        AND "purchases"."event_id" = "tickets"."event_id"
        AND "purchases"."ticket_type_id" = "tickets"."ticket_type_id"
    )
  );

-- Worker processes (OutboxRelay now, MintTicketWorker in 6C) use their own restricted role.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'access_worker') THEN
    CREATE ROLE access_worker
      NOLOGIN
      NOSUPERUSER
      NOBYPASSRLS
      NOCREATEDB
      NOCREATEROLE
      NOREPLICATION;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO access_worker;
GRANT USAGE ON TYPE "OutboxEventStatus" TO access_worker;
GRANT SELECT, UPDATE ON TABLE "outbox_events" TO access_worker;
