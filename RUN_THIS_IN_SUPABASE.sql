-- ================================================================
-- CRITICAL FIX: Run this FIRST in Supabase SQL Editor
-- ================================================================

-- Step 1: Ensure the enum has all required values
DO $$ 
BEGIN
    -- Add 'proposed' if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'session_status' AND e.enumlabel = 'proposed'
    ) THEN
        ALTER TYPE session_status ADD VALUE 'proposed';
    END IF;

    -- Add 'pending_resolution' if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'session_status' AND e.enumlabel = 'pending_resolution'
    ) THEN
        ALTER TYPE session_status ADD VALUE 'pending_resolution';
    END IF;
END $$;

-- Step 2: Add missing columns
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS invite_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- Step 3: Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_sessions_invite_sent ON sessions(invite_sent);
CREATE INDEX IF NOT EXISTS idx_sessions_cancellation_reason ON sessions(cancellation_reason);

-- Step 4: Grant permissions for clients to update their sessions
DROP POLICY IF EXISTS "Clients can update their own sessions" ON sessions;

CREATE POLICY "Clients can update their own sessions"
ON sessions FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM clients
        WHERE clients.id = sessions.client_id
        AND clients.user_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM clients
        WHERE clients.id = sessions.client_id
        AND clients.user_id = auth.uid()
    )
);

-- Step 5: Verify setup
SELECT 
    'Setup complete!' as message,
    COUNT(*) FILTER (WHERE invite_sent IS NOT NULL) as has_invite_sent_column,
    COUNT(*) FILTER (WHERE cancellation_reason IS NOT NULL) as has_cancellation_reason_column
FROM sessions
LIMIT 1;
