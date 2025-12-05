-- ROBUST FIX for Sessions Table
-- Run this to fix the 400 Bad Request error

BEGIN;

-- 1. Add missing meet_link column (safe if exists)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'meet_link') THEN
        ALTER TABLE public.sessions ADD COLUMN meet_link text;
    END IF;
END $$;

-- 2. Ensure other columns exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'session_type') THEN
        ALTER TABLE public.sessions ADD COLUMN session_type text DEFAULT 'training';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'notes') THEN
        ALTER TABLE public.sessions ADD COLUMN notes text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'is_locked') THEN
        ALTER TABLE public.sessions ADD COLUMN is_locked boolean DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'ai_generated') THEN
        ALTER TABLE public.sessions ADD COLUMN ai_generated boolean DEFAULT false;
    END IF;
END $$;

-- 3. Enable RLS
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- 4. Fix RLS Policies (Drop first to avoid conflicts)
DROP POLICY IF EXISTS "Coaches can insert sessions" ON sessions;
DROP POLICY IF EXISTS "Coaches can manage their sessions" ON sessions;
DROP POLICY IF EXISTS "Clients can view their own sessions" ON sessions;
DROP POLICY IF EXISTS "Coaches can insert sessions for their clients" ON sessions;

-- Allow coaches to insert sessions for their linked clients
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
CREATE POLICY "Clients can view their own sessions"
ON sessions
FOR SELECT
TO authenticated
USING (
  client_id = (SELECT id FROM clients WHERE user_id = auth.uid())
);

COMMIT;
