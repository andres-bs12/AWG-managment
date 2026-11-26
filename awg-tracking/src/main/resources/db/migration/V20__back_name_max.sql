-- Staff-editable maximum length of the name painted on the back (owner, 2026-11-23: cut from 6 to 5).
-- Null means the server default (5) applies. Names already saved on orders are kept as they are.
ALTER TABLE price_setting ADD COLUMN back_name_max SMALLINT;
