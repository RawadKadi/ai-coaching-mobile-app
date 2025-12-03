-- Enable realtime UPDATE events for messages table
-- Messages table is already in the realtime publication
-- We just need to ensure REPLICA IDENTITY is set to FULL
-- so UPDATE events include all column data

-- Set replica identity to FULL so UPDATE events include all columns
ALTER TABLE messages REPLICA IDENTITY FULL;

COMMENT ON TABLE messages IS 'Realtime enabled for INSERT and UPDATE events with FULL replica identity';
