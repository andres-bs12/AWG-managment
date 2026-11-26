-- Personalised ornaments come in two sizes (owner, 2026-11-26): Big 10 cm and Medium 8 cm.
-- Every custom ornament sold before this release was the big one.
ALTER TABLE order_item ADD COLUMN ornament_size VARCHAR(16);
UPDATE order_item SET ornament_size = 'BIG' WHERE item_kind = 'CUSTOM';

-- Price of the medium personalised ornament; custom_price is now the big one.
ALTER TABLE price_setting ADD COLUMN custom_medium_price NUMERIC(10,2);
-- Prices the owner set on 2026-11-26: big 50, medium 45, non-personalised 35 (all editable on Stock).
UPDATE price_setting
   SET custom_price = 50.00, custom_medium_price = 45.00, finished_price = 35.00, revision = revision + 1;
