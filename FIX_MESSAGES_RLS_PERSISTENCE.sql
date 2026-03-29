-- Fix RLS policies for messages to allow senders to update their own messages (for deletion and reactions)
-- and ensure recipients can still mark as read.

-- 1. Allow senders to update their own messages
DROP POLICY IF EXISTS "Senders can update their own messages" ON messages;
CREATE POLICY "Senders can update their own messages"
  ON messages FOR UPDATE
  TO authenticated
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

-- 2. Ensure recipients can still update messages they received (as previously defined)
DROP POLICY IF EXISTS "Users can update messages they received" ON messages;
CREATE POLICY "Users can update messages they received"
  ON messages FOR UPDATE
  TO authenticated
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

-- 3. Verify SELECT policies are still correct
DROP POLICY IF EXISTS "Users can view messages they sent" ON messages;
CREATE POLICY "Users can view messages they sent"
  ON messages FOR SELECT
  TO authenticated
  USING (sender_id = auth.uid());

DROP POLICY IF EXISTS "Users can view messages they received" ON messages;
CREATE POLICY "Users can view messages they received"
  ON messages FOR SELECT
  TO authenticated
  USING (recipient_id = auth.uid());
