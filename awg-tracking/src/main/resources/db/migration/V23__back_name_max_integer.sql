-- V20 added back_name_max as SMALLINT, but PriceSetting.backNameMax is an Integer and Hibernate's
-- schema validation rejected it at startup (production outage on 2026-11-26). Production was fixed by
-- hand with this same statement; on that database it is a no-op, elsewhere it aligns the column.
ALTER TABLE price_setting ALTER COLUMN back_name_max TYPE integer;
