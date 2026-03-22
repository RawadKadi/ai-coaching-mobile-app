-- ============================================
-- SQL: Sub-Coach Invitation RPCs
-- ============================================

-- 1. VALIDATE SUB-COACH INVITE
CREATE OR REPLACE FUNCTION validate_subcoach_invite(
  p_invite_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_invite RECORD;
  v_result JSONB;
BEGIN
  SELECT ch.*, p.full_name as parent_name
  FROM coach_hierarchy ch
  JOIN coaches c ON c.id = ch.parent_coach_id
  JOIN profiles p ON p.id = c.user_id
  WHERE ch.invite_token = p_invite_token
  AND ch.invite_accepted_at IS NULL
  INTO v_invite;
  
  IF v_invite IS NULL THEN
    RETURN jsonb_build_object(
      'valid', false, 
      'message', 'This invite code does not exist or has already been used.'
    );
  END IF;
  
  IF v_invite.invite_expires_at IS NOT NULL AND v_invite.invite_expires_at < NOW() THEN
    RETURN jsonb_build_object(
      'valid', false, 
      'message', 'This invite link has expired.'
    );
  END IF;
  
  v_result := jsonb_build_object(
    'valid', true,
    'parent_coach_id', v_invite.parent_coach_id,
    'parent_coach_name', v_invite.parent_name,
    'invite_email', v_invite.invite_email
  );
  
  RETURN v_result;
END;
$$;

-- 2. ACCEPT SUB-COACH INVITE
CREATE OR REPLACE FUNCTION accept_subcoach_invite(
  p_invite_token TEXT,
  p_child_coach_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_invite RECORD;
  v_parent_brand_id UUID;
BEGIN
  -- Find the invite
  SELECT * FROM coach_hierarchy
  WHERE invite_token = p_invite_token
  AND invite_accepted_at IS NULL
  INTO v_invite;
  
  IF v_invite IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invite not found or already accepted.');
  END IF;
  
  -- Get parent's brand_id
  SELECT brand_id INTO v_parent_brand_id
  FROM coaches
  WHERE id = v_invite.parent_coach_id;
  
  -- Link the coach
  UPDATE coach_hierarchy
  SET 
    child_coach_id = p_child_coach_id,
    invite_accepted_at = NOW()
  WHERE id = v_invite.id;
  
  -- Update the child coach with the parent's brand
  UPDATE coaches
  SET 
    brand_id = v_parent_brand_id,
    is_parent_coach = false, -- Default to sub-coach
    can_manage_brand = false
  WHERE id = p_child_coach_id;
  
  RETURN jsonb_build_object(
    'success', true, 
    'hierarchy_id', v_invite.id,
    'parent_coach_name', v_invite.parent_coach_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION validate_subcoach_invite(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION accept_subcoach_invite(TEXT, UUID) TO authenticated;
