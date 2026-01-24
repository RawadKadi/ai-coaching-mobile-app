-- ============================================
-- COMPREHENSIVE RLS FIX - ALL TABLES
-- ============================================
-- This fixes RLS policies that are blocking coaches and clients

-- ============================================
-- 1. CLIENTS TABLE RLS
-- ============================================

-- Drop existing restrictive policies
DROP POLICY IF EXISTS clients_select ON clients;
DROP POLICY IF EXISTS clients_insert ON clients;
DROP POLICY IF EXISTS clients_update ON clients;

-- Allow clients to see their own record
CREATE POLICY clients_own_select ON clients
FOR SELECT
USING (user_id = auth.uid());

-- Allow clients to update their own record
CREATE POLICY clients_own_update ON clients
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Allow clients to insert their own record (during signup)
CREATE POLICY clients_own_insert ON clients
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Allow coaches to see clients they're linked to
CREATE POLICY clients_coach_select ON clients
FOR SELECT
USING (
  id IN (
    SELECT client_id FROM coach_client_links
    WHERE coach_id IN (
      SELECT id FROM coaches WHERE user_id = auth.uid()
    )
    AND status = 'active'
  )
);

-- Allow coaches to see clients by user_id (for lookups)
CREATE POLICY clients_coach_lookup ON clients
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM coach_client_links ccl
    JOIN coaches c ON c.id = ccl.coach_id
    WHERE ccl.client_id = clients.id
    AND c.user_id = auth.uid()
    AND ccl.status = 'active'
  )
);

-- ============================================
-- 2. COACHES TABLE RLS
-- ============================================

DROP POLICY IF EXISTS coaches_select ON coaches;
DROP POLICY IF EXISTS coaches_update ON coaches;

-- Allow coaches to see their own record
CREATE POLICY coaches_own_select ON coaches
FOR SELECT
USING (user_id = auth.uid());

-- Allow coaches to update their own record
CREATE POLICY coaches_own_update ON coaches
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Allow coaches to insert their own record (during signup)
CREATE POLICY coaches_own_insert ON coaches
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Allow coaches to see other coaches in their hierarchy
CREATE POLICY coaches_hierarchy_select ON coaches
FOR SELECT
USING (
  id IN (
    -- Sub-coaches under this parent
    SELECT child_coach_id FROM coach_hierarchy
    WHERE parent_coach_id IN (
      SELECT id FROM coaches WHERE user_id = auth.uid()
    )
  )
  OR id IN (
    -- Parent coaches above this sub-coach
    SELECT parent_coach_id FROM coach_hierarchy
    WHERE child_coach_id IN (
      SELECT id FROM coaches WHERE user_id = auth.uid()
    )
  )
);

-- ============================================
-- 3. COACH_HIERARCHY TABLE RLS (RE-APPLY)
-- ============================================

DROP POLICY IF EXISTS coach_hierarchy_policy ON coach_hierarchy;
DROP POLICY IF EXISTS coach_hierarchy_parent_select ON coach_hierarchy;
DROP POLICY IF EXISTS coach_hierarchy_child_select ON coach_hierarchy;
DROP POLICY IF EXISTS coach_hierarchy_child_update ON coach_hierarchy;
DROP POLICY IF EXISTS coach_hierarchy_parent_insert ON coach_hierarchy;

-- Parent coaches can see their sub-coaches
CREATE POLICY coach_hierarchy_parent_select ON coach_hierarchy
FOR SELECT
USING (
  parent_coach_id IN (
    SELECT id FROM coaches WHERE user_id = auth.uid()
  )
);

-- Sub-coaches can see records where they are the child
CREATE POLICY coach_hierarchy_child_select ON coach_hierarchy
FOR SELECT
USING (
  child_coach_id IN (
    SELECT id FROM coaches WHERE user_id = auth.uid()
  )
);

-- Sub-coaches can UPDATE their acknowledgment
CREATE POLICY coach_hierarchy_child_update ON coach_hierarchy
FOR UPDATE
USING (
  child_coach_id IN (
    SELECT id FROM coaches WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  child_coach_id IN (
    SELECT id FROM coaches WHERE user_id = auth.uid()
  )
);

-- Parent coaches can INSERT
CREATE POLICY coach_hierarchy_parent_insert ON coach_hierarchy
FOR INSERT
WITH CHECK (
  parent_coach_id IN (
    SELECT id FROM coaches WHERE user_id = auth.uid()
  )
);

-- ============================================
-- 4. PROFILES TABLE RLS
-- ============================================

DROP POLICY IF EXISTS profiles_select ON profiles;
DROP POLICY IF EXISTS profiles_update ON profiles;

-- Everyone can see their own profile
CREATE POLICY profiles_own_select ON profiles
FOR SELECT
USING (id = auth.uid());

-- Everyone can update their own profile
CREATE POLICY profiles_own_update ON profiles
FOR UPDATE
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Allow insert during signup
CREATE POLICY profiles_own_insert ON profiles
FOR INSERT
WITH CHECK (id = auth.uid());

-- ============================================
-- 5. GRANT PERMISSIONS
-- ============================================

GRANT SELECT, INSERT, UPDATE ON clients TO authenticated;
GRANT SELECT, INSERT, UPDATE ON coaches TO authenticated;
GRANT SELECT, INSERT, UPDATE ON coach_hierarchy TO authenticated;
GRANT SELECT, INSERT, UPDATE ON profiles TO authenticated;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Test as coach - should return coach record:
-- SELECT * FROM coaches WHERE user_id = auth.uid();

-- Test as client - should return client record:
-- SELECT * FROM clients WHERE user_id = auth.uid();

-- Test as sub-coach - should return hierarchy:
-- SELECT * FROM coach_hierarchy WHERE child_coach_id IN (SELECT id FROM coaches WHERE user_id = auth.uid());
