-- Owner, 2026-11-22: a new paid web order stays in "Needs attention" until staff marks it reviewed,
-- and customer e-mails go out in the language the customer chose (German by default).

ALTER TABLE orders ADD COLUMN reviewed_at TIMESTAMP WITH TIME ZONE;
-- Everything that exists today has already been seen; only new web orders need a review.
UPDATE orders SET reviewed_at = created_at;

ALTER TABLE orders ADD COLUMN locale VARCHAR(2) NOT NULL DEFAULT 'de';
