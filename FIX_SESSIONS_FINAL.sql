-- =========================================================
-- FIX: RE-APPLY PROPOSED STATUS AND MISSING COLUMNS
-- =========================================================

-- 1. Ensure Enum Values (using DO block to avoid errors if they exist)
DO $$ BEGIN
  ALTER TYPE session_status ADD VALUE 'proposed';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE session_status ADD VALUE 'pending_resolution';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE session_status ADD VALUE 'reschedule_requested';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;


-- 2. Ensure Columns Exist (using DO block for safety)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'invite_sent') THEN
        ALTER TABLE sessions ADD COLUMN invite_sent BOOLEAN DEFAULT FALSE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'cancellation_reason') THEN
        ALTER TABLE sessions ADD COLUMN cancellation_reason TEXT;
    END IF;
END $$;


-- 3. FIX RLS POLICIES FOR 'proposed' STATUS
-- Sometimes policies check for specific statuses. Let's make sure Coaches can update ANY session they own.

DROP POLICY IF EXISTS "Coaches can update their sessions" ON sessions;

CREATE POLICY "Coaches can update their sessions"
  ON sessions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM coaches
      WHERE coaches.id = sessions.coach_id
      AND coaches.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM coaches
      WHERE coaches.id = sessions.coach_id
      AND coaches.user_id = auth.uid()
    )
  );

-- 4. FORCE UPDATE EXISTING 'not yet sent' SESSIONS TO 'pending_resolution' IF they are proposed?
-- No, let's just make sure the system works forward.

-- 5. Debug Helper (Optional, to see what is happening)
-- Checks if there are any sessions that look like proposals but have wrong status
-- SELECT * FROM sessions WHERE invite_sent = true;
