-- Optimistic locking: a public form/address write can no longer silently overwrite a concurrent
-- staff, webhook or scheduling change with stale column values (security audit 2026-11-05).
ALTER TABLE customer ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE order_item ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
