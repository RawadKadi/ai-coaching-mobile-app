-- Enable Realtime for Messages Table
-- This script enables Supabase Realtime on the messages table
-- so that the subscription in the app can receive real-time updates

-- Step 1: Enable realtime for the messages table
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Step 2: Verify that RLS policies allow SELECT (required for realtime)
-- The realtime subscription needs to be able to SELECT messages

-- Check current policies
DO $$
BEGIN
  RAISE NOTICE 'Current RLS policies on messages table:';
END $$;

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'messages';

-- Note: If you don't see SELECT policies that allow the authenticated user
-- to read their own messages (where sender_id or recipient_id matches their user_id),
-- the realtime subscription won't work even if realtime is enabled.

-- The existing RLS policies should already allow this, but if not, here's a reference:
-- CREATE POLICY "Users can view messages they sent or received"
--   ON messages FOR SELECT
--   USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
