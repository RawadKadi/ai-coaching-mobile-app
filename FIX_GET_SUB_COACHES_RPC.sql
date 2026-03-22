-- ============================================
-- FIX get_sub_coaches RPC FUNCTION
-- ============================================

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS get_sub_coaches(UUID);

-- Recreate with proper error handling
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
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Log the input parameter for debugging
  RAISE NOTICE 'get_sub_coaches called with parent_coach_id: %', p_parent_coach_id;
  
  -- Validate input
  IF p_parent_coach_id IS NULL THEN
    RAISE EXCEPTION 'parent_coach_id cannot be NULL';
  END IF;
  
  -- Return query with error handling
  RETURN QUERY
  SELECT
    c.id as coach_id,
    COALESCE(p.full_name, 'Unknown') as full_name,
    COALESCE(au.email, 'no-email@example.com') as email,
    COUNT(DISTINCT ccl.client_id) as client_count,
    ch.created_at as added_at
  FROM coach_hierarchy ch
  INNER JOIN coaches c ON c.id = ch.child_coach_id
  INNER JOIN profiles p ON p.id = c.user_id
  LEFT JOIN auth.users au ON au.id = p.id
  LEFT JOIN coach_client_links ccl ON ccl.coach_id = c.id AND ccl.status = 'active'
  WHERE ch.parent_coach_id = p_parent_coach_id
  GROUP BY c.id, p.full_name, au.email, ch.created_at
  ORDER BY ch.created_at DESC;
  
  RAISE NOTICE 'get_sub_coaches completed successfully';
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error in get_sub_coaches: %', SQLERRM;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_sub_coaches(UUID) TO authenticated;

-- Test the function (replace with your coach ID)
-- SELECT * FROM get_sub_coaches('YOUR_COACH_ID_HERE');

-- Verify function exists
SELECT 
  routine_name,
  routine_type,
  'Function recreated successfully' as status
FROM information_schema.routines
WHERE routine_name = 'get_sub_coaches';
