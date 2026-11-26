-- V20 created back_name_max as SMALLINT, but PriceSetting maps it to Integer and Hibernate's
-- ddl-auto=validate refuses to start (production outage, 2026-11-26). INTEGER is lossless.
-- Production was fixed by hand with this same statement; on an INTEGER column it changes nothing.
ALTER TABLE price_setting ALTER COLUMN back_name_max TYPE INTEGER;
