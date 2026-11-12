-- Sprint 4: per-day painting limits, shop waitlist, deposit amount.
CREATE TABLE painting_day (
    date date NOT NULL PRIMARY KEY,
    open boolean NOT NULL,
    max_paintings integer NOT NULL
);

CREATE TABLE waitlist_entry (
    id uuid NOT NULL PRIMARY KEY,
    email character varying(200) NOT NULL UNIQUE,
    locale character varying(2) NOT NULL,
    created_at timestamp(6) with time zone NOT NULL
);

ALTER TABLE orders ADD COLUMN amount_paid numeric(10,2) NOT NULL DEFAULT 0;
UPDATE orders SET amount_paid = total WHERE payment_state = 'PAID';
UPDATE orders SET amount_paid = round(total / 2, 2) WHERE payment_state = 'DEPOSIT';
