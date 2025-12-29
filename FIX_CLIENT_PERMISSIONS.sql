-- =========================================================
-- FIX: ALLOW CLIENTS TO UPDATE SESSIONS FOR PROPOSALS
-- =========================================================

-- 1. Ensure Clients can update their own sessions (to accept reschedules)
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

-- 2. Verify and fix the tag states for the coach view
-- Ensure 'proposed' is a valid status again, just in case.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'session_status' AND e.enumlabel = 'proposed') THEN
    ALTER TYPE session_status ADD VALUE 'proposed';
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    CREATE TYPE session_status AS ENUM ('scheduled', 'completed', 'cancelled', 'proposed', 'pending_resolution', 'reschedule_requested');
END $$;
