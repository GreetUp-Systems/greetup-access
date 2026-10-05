-- The Pix minimum is US$ 10 at the current rate (D-26, SPEC-005 v1.6): the minimum ticket price
-- covers it in the API, so the database no longer pins R$ 10. CREATE OR REPLACE keeps the owner
-- (access_checkout) and the grants of the function.
ALTER TABLE "purchases" DROP CONSTRAINT "purchases_subtotal_minimum";
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_subtotal_positive" CHECK ("subtotal_cents" > 0);

-- Reserves stock and records the purchase atomically. The buyer always comes from the
-- transaction context, never from an argument. Errors are raised with stable codes.
CREATE OR REPLACE FUNCTION "reserve_purchase"(
  p_ticket_type_id UUID,
  p_quantity INTEGER,
  p_idempotency_key TEXT
)
RETURNS TABLE (reserved_purchase_id UUID, reserved_created BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_buyer UUID := NULLIF(current_setting('app.current_user_id', true), '')::uuid;
  v_type "ticket_types"%ROWTYPE;
  v_event "events"%ROWTYPE;
  v_existing "purchases"%ROWTYPE;
  v_subtotal BIGINT;
  v_id UUID;
BEGIN
  IF v_buyer IS NULL THEN
    RAISE EXCEPTION 'checkout_user_context_missing';
  END IF;
  IF p_quantity < 1 OR p_quantity > 10 THEN
    RAISE EXCEPTION 'purchase_invalid_quantity';
  END IF;

  -- Serializes every reservation of this ticket type (SPEC-005 §8).
  SELECT * INTO v_type FROM "ticket_types" WHERE "id" = p_ticket_type_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ticket_type_not_found';
  END IF;

  SELECT * INTO v_existing
  FROM "purchases"
  WHERE "buyer_user_id" = v_buyer AND "idempotency_key" = p_idempotency_key;
  IF FOUND THEN
    IF v_existing."ticket_type_id" <> p_ticket_type_id OR v_existing."quantity" <> p_quantity THEN
      RAISE EXCEPTION 'purchase_idempotency_conflict';
    END IF;
    RETURN QUERY SELECT v_existing."id", false;
    RETURN;
  END IF;

  SELECT * INTO v_event FROM "events" WHERE "id" = v_type."event_id";
  IF v_event."status" <> 'published' OR v_event."starts_at" <= now() THEN
    RAISE EXCEPTION 'event_not_on_sale';
  END IF;

  v_subtotal := v_type."price_cents"::BIGINT * p_quantity;
  -- The Pix minimum and the order ceiling depend on the exchange rate and live in the API
  -- (D-26); here only the column's integer range is guarded.
  IF v_subtotal > 2147483647 THEN
    RAISE EXCEPTION 'purchase_above_maximum';
  END IF;

  IF "committed_ticket_quantity"(p_ticket_type_id) + p_quantity > v_type."quantity" THEN
    RAISE EXCEPTION 'ticket_type_sold_out';
  END IF;

  v_id := gen_random_uuid();
  INSERT INTO "purchases" (
    "id", "buyer_user_id", "producer_id", "event_id", "ticket_type_id", "quantity",
    "unit_price_cents", "subtotal_cents", "idempotency_key", "status", "updated_at"
  ) VALUES (
    v_id, v_buyer, v_event."producer_id", v_event."id", v_type."id", p_quantity,
    v_type."price_cents", v_subtotal::INTEGER, p_idempotency_key, 'initiated', CURRENT_TIMESTAMP
  );

  RETURN QUERY SELECT v_id, true;
END;
$$;
