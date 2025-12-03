/*
  # Create Sessions Table

  ## 1. New Tables
  - `sessions`
    - `id` (uuid, PK)
    - `coach_id` (uuid, FK to coaches)
    - `client_id` (uuid, FK to clients)
    - `scheduled_at` (timestamptz)
    - `duration_minutes` (integer)
    - `meet_link` (text)
    - `status` (text: scheduled, completed, cancelled)
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ## 2. Security
  - Enable RLS
  - Coaches can manage their own sessions
  - Clients can view their own sessions
*/

-- Create enum for session status
DO $$ BEGIN
  CREATE TYPE session_status AS ENUM ('scheduled', 'completed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  scheduled_at timestamptz NOT NULL,
  duration_minutes integer DEFAULT 60,
  meet_link text,
  status session_status DEFAULT 'scheduled',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sessions_coach_id ON sessions(coach_id);
CREATE INDEX IF NOT EXISTS idx_sessions_client_id ON sessions(client_id);
CREATE INDEX IF NOT EXISTS idx_sessions_scheduled_at ON sessions(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);

-- Enable RLS
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Coaches can manage their own sessions
CREATE POLICY "Coaches can manage their own sessions"
  ON sessions
  FOR ALL
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

-- Clients can view their own sessions
CREATE POLICY "Clients can view their own sessions"
  ON sessions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = sessions.client_id
      AND clients.user_id = auth.uid()
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
