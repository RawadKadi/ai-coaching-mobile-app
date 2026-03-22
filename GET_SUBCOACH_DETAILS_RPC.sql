-- ============================================
-- SQL: RPC to Get Sub-Coach Details (Bypasses RLS)
-- ============================================

CREATE OR REPLACE FUNCTION get_subcoach_details(
  p_coach_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'coach_id', c.id,
    'user_id', c.user_id,
    'full_name', p.full_name,
    'email', au.email,
    'joined_at', ch.invite_accepted_at,
    'created_at', c.created_at
  ) INTO v_result
  FROM coaches c
  JOIN profiles p ON p.id = c.user_id
  JOIN auth.users au ON au.id = c.user_id
  LEFT JOIN coach_hierarchy ch ON ch.child_coach_id = c.id
  WHERE c.id = p_coach_id;
  
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_subcoach_details(UUID) TO authenticated;
