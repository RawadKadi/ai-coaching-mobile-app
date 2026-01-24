-- ============================================
-- FIX: Coach Hierarchy RLS Policies
-- ============================================
-- Allow coaches to read records where they are the child_coach

-- Drop existing restrictive policy
DROP POLICY IF EXISTS coach_hierarchy_policy ON coach_hierarchy;

-- Create new policies for better access control

-- 1. Parent coaches can see their sub-coaches
CREATE POLICY coach_hierarchy_parent_select ON coach_hierarchy
FOR SELECT
USING (
  parent_coach_id IN (
    SELECT id FROM coaches WHERE user_id = auth.uid()
  )
);

-- 2. Sub-coaches can see records where they are the child (CRITICAL FOR WELCOME SCREEN!)
CREATE POLICY coach_hierarchy_child_select ON coach_hierarchy
FOR SELECT
USING (
  child_coach_id IN (
    SELECT id FROM coaches WHERE user_id = auth.uid()
  )
);

-- 3. Sub-coaches can UPDATE their own acknowledgment
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

-- 4. Parent coaches can INSERT (add sub-coaches)
CREATE POLICY coach_hierarchy_parent_insert ON coach_hierarchy
FOR INSERT
WITH CHECK (
  parent_coach_id IN (
    SELECT id FROM coaches WHERE user_id = auth.uid()
  )
);

-- Grant necessary permissions
GRANT SELECT, UPDATE ON coach_hierarchy TO authenticated;

-- Test the policy (replace with actual sub-coach user_id)
-- Should return their hierarchy record:
-- SELECT * FROM coach_hierarchy WHERE child_coach_id IN (SELECT id FROM coaches WHERE user_id = auth.uid());
