-- SPEC-004 v2.2 (SPEC-014, 9A): end time, venue in two parts and public availability.

-- The single location becomes the address; column grants follow the renamed column.
ALTER TABLE "events" RENAME COLUMN "location" TO "address";
ALTER TABLE "events"
  ADD COLUMN "venue_name" VARCHAR(120),
  ADD COLUMN "ends_at" TIMESTAMPTZ(3);
ALTER TABLE "events"
  ADD CONSTRAINT "events_ends_after_start" CHECK ("ends_at" IS NULL OR "ends_at" > "starts_at");

-- Remaining tickets per type of a published or cancelled event. The public page has no user
-- context and purchases are under RLS, so the count runs with the checkout role's read policies,
-- using the same committed-stock rule as the reservation (SPEC-005 §8).
CREATE FUNCTION "public_ticket_availability"(p_event_id UUID)
RETURNS TABLE (availability_ticket_type_id UUID, availability_remaining INTEGER)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    tt."id",
    GREATEST(tt."quantity" - committed_ticket_quantity(tt."id"), 0)::INTEGER
  FROM "ticket_types" tt
  JOIN "events" e ON e."id" = tt."event_id"
  WHERE tt."event_id" = p_event_id
    AND e."status" IN ('published', 'cancelled');
$$;

ALTER FUNCTION "public_ticket_availability"(UUID) OWNER TO access_checkout;
REVOKE ALL ON FUNCTION "public_ticket_availability"(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public_ticket_availability"(UUID) TO access_app_runtime;
