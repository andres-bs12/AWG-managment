ALTER TABLE orders ADD COLUMN checkout_client_hash VARCHAR(64);
CREATE INDEX idx_orders_pending_client ON orders (checkout_status, checkout_client_hash);

-- Shorten reservations already open when this version is deployed.
UPDATE orders SET checkout_expires_at = created_at + INTERVAL '15 minutes'
WHERE source = 'WEB' AND checkout_status = 'PENDING'
  AND (checkout_expires_at IS NULL OR checkout_expires_at > created_at + INTERVAL '15 minutes');
