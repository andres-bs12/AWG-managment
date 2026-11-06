ALTER TABLE order_item ADD COLUMN handed_over BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE order_item SET handed_over = TRUE WHERE order_id IN (SELECT id FROM orders WHERE handed_over = TRUE);
