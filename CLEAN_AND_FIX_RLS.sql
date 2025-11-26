-- ===================================================================
-- NUCLEAR FIX: CLEAN AND RESET ALL RLS POLICIES
-- ===================================================================
-- This script dynamically finds and drops ALL policies on your tables
-- to ensure NO hidden recursive policies remain.
-- ===================================================================

DO $$
DECLARE
    pol record;
BEGIN
    -- 1. Loop through all policies for our specific tables and drop them
    FOR pol IN
        SELECT policyname, tablename
        FROM pg_policies
        WHERE tablename IN ('profiles', 'coaches', 'clients', 'coach_client_links')
    LOOP
        RAISE NOTICE 'Dropping policy: % on table: %', pol.policyname, pol.tablename;
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- ===================================================================
-- RE-APPLY SAFE POLICIES (Non-Recursive)
-- ===================================================================

-- 1. PROFILES
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

-- 2. COACHES
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

-- 3. CLIENTS
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

-- 4. COACH_CLIENT_LINKS
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
