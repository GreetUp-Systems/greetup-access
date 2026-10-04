-- SPEC-008 §10: the ticket owner reads the event and ticket type of their own tickets, in the
-- user context. The subqueries run under the tickets owner policy, so only owned tickets count.

CREATE POLICY "events_ticket_owner_read"
  ON "events"
  FOR SELECT
  TO access_app_runtime
  USING (
    EXISTS (
      SELECT 1
      FROM "tickets"
      WHERE "tickets"."event_id" = "events"."id"
        AND "tickets"."owner_user_id" = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
  );

CREATE POLICY "ticket_types_ticket_owner_read"
  ON "ticket_types"
  FOR SELECT
  TO access_app_runtime
  USING (
    EXISTS (
      SELECT 1
      FROM "tickets"
      WHERE "tickets"."ticket_type_id" = "ticket_types"."id"
        AND "tickets"."owner_user_id" = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
  );
