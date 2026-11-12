-- 2026-11-05: colors red/green/beige with a shiny or matte finish, data retention, waitlist double opt-in.

-- Colors: beige is new; grey and white stay valid for older orders and stock rows.
ALTER TABLE inventory DROP CONSTRAINT IF EXISTS inventory_custom_color_check;
ALTER TABLE inventory ADD CONSTRAINT inventory_custom_color_check
    CHECK (custom_color IN ('RED', 'GREY', 'GREEN', 'WHITE', 'BEIGE'));
ALTER TABLE order_item DROP CONSTRAINT IF EXISTS order_item_custom_color_check;
ALTER TABLE order_item ADD CONSTRAINT order_item_custom_color_check
    CHECK (custom_color IN ('RED', 'GREY', 'GREEN', 'WHITE', 'BEIGE'));

-- Finish: stock is per color and finish. Existing custom stock and ornaments were shiny.
ALTER TABLE inventory ADD COLUMN custom_finish character varying(255);
ALTER TABLE inventory ADD CONSTRAINT inventory_custom_finish_check CHECK (custom_finish IN ('SHINY', 'MATTE'));
UPDATE inventory SET custom_finish = 'SHINY' WHERE item_kind = 'CUSTOM';
ALTER TABLE order_item ADD COLUMN custom_finish character varying(255);
ALTER TABLE order_item ADD CONSTRAINT order_item_custom_finish_check CHECK (custom_finish IN ('SHINY', 'MATTE'));
UPDATE order_item SET custom_finish = 'SHINY' WHERE item_kind = 'CUSTOM';

-- Retention: the form link expires and personal data is erased counting from the handover.
-- Orders already handed over start counting now.
ALTER TABLE orders ADD COLUMN handed_over_at timestamp(6) with time zone;
ALTER TABLE orders ADD COLUMN anonymized_at timestamp(6) with time zone;
UPDATE orders SET handed_over_at = now() WHERE handed_over;

-- Waitlist double opt-in. Earlier sign-ups were never confirmed, so they get a token and count as unconfirmed.
ALTER TABLE waitlist_entry ADD COLUMN token character varying(64);
ALTER TABLE waitlist_entry ADD COLUMN confirmed_at timestamp(6) with time zone;
UPDATE waitlist_entry SET token = md5(random()::text || id::text) || md5(random()::text || email);
ALTER TABLE waitlist_entry ALTER COLUMN token SET NOT NULL;
ALTER TABLE waitlist_entry ADD CONSTRAINT waitlist_entry_token_key UNIQUE (token);
