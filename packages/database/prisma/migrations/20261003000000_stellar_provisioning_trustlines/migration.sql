-- Expected trustlines come from configuration and are verified on-chain (SPEC-003 v1.4).
ALTER TABLE "stellar_account_provisionings"
  DROP COLUMN "asset_code",
  DROP COLUMN "asset_issuer";
