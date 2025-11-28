-- ===================================================================
-- FINAL FIX FOR INFINITE RECURSION (THE "NUCLEAR" OPTION)
-- ===================================================================
-- This script drops ALL recursive policies and replaces them with
-- SECURITY DEFINER functions that bypass RLS to prevent loops.
-- ===================================================================

-- 1. Helper Functions (SECURITY DEFINER)
-- These run with admin privileges to safely check relationships

CREATE OR REPLACE FUNCTION check_is_coach_for_client(target_client_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM coach_client_links ccl
    JOIN coaches c ON c.id = ccl.coach_id
    WHERE ccl.client_id = target_client_id
    AND c.user_id = auth.uid()
  );
END;
$$;

CREATE OR REPLACE FUNCTION check_is_client_for_coach(target_coach_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM coach_client_links ccl
    JOIN clients c ON c.id = ccl.client_id
    WHERE ccl.coach_id = target_coach_id
    AND c.user_id = auth.uid()
  );
END;
$$;

CREATE OR REPLACE FUNCTION check_can_view_profile(target_profile_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Users can view their own profile
  IF auth.uid() = target_profile_id THEN RETURN true; END IF;

  -- 2. Coaches can view their clients' profiles
  IF EXISTS (
    SELECT 1 
    FROM clients c
    JOIN coach_client_links ccl ON ccl.client_id = c.id
    JOIN coaches co ON co.id = ccl.coach_id
    WHERE c.user_id = target_profile_id
    AND co.user_id = auth.uid()
  ) THEN RETURN true; END IF;

  -- 3. Clients can view their coaches' profiles
  IF EXISTS (
    SELECT 1 
    FROM coaches co
    JOIN coach_client_links ccl ON ccl.coach_id = co.id
    JOIN clients c ON c.id = ccl.client_id
    WHERE co.user_id = target_profile_id
    AND c.user_id = auth.uid()
  ) THEN RETURN true; END IF;

  RETURN false;
END;
$$;

-- 2. Drop ALL Existing Policies on Core Tables
-- We do this to ensure no old, broken policies remain

DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Coaches can view client profiles" ON profiles;
DROP POLICY IF EXISTS "Clients can view coach profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;

DROP POLICY IF EXISTS "Coaches can view their own data" ON coaches;
DROP POLICY IF EXISTS "Coaches can update their own data" ON coaches;
DROP POLICY IF EXISTS "Coaches can insert their own data" ON coaches;
DROP POLICY IF EXISTS "Clients can view their coaches" ON coaches;

DROP POLICY IF EXISTS "Clients can view their own data" ON clients;
DROP POLICY IF EXISTS "Clients can update their own data" ON clients;
DROP POLICY IF EXISTS "Clients can insert their own data" ON clients;
DROP POLICY IF EXISTS "Coaches can view their clients" ON clients;

DROP POLICY IF EXISTS "Users can view their own links" ON coach_client_links;
DROP POLICY IF EXISTS "Coaches can manage their client links" ON coach_client_links;
DROP POLICY IF EXISTS "Coaches can view their client links" ON coach_client_links;
DROP POLICY IF EXISTS "Clients can view their coach links" ON coach_client_links;

-- 3. Apply NEW Robust Policies

-- PROFILES
CREATE POLICY "Users can view profiles (own + related)"
  ON profiles FOR SELECT
  TO authenticated
  USING (check_can_view_profile(id));

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- COACHES
CREATE POLICY "Coaches can view/edit their own data"
  ON coaches FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Clients can view their coaches"
  ON coaches FOR SELECT
  TO authenticated
  USING (check_is_client_for_coach(id));

-- CLIENTS
CREATE POLICY "Clients can view/edit their own data"
  ON clients FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Coaches can view their clients"
  ON clients FOR SELECT
  TO authenticated
  USING (check_is_coach_for_client(id));

-- COACH_CLIENT_LINKS
CREATE POLICY "Users can view their own links"
  ON coach_client_links FOR SELECT
  TO authenticated
  USING (
    -- Check if user is the coach OR the client in the link
    (EXISTS (SELECT 1 FROM coaches WHERE id = coach_id AND user_id = auth.uid()))
    OR
    (EXISTS (SELECT 1 FROM clients WHERE id = client_id AND user_id = auth.uid()))
  );

CREATE POLICY "Coaches can manage their client links"
  ON coach_client_links FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM coaches WHERE id = coach_id AND user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM coaches WHERE id = coach_id AND user_id = auth.uid()));
