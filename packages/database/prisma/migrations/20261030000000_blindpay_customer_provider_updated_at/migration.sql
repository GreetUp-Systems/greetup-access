-- BlindPay delivers customer events out of order (SPEC-003 v1.9): the updated_at of the stored
-- status, as BlindPay reported it, so an older event never overwrites a newer one. Null until a
-- status with a date is stored.
ALTER TABLE "blindpay_customers" ADD COLUMN "provider_updated_at" TIMESTAMP(3);
