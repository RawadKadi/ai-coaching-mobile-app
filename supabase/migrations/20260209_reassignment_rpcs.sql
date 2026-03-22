-- Migration: Client Reassignment RPCs

-- 1. Get Unassigned Clients for a Main Coach
-- Returns clients belonging to the coach's brand who do not have an ACTIVE coach assigned.
CREATE OR REPLACE FUNCTION get_unassigned_clients(
  p_main_coach_id UUID
)
RETURNS TABLE (
  client_id UUID,
  client_name TEXT,
  client_email TEXT,
  added_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_brand_id UUID;
BEGIN
  -- Get brand ID of the main coach
  SELECT brand_id INTO v_brand_id
  FROM coaches
  WHERE id = p_main_coach_id;

  RETURN QUERY
  SELECT 
    c.id AS client_id, 
    p.full_name AS client_name, 
    au.email AS client_email, 
    c.created_at AS added_at
  FROM clients c
  JOIN profiles p ON p.id = c.user_id
  JOIN auth.users au ON au.id = c.user_id
  WHERE c.brand_id = v_brand_id
  AND NOT EXISTS (
    SELECT 1 
    FROM coach_client_links ccl 
    WHERE ccl.client_id = c.id 
    AND ccl.status = 'active'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_unassigned_clients(UUID) TO authenticated;

-- 2. Get Active Sub-Coaches for a Main Coach (for reassignment dropdown)
CREATE OR REPLACE FUNCTION get_active_sub_coaches(
  p_main_coach_id UUID
)
RETURNS TABLE (
  coach_id UUID,
  full_name TEXT,
  email TEXT,
  client_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id AS coach_id, 
    p.full_name, 
    au.email,
    COUNT(ccl.client_id) FILTER (WHERE ccl.status = 'active') as client_count
  FROM coach_hierarchy ch
  JOIN coaches c ON c.id = ch.child_coach_id
  JOIN profiles p ON p.id = c.user_id
  JOIN auth.users au ON au.id = c.user_id
  LEFT JOIN coach_client_links ccl ON ccl.coach_id = c.id
  WHERE ch.parent_coach_id = p_main_coach_id
  AND ch.status = 'active' -- Only active sub-coaches
  GROUP BY c.id, p.full_name, au.email;
END;
$$;

GRANT EXECUTE ON FUNCTION get_active_sub_coaches(UUID) TO authenticated;
