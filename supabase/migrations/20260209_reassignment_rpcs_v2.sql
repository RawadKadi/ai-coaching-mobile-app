-- Migration: Client Reassignment RPCs (Version 2 - JSONB return type)

-- 1. Get Unassigned Clients for a Main Coach
CREATE OR REPLACE FUNCTION get_unassigned_clients(
  p_main_coach_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_brand_id UUID;
  v_result JSONB;
BEGIN
  -- Get brand ID of the main coach
  SELECT brand_id INTO v_brand_id
  FROM coaches
  WHERE id = p_main_coach_id;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'client_id', c.id,
      'client_name', p.full_name,
      'client_email', au.email,
      'added_at', c.created_at
    )
  ), '[]'::jsonb) INTO v_result
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
  
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_unassigned_clients(UUID) TO authenticated;

-- 2. Get Active Sub-Coaches for a Main Coach
CREATE OR REPLACE FUNCTION get_active_sub_coaches(
  p_main_coach_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'coach_id', c.id,
      'full_name', p.full_name,
      'email', au.email,
      'client_count', COALESCE(active_count.count, 0)
    )
  ), '[]'::jsonb) INTO v_result
  FROM coach_hierarchy ch
  JOIN coaches c ON c.id = ch.child_coach_id
  JOIN profiles p ON p.id = c.user_id
  JOIN auth.users au ON au.id = c.user_id
  LEFT JOIN LATERAL (
    SELECT COUNT(*) as count
    FROM coach_client_links ccl
    WHERE ccl.coach_id = c.id AND ccl.status = 'active'
  ) active_count ON true
  WHERE ch.parent_coach_id = p_main_coach_id
  AND ch.status = 'active';
  
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_active_sub_coaches(UUID) TO authenticated;
