-- ============================================
-- FIX: use_invite_code RPC - Correct Parameter Order & Complete Logic
-- ============================================

-- Drop the old function (both possible signatures)
DROP FUNCTION IF EXISTS use_invite_code(TEXT, UUID);
DROP FUNCTION IF EXISTS use_invite_code(UUID, TEXT);

-- Create the CORRECT function
CREATE OR REPLACE FUNCTION use_invite_code(
  p_client_id UUID,
  p_code TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invite RECORD;
  v_result JSON;
BEGIN
  -- Find the invite
  SELECT * INTO v_invite
  FROM coach_invites
  WHERE code = p_code
    AND is_active = TRUE
    AND (expires_at IS NULL OR expires_at > NOW())
    AND (max_uses IS NULL OR current_uses < max_uses);
  
  -- Check if invite exists and is valid
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Invalid or expired invite code'
    );
  END IF;
  
  -- Update client with coach and brand info
  UPDATE clients
  SET
    invited_by = v_invite.coach_id,
    brand_id = v_invite.brand_id,
    invite_code = p_code,
    updated_at = NOW()
  WHERE id = p_client_id;
  
  -- Create coach-client link
  INSERT INTO coach_client_links (coach_id, client_id, status, created_at)
  VALUES (v_invite.coach_id, p_client_id, 'active', NOW())
  ON CONFLICT (coach_id, client_id) DO UPDATE
  SET status = 'active', updated_at = NOW();
  
  -- Increment invite usage
  UPDATE coach_invites
  SET current_uses = current_uses + 1
  WHERE id = v_invite.id;
  
  -- Log analytics event
  INSERT INTO analytics_events (event_type, client_id, coach_id, brand_id, event_data)
  VALUES (
    'invite_used', 
    p_client_id, 
    v_invite.coach_id,
    v_invite.brand_id,
    jsonb_build_object('invite_code', p_code)
  );
  
  -- Return success
  v_result := json_build_object(
    'success', true,
    'coach_id', v_invite.coach_id,
    'brand_id', v_invite.brand_id,
    'message', 'Successfully linked to coach'
  );
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION use_invite_code(UUID, TEXT) TO authenticated;

-- ============================================
-- VERIFY IT WORKS
-- ============================================

-- You can test with:
-- SELECT use_invite_code('your-client-uuid', 'invite-code-here');
