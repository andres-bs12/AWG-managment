-- Metrics never share the painting reservation lock (id 1).
INSERT INTO schedule_lock (id) VALUES (2) ON CONFLICT (id) DO NOTHING;
