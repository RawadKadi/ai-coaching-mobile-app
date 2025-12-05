-- Add meet_link column if it doesn't exist
ALTER TABLE public.sessions 
ADD COLUMN IF NOT EXISTS meet_link text;

-- Fix RLS policies for sessions table to allow coaches to insert

-- 1. Allow coaches to insert sessions for their clients
DROP POLICY IF EXISTS "Coaches can insert sessions" ON sessions;
CREATE POLICY "Coaches can insert sessions"
ON sessions
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM coach_client_links ccl
    JOIN coaches c ON c.id = ccl.coach_id
    WHERE ccl.client_id = sessions.client_id
    AND c.user_id = auth.uid()
    AND ccl.status = 'active'
  )
);

-- 2. Allow coaches to update sessions they created
DROP POLICY IF EXISTS "Coaches can update their sessions" ON sessions;
CREATE POLICY "Coaches can update their sessions"
ON sessions
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM coaches c
    WHERE c.id = sessions.coach_id
    AND c.user_id = auth.uid()
  )
);

-- 3. Allow coaches to select sessions
DROP POLICY IF EXISTS "Coaches can view their sessions" ON sessions;
CREATE POLICY "Coaches can view their sessions"
ON sessions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM coaches c
    WHERE c.id = sessions.coach_id
    AND c.user_id = auth.uid()
  )
);
