-- Austrian Post shipping replaces hand delivery in Vienna (owner, 2026-11-20).
-- Old 'DELIVERY' (Vienna) items stay as they are and keep rendering as Vienna deliveries.

-- Staff-editable shipping fee and Post collection weekdays (comma-separated java.time.DayOfWeek
-- names). Null means the awg.pricing.shipping / awg.post.* defaults still apply.
ALTER TABLE price_setting ADD COLUMN shipping_fee NUMERIC(10,2);
ALTER TABLE price_setting ADD COLUMN post_collection_days VARCHAR(80);

-- Overrides apply on the actual collection date, after holiday shifts.
CREATE TABLE post_collection_day (
    date DATE PRIMARY KEY,
    open BOOLEAN NOT NULL
);

-- Estimated arrival range promised to the customer (working days after the Post collection day,
-- which is stored in order_item.handoff_date).
ALTER TABLE order_item ADD COLUMN arrival_from DATE;
ALTER TABLE order_item ADD COLUMN arrival_to DATE;

-- Optional Austrian Post parcel number, entered by staff when the parcel is handed to the Post.
ALTER TABLE orders ADD COLUMN tracking_number VARCHAR(40);

-- Allow the new delivery kind.
ALTER TABLE order_item DROP CONSTRAINT IF EXISTS order_item_delivery_kind_check;
ALTER TABLE order_item ADD CONSTRAINT order_item_delivery_kind_check
    CHECK (delivery_kind IN ('MARKET', 'DELIVERY', 'POST'));

-- Idempotent replays of POST /api/agenda/make-room.
CREATE TABLE make_room_replay (
    idempotency_key VARCHAR(64) PRIMARY KEY,
    request_hash VARCHAR(64) NOT NULL,
    response_body TEXT NOT NULL
);
