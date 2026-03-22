-- ============================================
-- FIX: use_invite_code RPC FUNCTION
-- ============================================

-- First, check if the function exists
SELECT routine_name, routine_type, data_type
FROM information_schema.routines
WHERE routine_name = 'use_invite_code';

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS use_invite_code(UUID, TEXT);
DROP FUNCTION IF EXISTS use_invite_code(TEXT);

-- Create the correct function
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
    invite_code =p_code,
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

-- Test the function (replace with actual IDs)
-- SELECT use_invite_code('client-uuid-here', 'invite-code-here');
