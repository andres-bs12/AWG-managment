-- Staff can sell for less than the list price at the stall (owner, 2026-11-26), e.g. 3 × 35 € for 90 €.
-- orders.total stays the amount actually charged; discount keeps the difference so the list price is still known.
ALTER TABLE orders ADD COLUMN discount NUMERIC(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD CONSTRAINT orders_discount_check CHECK (discount >= 0);
