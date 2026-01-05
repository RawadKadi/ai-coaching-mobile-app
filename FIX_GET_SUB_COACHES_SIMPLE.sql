-- ============================================
-- SIMPLE WORKING VERSION - get_sub_coaches
-- ============================================

-- Drop the broken one
DROP FUNCTION IF EXISTS get_sub_coaches(UUID);

-- Create simple working version
CREATE OR REPLACE FUNCTION get_sub_coaches(
  p_parent_coach_id UUID
)
RETURNS TABLE (
  coach_id UUID,
  full_name TEXT,
  email TEXT,
  client_count BIGINT,
  added_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    c.id::UUID as coach_id,
    p.full_name::TEXT as full_name,
    au.email::TEXT as email,
    COUNT(DISTINCT ccl.client_id)::BIGINT as client_count,
    ch.created_at::TIMESTAMP WITH TIME ZONE as added_at
  FROM coach_hierarchy ch
  INNER JOIN coaches c ON c.id = ch.child_coach_id
  INNER JOIN profiles p ON p.id = c.user_id
  INNER JOIN auth.users au ON au.id = p.id
  LEFT JOIN coach_client_links ccl ON ccl.coach_id = c.id AND ccl.status = 'active'
  WHERE ch.parent_coach_id = p_parent_coach_id
  GROUP BY c.id, p.full_name, au.email, ch.created_at
  ORDER BY ch.created_at DESC;
$$;

-- Grant permission
GRANT EXECUTE ON FUNCTION get_sub_coaches(UUID) TO authenticated;

-- Test it (replace with your ID)
SELECT * FROM get_sub_coaches('d770a4db-bf7a-4759-be4e-1166bd044383');

-- Should return: 0 rows (empty table) with columns: coach_id, full_name, email, client_count, added_at
