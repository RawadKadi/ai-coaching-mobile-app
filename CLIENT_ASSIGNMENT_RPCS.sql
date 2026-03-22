-- ============================================
-- SQL: Client Assignment System for Sub-Coaches
-- ============================================

-- 1. GET ALL CLIENTS FOR ASSIGNMENT (Main Coach View)
CREATE OR REPLACE FUNCTION get_clients_for_assignment(
  p_main_coach_id UUID
)
RETURNS TABLE (
  client_id UUID,
  client_name TEXT,
  client_email TEXT,
  current_coach_id UUID,
  current_coach_name TEXT,
  is_assigned BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id as client_id,
    p.full_name::TEXT as client_name,
    au.email::TEXT as client_email,
    ccl.coach_id as current_coach_id,
    COALESCE(cp.full_name, 'Unassigned')::TEXT as current_coach_name,
    (ccl.coach_id IS NOT NULL) as is_assigned
  FROM clients c
  JOIN profiles p ON p.id = c.user_id
  JOIN auth.users au ON au.id = c.user_id
  LEFT JOIN coach_client_links ccl ON ccl.client_id = c.id AND ccl.status = 'active'
  LEFT JOIN coaches co ON co.id = ccl.coach_id
  LEFT JOIN profiles cp ON cp.id = co.user_id
  WHERE c.brand_id = (SELECT brand_id FROM coaches WHERE id = p_main_coach_id)
  ORDER BY p.full_name ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_clients_for_assignment(UUID) TO authenticated;

-- 2. ASSIGN CLIENTS TO SUB-COACH (Handles Reassignment Automatically)
CREATE OR REPLACE FUNCTION assign_clients_to_subcoach(
  p_main_coach_id UUID,
  p_subcoach_id UUID,
  p_client_ids UUID[]
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_client_id UUID;
  v_reassigned_count INT := 0;
  v_new_assigned_count INT := 0;
  v_brand_id UUID;
BEGIN
  -- Verify main coach owns the brand
  SELECT brand_id INTO v_brand_id FROM coaches WHERE id = p_main_coach_id;
  
  IF v_brand_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Invalid main coach');
  END IF;

  -- Verify sub-coach belongs to same brand
  IF NOT EXISTS (
    SELECT 1 FROM coaches WHERE id = p_subcoach_id AND brand_id = v_brand_id
  ) THEN
    RETURN json_build_object('success', false, 'message', 'Sub-coach not in same brand');
  END IF;

  -- Process each client
  FOREACH v_client_id IN ARRAY p_client_ids
  LOOP
    -- Check if client already has an active assignment
    IF EXISTS (
      SELECT 1 FROM coach_client_links 
      WHERE client_id = v_client_id AND status = 'active'
    ) THEN
      -- Reassignment: deactivate old link
      UPDATE coach_client_links
      SET status = 'inactive', ended_at = NOW()
      WHERE client_id = v_client_id AND status = 'active';
      
      v_reassigned_count := v_reassigned_count + 1;
    ELSE
      v_new_assigned_count := v_new_assigned_count + 1;
    END IF;

    -- Create new assignment
    INSERT INTO coach_client_links (coach_id, client_id, status, started_at)
    VALUES (p_subcoach_id, v_client_id, 'active', NOW())
    ON CONFLICT (coach_id, client_id) DO UPDATE
    SET status = 'active', started_at = NOW();
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'reassigned_count', v_reassigned_count,
    'new_assigned_count', v_new_assigned_count,
    'total_count', array_length(p_client_ids, 1)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION assign_clients_to_subcoach(UUID, UUID, UUID[]) TO authenticated;

-- 3. GET REASSIGNMENT PREVIEW (Before Confirmation)
CREATE OR REPLACE FUNCTION get_reassignment_preview(
  p_client_ids UUID[]
)
RETURNS TABLE (
  client_id UUID,
  client_name TEXT,
  current_coach_id UUID,
  current_coach_name TEXT,
  will_be_reassigned BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id as client_id,
    p.full_name::TEXT as client_name,
    ccl.coach_id as current_coach_id,
    COALESCE(cp.full_name, 'Unassigned')::TEXT as current_coach_name,
    (ccl.coach_id IS NOT NULL) as will_be_reassigned
  FROM clients c
  JOIN profiles p ON p.id = c.user_id
  LEFT JOIN coach_client_links ccl ON ccl.client_id = c.id AND ccl.status = 'active'
  LEFT JOIN coaches co ON co.id = ccl.coach_id
  LEFT JOIN profiles cp ON cp.id = co.user_id
  WHERE c.id = ANY(p_client_ids);
END;
$$;

GRANT EXECUTE ON FUNCTION get_reassignment_preview(UUID[]) TO authenticated;
