/*
  # Update Sessions Schema and Fix RLS

  ## 1. Schema Updates
  - Add `coach_joined_at` (timestamptz, nullable)
  - Add `cancelled_at` (timestamptz, nullable)
  - Add `cancellation_reason` (text, nullable)

  ## 2. Security Updates
  - Drop existing policies
  - Create granular policies for INSERT, UPDATE, DELETE, SELECT
*/

-- Add new columns
ALTER TABLE sessions 
ADD COLUMN IF NOT EXISTS coach_joined_at timestamptz,
ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
ADD COLUMN IF NOT EXISTS cancellation_reason text;

-- Drop existing policies
DROP POLICY IF EXISTS "Coaches can manage their own sessions" ON sessions;
DROP POLICY IF EXISTS "Clients can view their own sessions" ON sessions;

-- Create granular policies

-- SELECT: Coaches can view sessions where they are the coach
CREATE POLICY "Coaches can view their sessions"
  ON sessions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM coaches
      WHERE coaches.id = sessions.coach_id
      AND coaches.user_id = auth.uid()
    )
  );

-- SELECT: Clients can view sessions where they are the client
CREATE POLICY "Clients can view their sessions"
  ON sessions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = sessions.client_id
      AND clients.user_id = auth.uid()
    )
  );

-- INSERT: Coaches can insert sessions for themselves
CREATE POLICY "Coaches can insert sessions"
  ON sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM coaches
      WHERE coaches.id = sessions.coach_id
      AND coaches.user_id = auth.uid()
    )
  );

-- UPDATE: Coaches can update their own sessions
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

-- DELETE: Coaches can delete their own sessions
CREATE POLICY "Coaches can delete their sessions"
  ON sessions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM coaches
      WHERE coaches.id = sessions.coach_id
      AND coaches.user_id = auth.uid()
    )
  );
