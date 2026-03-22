-- ============================================
-- UPDATED: Accept Sub-Coach Invite (Handles Existing Coaches)
-- ============================================
-- This handles invites for both new signups and existing coaches

CREATE OR REPLACE FUNCTION accept_subcoach_invite(
  p_invite_token TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invite_record RECORD;
  v_current_coach_id UUID;
  v_parent_brand_id UUID;
BEGIN
  -- Get the current user's coach ID
  SELECT id INTO v_current_coach_id
  FROM coaches
  WHERE user_id = auth.uid();

  IF v_current_coach_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Not a coach account'
    );
  END IF;

  -- Find the invitation
  SELECT * INTO v_invite_record
  FROM coach_hierarchy
  WHERE invite_token = p_invite_token
    AND invite_accepted_at IS NULL
    AND LOWER(invite_email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid()));

  IF v_invite_record.id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Invalid or already accepted invitation'
    );
  END IF;

  -- Get parent coach's brand
  SELECT brand_id INTO v_parent_brand_id
  FROM coaches
  WHERE id = v_invite_record.parent_coach_id;

  IF v_parent_brand_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Parent coach has no brand'
    );
  END IF;

  -- Link the coach to the parent's team
  UPDATE coach_hierarchy
  SET 
    child_coach_id = v_current_coach_id,
    invite_accepted_at = NOW()
  WHERE id = v_invite_record.id;

  -- Update coach to be a sub-coach in this team
  -- NOTE: This does NOT remove their own brand, just adds them to the team
  UPDATE coaches
  SET 
    brand_id = v_parent_brand_id,
    is_parent_coach = false,  -- They become a sub-coach in this workspace
    can_manage_brand = false
  WHERE id = v_current_coach_id;

  RETURN json_build_object(
    'success', true,
    'parent_coach_name', (
      SELECT p.full_name 
      FROM coaches c 
      JOIN profiles p ON p.id = c.user_id 
      WHERE c.id = v_invite_record.parent_coach_id
    ),
    'message', 'Successfully joined team'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION accept_subcoach_invite(TEXT) TO authenticated;
