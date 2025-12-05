-- FINAL FIX for Sessions Table
-- Run this to fix the 400 Bad Request error

-- 1. Add missing meet_link column
ALTER TABLE public.sessions 
ADD COLUMN IF NOT EXISTS meet_link text;

-- 2. Enable RLS
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- 3. Fix RLS Policies
-- Allow coaches to insert sessions for their linked clients
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

-- Allow coaches to view/update/delete their sessions
DROP POLICY IF EXISTS "Coaches can manage their sessions" ON sessions;
CREATE POLICY "Coaches can manage their sessions"
ON sessions
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM coaches c
    WHERE c.id = sessions.coach_id
    AND c.user_id = auth.uid()
  )
);

-- Allow clients to view their own sessions
DROP POLICY IF EXISTS "Clients can view their own sessions" ON sessions;
CREATE POLICY "Clients can view their own sessions"
ON sessions
FOR SELECT
TO authenticated
USING (
  client_id = (SELECT id FROM clients WHERE user_id = auth.uid())
);
