-- ============================================
-- FIX: Invite Code Max Uses - Prevent Race Condition
-- ============================================

DROP FUNCTION IF EXISTS use_invite_code(UUID, TEXT);

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
  v_updated_count INTEGER;
BEGIN
  -- Find and validate the invite WITH atomic increment
  -- This prevents race conditions by checking and updating in one query
  UPDATE coach_invites
  SET current_uses = current_uses + 1
  WHERE code = p_code
    AND is_active = TRUE
    AND (expires_at IS NULL OR expires_at > NOW())
    AND current_uses < max_uses  -- ← CRITICAL: Only increment if under limit
  RETURNING 
    id, coach_id, brand_id, max_uses, current_uses
  INTO v_invite;
  
  -- Check if update succeeded
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  IF v_updated_count = 0 THEN
    -- Find out why it failed
    SELECT * INTO v_invite
    FROM coach_invites
    WHERE code = p_code;
    
    IF NOT FOUND THEN
      RETURN json_build_object(
        'success', false,
        'error', 'invalid_code',
        'message', 'This invite code does not exist'
      );
    END IF;
    
    IF NOT v_invite.is_active THEN
      RETURN json_build_object(
        'success', false,
        'error', 'inactive',
        'message', 'This invite code has been deactivated'
      );
    END IF;
    
    IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at < NOW() THEN
      RETURN json_build_object(
        'success', false,
        'error', 'expired',
        'message', 'This invite code has expired'
      );
    END IF;
    
    IF v_invite.current_uses >= v_invite.max_uses THEN
      RETURN json_build_object(
        'success', false,
        'error', 'max_uses_reached',
        'message', 'This invite code has already been used the maximum number of times. Please ask your coach for a new code.'
      );
    END IF;
    
    -- Shouldn't reach here, but just in case
    RETURN json_build_object(
      'success', false,
      'error', 'unknown',
      'message', 'Could not use this invite code'
    );
  END IF;
  
  -- If we got here, the invite was successfully incremented
  -- Now link the client to the coach
  
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
  
  -- Log analytics event
  INSERT INTO analytics_events (event_type, client_id, coach_id, brand_id, event_data)
  VALUES (
    'invite_used', 
    p_client_id, 
    v_invite.coach_id,
    v_invite.brand_id,
    jsonb_build_object('invite_code', p_code, 'uses', v_invite.current_uses)
  );
  
  -- Return success
  v_result := json_build_object(
    'success', true,
    'coach_id', v_invite.coach_id,
    'brand_id', v_invite.brand_id,
    'uses_remaining', v_invite.max_uses - v_invite.current_uses,
    'message', 'Successfully linked to coach!'
  );
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', 'exception',
      'message', SQLERRM
    );
END;
$$;

GRANT EXECUTE ON FUNCTION use_invite_code(UUID, TEXT) TO authenticated;

-- ============================================
-- Also update validate_invite_code to be stricter
-- ============================================

DROP FUNCTION IF EXISTS validate_invite_code(TEXT);

CREATE OR REPLACE FUNCTION validate_invite_code(
  p_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invite RECORD;
  v_result JSONB;
BEGIN
  SELECT * INTO v_invite
  FROM coach_invites
  WHERE code = p_code
  AND is_active = TRUE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'valid', false, 
      'reason', 'invalid_code',
      'message', 'This invite code does not exist'
    );
  END IF;
  
  IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at < NOW() THEN
    RETURN jsonb_build_object(
      'valid', false, 
      'reason', 'expired',
      'message', 'This invite code has expired'
    );
  END IF;
  
  -- STRICTER CHECK: current_uses < max_uses (not >=)
  IF v_invite.current_uses >= v_invite.max_uses THEN
    RETURN jsonb_build_object(
      'valid', false, 
      'reason', 'max_uses_reached',
      'message', 'This invite code has reached its usage limit'
    );
  END IF;
  
  v_result := jsonb_build_object(
    'valid', true,
    'coach_id', v_invite.coach_id,
    'brand_id', v_invite.brand_id,
    'invite_id', v_invite.id,
    'uses_remaining', v_invite.max_uses - v_invite.current_uses
  );
  
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION validate_invite_code(TEXT) TO anon, authenticated;
