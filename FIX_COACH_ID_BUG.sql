-- ============================================
-- SQL: FIXED get_sub_coaches RPC (Type-Safe)
-- ============================================

DROP FUNCTION IF EXISTS get_sub_coaches(UUID);

CREATE OR REPLACE FUNCTION get_sub_coaches(
  p_parent_coach_id UUID
)
RETURNS TABLE (
  coach_id UUID,
  full_name TEXT,
  email TEXT,
  client_count BIGINT,
  added_at TIMESTAMP WITH TIME ZONE,
  status TEXT,
  invite_token TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id as coach_id,
    COALESCE(p.full_name, split_part(ch.invite_email, '@', 1), 'Pending Coach')::TEXT as full_name,
    COALESCE(au.email::TEXT, ch.invite_email::TEXT)::TEXT as email,
    COALESCE((SELECT COUNT(*) FROM coach_client_links ccl WHERE ccl.coach_id = c.id AND ccl.status = 'active'), 0)::BIGINT as client_count,
    ch.created_at as added_at,
    CASE 
      WHEN ch.child_coach_id IS NOT NULL THEN 'active'::TEXT
      ELSE 'pending'::TEXT
    END as status,
    ch.invite_token::TEXT
  FROM coach_hierarchy ch
  LEFT JOIN coaches c ON c.id = ch.child_coach_id
  LEFT JOIN profiles p ON p.id = c.user_id
  LEFT JOIN auth.users au ON au.id = p.id
  WHERE ch.parent_coach_id = p_parent_coach_id
  ORDER BY ch.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_sub_coaches(UUID) TO authenticated;
