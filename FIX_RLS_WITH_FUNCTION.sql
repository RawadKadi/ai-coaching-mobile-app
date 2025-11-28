-- ===================================================================
-- FIX: ROBUST RLS FOR HABITS USING SECURITY DEFINER
-- ===================================================================

-- 1. Create a secure function to check permissions
-- This function runs with elevated privileges (SECURITY DEFINER) to ensure
-- it can read the necessary tables (coaches, coach_client_links) regardless of their RLS.
CREATE OR REPLACE FUNCTION check_coach_client_permission(target_client_id uuid)
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
    -- We allow active or pending links to be safe, or restrict to active if needed
    -- AND ccl.status = 'active' 
  );
END;
$$;

-- 2. Drop the previous policy if it exists
DROP POLICY IF EXISTS "Coaches can manage habits for their clients" ON habits;

-- 3. Create the new policy using the function
CREATE POLICY "Coaches can manage habits for their clients"
  ON habits FOR ALL
  TO authenticated
  USING (check_coach_client_permission(client_id))
  WITH CHECK (check_coach_client_permission(client_id));

-- 4. Grant execute permission on the function
GRANT EXECUTE ON FUNCTION check_coach_client_permission TO authenticated;
