-- Unpainted bases are counted per size too (owner, 2026-11-26): Big 10 cm and Medium 8 cm.
-- Every counted base so far is a big one; medium bases start at 0 until staff counts them on Stock.
ALTER TABLE inventory ADD COLUMN ornament_size VARCHAR(16);
UPDATE inventory SET ornament_size = 'BIG' WHERE item_kind = 'CUSTOM';
ALTER TABLE inventory ADD CONSTRAINT inventory_ornament_size_check CHECK (ornament_size IN ('BIG', 'MEDIUM'));

DROP INDEX inventory_kind_color_finish_key;
CREATE UNIQUE INDEX inventory_kind_color_finish_size_key
    ON inventory (item_kind, COALESCE(custom_color, ''), COALESCE(custom_finish, ''), COALESCE(ornament_size, ''));

INSERT INTO inventory (id, item_kind, custom_color, custom_finish, ornament_size, quantity)
SELECT gen_random_uuid(), 'CUSTOM', custom_color, custom_finish, 'MEDIUM', 0
  FROM inventory
 WHERE item_kind = 'CUSTOM' AND ornament_size = 'BIG';
