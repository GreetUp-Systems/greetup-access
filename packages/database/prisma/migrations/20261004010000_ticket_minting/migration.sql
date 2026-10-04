-- SPEC-005 6C: the MintTicketWorker reads what it mints and advances only its own states.
GRANT USAGE ON TYPE "PurchaseStatus", "TicketStatus", "EventStatus" TO access_worker;
GRANT SELECT, UPDATE ON TABLE "purchases" TO access_worker;
GRANT SELECT, UPDATE ON TABLE "tickets" TO access_worker;
GRANT SELECT ON TABLE "events", "wallet_accounts" TO access_worker;
GRANT INSERT ON TABLE "outbox_events" TO access_worker;

CREATE POLICY "purchases_worker_read"
  ON "purchases" FOR SELECT TO access_worker USING (true);

-- Only a confirmed purchase can move, and only to ticket_issued.
CREATE POLICY "purchases_worker_issue"
  ON "purchases" FOR UPDATE TO access_worker
  USING ("status" = 'payment_confirmed')
  WITH CHECK ("status" IN ('payment_confirmed', 'ticket_issued'));

CREATE POLICY "tickets_worker_read"
  ON "tickets" FOR SELECT TO access_worker USING (true);

-- Only pending tickets of a paid purchase can be issued.
CREATE POLICY "tickets_worker_issue"
  ON "tickets" FOR UPDATE TO access_worker
  USING (
    "status" = 'pending_mint'
    AND EXISTS (
      SELECT 1
      FROM "purchases"
      WHERE "purchases"."id" = "tickets"."purchase_id"
        AND "purchases"."status" = 'payment_confirmed'
    )
  )
  WITH CHECK ("status" IN ('pending_mint', 'issued'));

CREATE POLICY "events_worker_read"
  ON "events" FOR SELECT TO access_worker USING (true);
