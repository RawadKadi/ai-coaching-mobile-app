-- ===================================================================
-- FIX: ALLOW COACHES TO VIEW CLIENTS AND PROFILES
-- ===================================================================
-- This script adds the missing policies that allow coaches to see
-- their clients' data and profiles.
-- ===================================================================

-- 1. Allow coaches to view the CLIENTS table for their linked clients
DROP POLICY IF EXISTS "Coaches can view their clients" ON clients;

CREATE POLICY "Coaches can view their clients"
  ON clients FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM coach_client_links ccl
      JOIN coaches c ON c.id = ccl.coach_id
      WHERE ccl.client_id = clients.id
      AND c.user_id = auth.uid()
    )
  );

-- 2. Allow coaches to view the PROFILES table for their linked clients
DROP POLICY IF EXISTS "Coaches can view client profiles" ON profiles;

CREATE POLICY "Coaches can view client profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clients cl
      JOIN coach_client_links ccl ON ccl.client_id = cl.id
      JOIN coaches c ON c.id = ccl.coach_id
      WHERE cl.user_id = profiles.id
      AND c.user_id = auth.uid()
    )
  );
