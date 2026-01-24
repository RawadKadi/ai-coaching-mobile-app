-- ============================================
-- QUICK FIX: Remove Recursive Policy
-- ============================================

-- Simply drop the problematic recursive policy
-- Coaches can already see themselves via coaches_own_select
DROP POLICY IF EXISTS coaches_hierarchy_select ON coaches;

-- That's it! The coaches_own_select policy is sufficient:
-- CREATE POLICY coaches_own_select ON coaches
-- FOR SELECT USING (user_id = auth.uid());

-- This allows coaches to see their own record without recursion
-- For seeing other coaches in hierarchy, we can query coach_hierarchy directly

-- Test that signup works now:
-- Try creating a new coach account
