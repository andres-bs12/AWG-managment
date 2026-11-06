-- Sprint 5 (audit fixes): idempotent staff sales and payments that need manual review.
ALTER TABLE orders ADD COLUMN idempotency_key character varying(64);
ALTER TABLE orders ADD CONSTRAINT orders_idempotency_key_key UNIQUE (idempotency_key);

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_checkout_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_checkout_status_check
    CHECK (checkout_status IN ('PENDING', 'CONFIRMED', 'REVIEW'));
