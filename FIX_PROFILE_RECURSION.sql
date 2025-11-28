-- ===================================================================
-- FIX PROFILE RLS RECURSION
-- ===================================================================

-- 1. Create a helper function to check if a coach can view a profile
-- This function is SECURITY DEFINER to bypass RLS on clients/coaches/links tables
CREATE OR REPLACE FUNCTION can_coach_view_profile(target_profile_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM clients c
    JOIN coach_client_links ccl ON ccl.client_id = c.id
    JOIN coaches co ON co.id = ccl.coach_id
    WHERE c.user_id = target_profile_id
    AND co.user_id = auth.uid()
    -- AND ccl.status = 'active' -- Optional: strict active check
  );
END;
$$;

-- 2. Update RLS policies on profiles
-- Drop the problematic policy
DROP POLICY IF EXISTS "Coaches can view client profiles" ON profiles;

-- Create new non-recursive policy
CREATE POLICY "Coaches can view client profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (can_coach_view_profile(id));
