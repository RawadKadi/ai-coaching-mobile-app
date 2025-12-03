-- Enable realtime UPDATE events for sessions table
-- This allows clients to receive real-time notifications when sessions are cancelled

-- Ensure sessions is in the realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE sessions;
  END IF;
END $$;

-- Set replica identity to FULL so UPDATE events include all columns
ALTER TABLE sessions REPLICA IDENTITY FULL;

COMMENT ON TABLE sessions IS 'Realtime enabled for INSERT and UPDATE events with FULL replica identity';
