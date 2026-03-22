-- ============================================
-- CLEAN RLS FIX - NO RECURSION
-- ============================================
-- This removes all recursive policies and adds simple ones

-- ============================================
-- 1. DROP ALL PROBLEMATIC POLICIES
-- ============================================

-- Clients
DROP POLICY IF EXISTS clients_select ON clients;
DROP POLICY IF EXISTS clients_insert ON clients;
DROP POLICY IF EXISTS clients_update ON clients;
DROP POLICY IF EXISTS clients_own_select ON clients;
DROP POLICY IF EXISTS clients_own_update ON clients;
DROP POLICY IF EXISTS clients_own_insert ON clients;
DROP POLICY IF EXISTS clients_coach_select ON clients;
DROP POLICY IF EXISTS clients_coach_lookup ON clients;

-- Coaches
DROP POLICY IF EXISTS coaches_select ON coaches;
DROP POLICY IF EXISTS coaches_update ON coaches;
DROP POLICY IF EXISTS coaches_own_select ON coaches;
DROP POLICY IF EXISTS coaches_own_update ON coaches;
DROP POLICY IF EXISTS coaches_own_insert ON coaches;
DROP POLICY IF EXISTS coaches_hierarchy_select ON coaches;

-- Coach Hierarchy
DROP POLICY IF EXISTS coach_hierarchy_policy ON coach_hierarchy;
DROP POLICY IF EXISTS coach_hierarchy_parent_select ON coach_hierarchy;
DROP POLICY IF EXISTS coach_hierarchy_child_select ON coach_hierarchy;
DROP POLICY IF EXISTS coach_hierarchy_child_update ON coach_hierarchy;
DROP POLICY IF EXISTS coach_hierarchy_parent_insert ON coach_hierarchy;

-- Profiles
DROP POLICY IF EXISTS profiles_select ON profiles;
DROP POLICY IF EXISTS profiles_update ON profiles;
DROP POLICY IF EXISTS profiles_own_select ON profiles;
DROP POLICY IF EXISTS profiles_own_update ON profiles;
DROP POLICY IF EXISTS profiles_own_insert ON profiles;

-- ============================================
-- 2. CREATE SIMPLE, SAFE POLICIES
-- ============================================

-- ========== CLIENTS ==========

-- Allow clients to see and update their own record
CREATE POLICY clients_own ON clients
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Allow authenticated users to insert (for signup)
CREATE POLICY clients_insert_own ON clients
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- ========== COACHES ==========

-- Allow coaches to see and update their own record
CREATE POLICY coaches_own ON coaches
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Allow authenticated users to insert (for signup)
CREATE POLICY coaches_insert_own ON coaches
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- ========== COACH_HIERARCHY ==========

-- Allow parent coaches to see, insert, and manage their child coaches
CREATE POLICY coach_hierarchy_parent ON coach_hierarchy
FOR ALL
USING (
  parent_coach_id = (
    SELECT id FROM coaches WHERE user_id = auth.uid() LIMIT 1
  )
)
WITH CHECK (
  parent_coach_id = (
    SELECT id FROM coaches WHERE user_id = auth.uid() LIMIT 1
  )
);

-- Allow child coaches to see and update their own records (CRITICAL FOR WELCOME SCREEN!)
CREATE POLICY coach_hierarchy_child ON coach_hierarchy
FOR ALL
USING (
  child_coach_id = (
    SELECT id FROM coaches WHERE user_id = auth.uid() LIMIT 1
  )
)
WITH CHECK (
  child_coach_id = (
    SELECT id FROM coaches WHERE user_id = auth.uid() LIMIT 1
  )
);

-- ========== PROFILES ==========

-- Allow everyone to see and update their own profile
CREATE POLICY profiles_own ON profiles
FOR ALL
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Allow insert during signup
CREATE POLICY profiles_insert_own ON profiles
FOR INSERT
WITH CHECK (id = auth.uid());

-- ============================================
-- 3. GRANT PERMISSIONS
-- ============================================

GRANT SELECT, INSERT, UPDATE, DELETE ON clients TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON coaches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON coach_hierarchy TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON profiles TO authenticated;

-- ============================================
-- DONE! NO RECURSION!
-- ============================================
