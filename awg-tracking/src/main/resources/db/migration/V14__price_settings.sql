-- Staff-editable prices. No row means the awg.pricing.* defaults still apply.
CREATE TABLE price_setting (
    id BIGINT PRIMARY KEY,
    custom_price NUMERIC(10,2) NOT NULL,
    finished_price NUMERIC(10,2) NOT NULL,
    name_extra NUMERIC(10,2) NOT NULL,
    revision BIGINT NOT NULL,
    updated_at TIMESTAMP(6) WITH TIME ZONE NOT NULL
);

-- The name surcharge charged at sale time, so invoices stay correct after a price change.
ALTER TABLE order_item ADD COLUMN name_extra NUMERIC(10,2);
-- Every item sold before this release paid the only surcharge that ever existed (EUR 12.99,
-- awg.pricing.name-extra; production never overrode it). Freezing it here keeps old invoices
-- right even if the configured default changes later.
UPDATE order_item SET name_extra = 12.99 WHERE with_name;
