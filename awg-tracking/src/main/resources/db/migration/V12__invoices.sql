-- One transactional number series for all issued documents, including replacements.
CREATE TABLE invoice_counter (
    id BIGINT PRIMARY KEY,
    last_number BIGINT NOT NULL
);
INSERT INTO invoice_counter (id, last_number) VALUES (1, 0);

-- No FK: cancellation/retention of operational orders must not erase accounting documents.
CREATE TABLE invoice (
    number BIGINT PRIMARY KEY,
    order_id UUID NOT NULL,
    state_key VARCHAR(128) NOT NULL,
    issued_at TIMESTAMP WITH TIME ZONE NOT NULL,
    recipient VARCHAR(255) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE,
    attempts INTEGER NOT NULL DEFAULT 0,
    UNIQUE (order_id, state_key)
);
CREATE INDEX invoice_pending_idx ON invoice (number) WHERE sent_at IS NULL;
