-- Which client a staff session belongs to: 'app' (staff web app) or 'mcp' (Claude connector).
-- MCP sessions only open /mcp, so a leaked connector token cannot use the rest of the staff API.
ALTER TABLE staff_session ADD COLUMN audience varchar(8) NOT NULL DEFAULT 'app';
ALTER TABLE staff_session ADD CONSTRAINT staff_session_audience_check CHECK (audience IN ('app', 'mcp'));
