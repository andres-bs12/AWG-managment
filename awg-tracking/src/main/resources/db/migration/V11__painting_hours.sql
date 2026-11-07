-- Painting hours are independent from MarketDay opening/pickup hours.
-- Existing rows inherit their preferred market/home day until Gaby edits them.
ALTER TABLE painting_day ADD COLUMN open_hour double precision;
ALTER TABLE painting_day ADD COLUMN close_hour double precision;
ALTER TABLE painting_day ADD CONSTRAINT painting_day_hours_valid CHECK (
    (open_hour IS NULL AND close_hour IS NULL)
    OR (open_hour IS NOT NULL AND close_hour IS NOT NULL
        AND open_hour >= 0 AND close_hour < 24 AND open_hour < close_hour
        AND open_hour * 4 = floor(open_hour * 4)
        AND close_hour * 4 = floor(close_hour * 4))
);
