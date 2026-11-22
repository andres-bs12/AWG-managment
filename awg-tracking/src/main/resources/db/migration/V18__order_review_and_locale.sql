-- Owner, 2026-11-22: a new paid web order stays in "Needs attention" until staff marks it reviewed,
-- and customer e-mails go out in the language the customer chose (German by default).

ALTER TABLE orders ADD COLUMN reviewed_at TIMESTAMP WITH TIME ZONE;
-- Everything that exists today has already been seen, except web checkouts not paid yet:
-- if one is confirmed after this migration it must still reach the review queue.
UPDATE orders SET reviewed_at = created_at
 WHERE source IS NULL OR source <> 'WEB' OR checkout_status IS NULL OR checkout_status NOT IN ('PENDING', 'REVIEW');

ALTER TABLE orders ADD COLUMN locale VARCHAR(2) NOT NULL DEFAULT 'de';
