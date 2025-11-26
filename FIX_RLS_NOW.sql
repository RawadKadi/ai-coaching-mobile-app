-- ===================================================================
-- EMERGENCY FIX: INFINITE RECURSION IN RLS POLICIES (REVISED)
-- ===================================================================
-- This version only fixes tables that exist
-- ===================================================================

-- Step 1: Drop ALL existing policies on core tables
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

-- Step 2: Create NEW policies without circular dependencies

-- PROFILES - Simple, no recursion
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

-- COACHES - Uses user_id directly (no profile lookups)
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

-- CLIENTS - Uses user_id directly (no profile lookups)
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

-- COACH_CLIENT_LINKS - Simple lookups (no complex joins)
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
