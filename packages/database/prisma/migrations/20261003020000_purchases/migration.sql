CREATE TYPE "PurchaseStatus" AS ENUM (
  'initiated',
  'awaiting_payment',
  'payment_confirmed',
  'ticket_issued',
  'payment_failed',
  'payment_refunded'
);

CREATE TYPE "TicketStatus" AS ENUM (
  'pending_mint',
  'issued'
);

CREATE TABLE "purchases" (
  "id" UUID NOT NULL,
  "buyer_user_id" UUID NOT NULL,
  "producer_id" UUID NOT NULL,
  "event_id" UUID NOT NULL,
  "ticket_type_id" UUID NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unit_price_cents" INTEGER NOT NULL,
  "subtotal_cents" INTEGER NOT NULL,
  "total_cents" INTEGER,
  "service_fee_cents" INTEGER,
  "receiver_amount" BIGINT,
  "blindpay_flat_fee" BIGINT,
  "partner_fee_amount" BIGINT,
  "commercial_rate" DECIMAL(20,10),
  "blindpay_rate" DECIMAL(20,10),
  "external_quote_id" TEXT,
  "quote_expires_at" TIMESTAMP(3),
  "external_payin_id" TEXT,
  "pix_code" TEXT,
  "idempotency_key" VARCHAR(128) NOT NULL,
  "status" "PurchaseStatus" NOT NULL DEFAULT 'initiated',
  "failure_code" VARCHAR(80),
  "payment_confirmed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "purchases_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "purchases_quantity_range" CHECK ("quantity" BETWEEN 1 AND 10),
  CONSTRAINT "purchases_unit_price_positive" CHECK ("unit_price_cents" > 0),
  CONSTRAINT "purchases_subtotal_minimum" CHECK ("subtotal_cents" >= 1000)
);

CREATE UNIQUE INDEX "purchases_external_quote_id_key" ON "purchases"("external_quote_id");
CREATE UNIQUE INDEX "purchases_external_payin_id_key" ON "purchases"("external_payin_id");
CREATE UNIQUE INDEX "purchases_buyer_user_id_idempotency_key_key"
  ON "purchases"("buyer_user_id", "idempotency_key");
CREATE INDEX "purchases_ticket_type_id_status_idx" ON "purchases"("ticket_type_id", "status");
CREATE INDEX "purchases_producer_id_created_at_idx" ON "purchases"("producer_id", "created_at");

ALTER TABLE "purchases"
  ADD CONSTRAINT "purchases_buyer_user_id_fkey"
  FOREIGN KEY ("buyer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "purchases_producer_id_fkey"
  FOREIGN KEY ("producer_id") REFERENCES "producer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "purchases_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "purchases_ticket_type_id_fkey"
  FOREIGN KEY ("ticket_type_id") REFERENCES "ticket_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "tickets" (
  "id" UUID NOT NULL,
  "purchase_id" UUID NOT NULL,
  "producer_id" UUID NOT NULL,
  "event_id" UUID NOT NULL,
  "ticket_type_id" UUID NOT NULL,
  "owner_user_id" UUID NOT NULL,
  "status" "TicketStatus" NOT NULL DEFAULT 'pending_mint',
  "token_id" INTEGER,
  "mint_tx_hash" VARCHAR(64),
  "issued_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tickets_token_id_key" ON "tickets"("token_id");
CREATE INDEX "tickets_purchase_id_idx" ON "tickets"("purchase_id");
CREATE INDEX "tickets_owner_user_id_idx" ON "tickets"("owner_user_id");

ALTER TABLE "tickets"
  ADD CONSTRAINT "tickets_purchase_id_fkey"
  FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "tickets_producer_id_fkey"
  FOREIGN KEY ("producer_id") REFERENCES "producer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "tickets_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "tickets_ticket_type_id_fkey"
  FOREIGN KEY ("ticket_type_id") REFERENCES "ticket_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "tickets_owner_user_id_fkey"
  FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "purchases" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "purchases" FORCE ROW LEVEL SECURITY;
ALTER TABLE "tickets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tickets" FORCE ROW LEVEL SECURITY;

-- Runtime: the buyer reads and advances their own purchases; the producer only reads its sales.
CREATE POLICY "purchases_buyer_read"
  ON "purchases" FOR SELECT TO access_app_runtime
  USING ("buyer_user_id" = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

CREATE POLICY "purchases_buyer_update"
  ON "purchases" FOR UPDATE TO access_app_runtime
  USING ("buyer_user_id" = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
  WITH CHECK ("buyer_user_id" = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

CREATE POLICY "purchases_producer_read"
  ON "purchases" FOR SELECT TO access_app_runtime
  USING ("producer_id" = NULLIF(current_setting('app.current_producer_id', true), '')::uuid);

CREATE POLICY "tickets_owner_read"
  ON "tickets" FOR SELECT TO access_app_runtime
  USING ("owner_user_id" = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

CREATE POLICY "tickets_producer_read"
  ON "tickets" FOR SELECT TO access_app_runtime
  USING ("producer_id" = NULLIF(current_setting('app.current_producer_id', true), '')::uuid);

GRANT USAGE ON TYPE "PurchaseStatus", "TicketStatus" TO access_app_runtime;
GRANT SELECT, UPDATE ON TABLE "purchases" TO access_app_runtime;
GRANT SELECT ON TABLE "tickets" TO access_app_runtime;

-- Stock still committed by a purchase. Single source for the reservation and for producer edits.
-- Runs with the caller's rights, so each caller sees only what its policies allow.
CREATE FUNCTION "committed_ticket_quantity"(p_ticket_type_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(SUM("quantity"), 0)::INTEGER
  FROM "purchases"
  WHERE "ticket_type_id" = p_ticket_type_id
    AND (
      "status" IN ('awaiting_payment', 'payment_confirmed', 'ticket_issued')
      OR ("status" = 'initiated' AND "created_at" > LOCALTIMESTAMP - INTERVAL '10 minutes')
    );
$$;

REVOKE ALL ON FUNCTION "committed_ticket_quantity"(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "committed_ticket_quantity"(UUID) TO access_app_runtime;

-- Checkout (SPEC-005 §13): the buyer needs data owned by other tenants. Two SECURITY DEFINER
-- functions owned by a NOLOGIN, NOBYPASSRLS role expose exactly that, without opening tables.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'access_checkout') THEN
    CREATE ROLE access_checkout
      NOLOGIN
      NOSUPERUSER
      NOBYPASSRLS
      NOCREATEDB
      NOCREATEROLE
      NOREPLICATION;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO access_checkout;
GRANT USAGE ON TYPE "EventStatus", "PurchaseStatus", "StellarProvisioningStatus",
  "BlindPayCustomerCreationStatus", "BlindPayKycStatus"
  TO access_checkout;
GRANT SELECT ON TABLE "events", "stellar_account_provisionings", "blindpay_customers"
  TO access_checkout;
GRANT SELECT ON TABLE "ticket_types" TO access_checkout;
-- Row locks need UPDATE privilege; the policy below never lets a row actually change.
GRANT UPDATE ("id") ON TABLE "ticket_types" TO access_checkout;
GRANT SELECT, INSERT ON TABLE "purchases" TO access_checkout;

CREATE POLICY "events_checkout_read"
  ON "events" FOR SELECT TO access_checkout USING (true);
CREATE POLICY "stellar_account_provisionings_checkout_read"
  ON "stellar_account_provisionings" FOR SELECT TO access_checkout USING (true);
CREATE POLICY "blindpay_customers_checkout_read"
  ON "blindpay_customers" FOR SELECT TO access_checkout USING (true);
CREATE POLICY "ticket_types_checkout_read"
  ON "ticket_types" FOR SELECT TO access_checkout USING (true);
CREATE POLICY "ticket_types_checkout_lock"
  ON "ticket_types" FOR UPDATE TO access_checkout USING (true) WITH CHECK (false);
CREATE POLICY "purchases_checkout_read"
  ON "purchases" FOR SELECT TO access_checkout USING (true);
CREATE POLICY "purchases_checkout_insert"
  ON "purchases" FOR INSERT TO access_checkout
  WITH CHECK ("buyer_user_id" = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

GRANT EXECUTE ON FUNCTION "committed_ticket_quantity"(UUID) TO access_checkout;

-- Sales destination and readiness inputs for a published ticket type.
CREATE FUNCTION "checkout_listing"(p_ticket_type_id UUID)
RETURNS TABLE (
  listing_ticket_type_id UUID,
  listing_event_id UUID,
  listing_producer_id UUID,
  listing_starts_at TIMESTAMPTZ,
  listing_unit_price_cents INTEGER,
  listing_stellar_status "StellarProvisioningStatus",
  listing_customer_creation_status "BlindPayCustomerCreationStatus",
  listing_kyc_status "BlindPayKycStatus",
  listing_blockchain_wallet_id TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    tt."id",
    e."id",
    e."producer_id",
    e."starts_at",
    tt."price_cents",
    sp."status",
    bc."creation_status",
    bc."kyc_status",
    bc."external_blockchain_wallet_id"
  FROM "ticket_types" tt
  JOIN "events" e ON e."id" = tt."event_id"
  LEFT JOIN "stellar_account_provisionings" sp ON sp."producer_id" = e."producer_id"
  LEFT JOIN "blindpay_customers" bc ON bc."producer_id" = e."producer_id" AND bc."is_current"
  WHERE tt."id" = p_ticket_type_id
    AND e."status" = 'published';
$$;

-- Reserves stock and records the purchase atomically. The buyer always comes from the
-- transaction context, never from an argument. Errors are raised with stable codes.
CREATE FUNCTION "reserve_purchase"(
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
  IF v_subtotal < 1000 THEN
    RAISE EXCEPTION 'purchase_below_minimum';
  END IF;
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

ALTER FUNCTION "checkout_listing"(UUID) OWNER TO access_checkout;
ALTER FUNCTION "reserve_purchase"(UUID, INTEGER, TEXT) OWNER TO access_checkout;
REVOKE ALL ON FUNCTION "checkout_listing"(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION "reserve_purchase"(UUID, INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "checkout_listing"(UUID) TO access_app_runtime;
GRANT EXECUTE ON FUNCTION "reserve_purchase"(UUID, INTEGER, TEXT) TO access_app_runtime;
