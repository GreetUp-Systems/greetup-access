-- The user signs the activation in the browser (D-28, SPEC-005 §12, SPEC-003 §10): while SIGNING,
-- the prepared transaction waits here without signatures. Signatures are never stored.
ALTER TABLE "wallet_activations" ADD COLUMN "prepared_envelope_xdr" TEXT;
ALTER TABLE "stellar_account_provisionings" ADD COLUMN "prepared_envelope_xdr" TEXT;
