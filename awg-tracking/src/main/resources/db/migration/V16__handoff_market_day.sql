ALTER TABLE order_item ADD COLUMN handoff_day_id uuid REFERENCES market_day(id);
CREATE INDEX idx_order_item_handoff_day ON order_item(handoff_day_id);

-- Prefer the market day matching sold_on_day_id, then the earliest-opening stall (tie: market name).
UPDATE order_item oi
SET handoff_day_id = (
    SELECT md.id
    FROM market_day md
    JOIN market m ON m.id = md.market_id
    WHERE md.date = oi.handoff_date AND m.kind = 'MARKET'
    ORDER BY CASE WHEN md.id = oi.sold_on_day_id THEN 0 ELSE 1 END, md.open_time, m.name, md.id
    LIMIT 1
)
WHERE oi.delivery_kind = 'MARKET';

ALTER TABLE painting_day ADD COLUMN painting_market_id uuid REFERENCES market(id) ON DELETE SET NULL;
