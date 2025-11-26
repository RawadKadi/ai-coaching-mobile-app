/*
  Fix Infinite Recursion in RLS Policies
  
  This migration fixes the "infinite recursion detected in policy for relation 'profiles'" error
  by removing circular RLS policy dependencies.
  
  The problem: Policies on coaches/clients tables that query back to profiles through joins
  create infinite recursion when profiles RLS is evaluated.
  
  The solution: Use simpler policies that don't create circular dependencies.
*/

-- Drop all existing policies on profiles, coaches, clients, coach_client_links, and ai_coach_brains
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Coaches can view client profiles" ON profiles;
DROP POLICY IF EXISTS "Clients can view coach profiles" ON profiles;

DROP POLICY IF EXISTS "Coaches can view their own data" ON coaches;
DROP POLICY IF EXISTS "Coaches can update their own data" ON coaches;
DROP POLICY IF EXISTS "Coaches can insert their own data" ON coaches;
DROP POLICY IF EXISTS "Clients can view their coaches" ON coaches;
DROP POLICY IF EXISTS "Admins can view all coaches" ON coaches;

DROP POLICY IF EXISTS "Clients can view their own data" ON clients;
DROP POLICY IF EXISTS "Clients can update their own data" ON clients;
DROP POLICY IF EXISTS "Clients can insert their own data" ON clients;
DROP POLICY IF EXISTS "Coaches can view their clients" ON clients;
DROP POLICY IF EXISTS "Admins can view all clients" ON clients;

DROP POLICY IF EXISTS "Users can view their own links" ON coach_client_links;
DROP POLICY IF EXISTS "Coaches can view their client links" ON coach_client_links;
DROP POLICY IF EXISTS "Clients can view their coach links" ON coach_client_links;
DROP POLICY IF EXISTS "Coaches can manage their client links" ON coach_client_links;
DROP POLICY IF EXISTS "Admins can view all links" ON coach_client_links;

DROP POLICY IF EXISTS "Coaches can view their AI brain" ON ai_coach_brains;
DROP POLICY IF EXISTS "Coaches can update their AI brain" ON ai_coach_brains;
DROP POLICY IF EXISTS "Coaches can insert their AI brain" ON ai_coach_brains;

-- ===================================================================
-- PROFILES - Simple policies with NO recursion
-- ===================================================================
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- ===================================================================
-- COACHES - Simple policies using only user_id (NO profile lookups)
-- ===================================================================
CREATE POLICY "Coaches can view their own data"
  ON coaches FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Coaches can update their own data"
  ON coaches FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Coaches can insert their own data"
  ON coaches FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ===================================================================
-- CLIENTS - Simple policies using only user_id (NO profile lookups)
-- ===================================================================
CREATE POLICY "Clients can view their own data"
  ON clients FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Clients can update their own data"
  ON clients FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Clients can insert their own data"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ===================================================================
-- COACH_CLIENT_LINKS - Simple policies (NO complex joins)
-- ===================================================================
CREATE POLICY "Users can view their own links"
  ON coach_client_links FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM coaches
      WHERE coaches.id = coach_client_links.coach_id
      AND coaches.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = coach_client_links.client_id
      AND clients.user_id = auth.uid()
    )
  );

CREATE POLICY "Coaches can manage their client links"
  ON coach_client_links FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM coaches
      WHERE coaches.id = coach_client_links.coach_id
      AND coaches.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM coaches
      WHERE coaches.id = coach_client_links.coach_id
      AND coaches.user_id = auth.uid()
    )
  );

-- ===================================================================
-- AI_COACH_BRAINS - Simple policies
-- ===================================================================
CREATE POLICY "Coaches can view their AI brain"
  ON ai_coach_brains FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM coaches
      WHERE coaches.id = ai_coach_brains.coach_id
      AND coaches.user_id = auth.uid()
    )
  );

CREATE POLICY "Coaches can update their AI brain"
  ON ai_coach_brains FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM coaches
      WHERE coaches.id = ai_coach_brains.coach_id
      AND coaches.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM coaches
      WHERE coaches.id = ai_coach_brains.coach_id
      AND coaches.user_id = auth.uid()
    )
  );

CREATE POLICY "Coaches can insert their AI brain"
  ON ai_coach_brains FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM coaches
      WHERE coaches.id = ai_coach_brains.coach_id
      AND coaches.user_id = auth.uid()
    )
  );
