CREATE TABLE market_ornament (
    id varchar(8) PRIMARY KEY,
    status varchar(12) NOT NULL CHECK (status IN ('unpainted', 'painted', 'sold')),
    sold_at timestamptz,
    revision integer NOT NULL DEFAULT 0,
    photo bytea,
    CHECK ((status = 'sold') = (sold_at IS NOT NULL))
);

INSERT INTO market_ornament (id, status)
SELECT id, CASE WHEN id IN ('RM01', 'RM02', 'RM03', 'RM04', 'RM05', 'WS01', 'WM01', 'GS01', 'CS01', 'CS02')
                THEN 'painted' ELSE 'unpainted' END
FROM (
    SELECT prefix || lpad(n::text, 2, '0') AS id
    FROM (VALUES ('RS', 12), ('RM', 9), ('WS', 12), ('WM', 6),
                 ('GS', 16), ('GM', 8), ('CS', 16), ('CM', 8)) AS groups(prefix, quantity)
    CROSS JOIN LATERAL generate_series(1, quantity) AS numbers(n)
) AS ornaments;

ALTER TABLE order_item ADD COLUMN market_ornament_id varchar(8) REFERENCES market_ornament(id);
CREATE INDEX idx_order_item_market_ornament ON order_item(market_ornament_id);
