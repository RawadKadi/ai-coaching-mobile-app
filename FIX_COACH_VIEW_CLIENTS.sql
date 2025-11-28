-- Allow coaches to view their clients' data and profiles
-- These policies were missing/dropped in previous fixes

-- 1. Policy for CLIENTS table
CREATE POLICY "Coaches can view their clients"
  ON clients FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM coach_client_links ccl
      JOIN coaches co ON co.id = ccl.coach_id
      WHERE ccl.client_id = clients.id
      AND co.user_id = auth.uid()
      -- We can optionally check for status='active' if we only want active clients
      -- AND ccl.status = 'active'
    )
  );

-- 2. Policy for PROFILES table
-- Coaches need to see the names/avatars of their clients
CREATE POLICY "Coaches can view client profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clients c
      JOIN coach_client_links ccl ON ccl.client_id = c.id
      JOIN coaches co ON co.id = ccl.coach_id
      WHERE c.user_id = profiles.id
      AND co.user_id = auth.uid()
    )
  );
