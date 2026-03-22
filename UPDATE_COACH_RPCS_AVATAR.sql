-- Update get_sub_coaches to include avatar_url
CREATE OR REPLACE FUNCTION get_sub_coaches(
  p_parent_coach_id UUID
)
RETURNS TABLE (
  coach_id UUID,
  full_name TEXT,
  email TEXT,
  client_count BIGINT,
  added_at TIMESTAMP WITH TIME ZONE,
  avatar_url TEXT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    c.id::UUID as coach_id,
    p.full_name::TEXT as full_name,
    au.email::TEXT as email,
    COUNT(DISTINCT ccl.client_id)::BIGINT as client_count,
    ch.created_at::TIMESTAMP WITH TIME ZONE as added_at,
    p.avatar_url::TEXT as avatar_url
  FROM coach_hierarchy ch
  INNER JOIN coaches c ON c.id = ch.child_coach_id
  INNER JOIN profiles p ON p.id = c.user_id
  INNER JOIN auth.users au ON au.id = p.id
  LEFT JOIN coach_client_links ccl ON ccl.coach_id = c.id AND ccl.status = 'active'
  WHERE ch.parent_coach_id = p_parent_coach_id
  GROUP BY c.id, p.full_name, au.email, ch.created_at, p.avatar_url
  ORDER BY ch.created_at DESC;
$$;

-- Update get_subcoach_details to include avatar_url
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
    'avatar_url', p.avatar_url,
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
