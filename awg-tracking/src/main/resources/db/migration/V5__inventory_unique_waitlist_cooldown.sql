-- Review fixes for V4: one stock row per kind/color/finish, waitlist resend cooldown, secure tokens.
CREATE UNIQUE INDEX inventory_kind_color_finish_key
    ON inventory (item_kind, COALESCE(custom_color, ''), COALESCE(custom_finish, ''));

ALTER TABLE waitlist_entry ADD COLUMN last_sent_at timestamp(6) with time zone;

-- V4 built tokens for older sign-ups from random()/md5; replace them with gen_random_uuid() (CSPRNG).
UPDATE waitlist_entry
SET token = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
WHERE confirmed_at IS NULL AND last_sent_at IS NULL;
