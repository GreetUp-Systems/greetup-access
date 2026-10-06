-- SPEC-005 v1.8: the buyer reads the event and ticket type of their own purchases, in the user
-- context, so the checkout survives a reload before any ticket exists (SPEC-014 §5). The
-- subqueries run under the purchases buyer policy, so only owned purchases count.

CREATE POLICY "events_purchase_buyer_read"
  ON "events"
  FOR SELECT
  TO access_app_runtime
  USING (
    EXISTS (
      SELECT 1
      FROM "purchases"
      WHERE "purchases"."event_id" = "events"."id"
        AND "purchases"."buyer_user_id" = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
  );

CREATE POLICY "ticket_types_purchase_buyer_read"
  ON "ticket_types"
  FOR SELECT
  TO access_app_runtime
  USING (
    EXISTS (
      SELECT 1
      FROM "purchases"
      WHERE "purchases"."ticket_type_id" = "ticket_types"."id"
        AND "purchases"."buyer_user_id" = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
  );
