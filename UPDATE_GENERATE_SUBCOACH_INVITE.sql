-- ============================================
-- SQL: Intelligent Sub-Coach Invite Generation
-- ============================================

-- Ensure necessary columns exist for the invite system
ALTER TABLE coach_hierarchy 
ADD COLUMN IF NOT EXISTS invite_token TEXT,
ADD COLUMN IF NOT EXISTS invite_email TEXT,
ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS invite_sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS invite_accepted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS parent_coach_name TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_coach_hierarchy_invite_email ON coach_hierarchy(invite_email);
CREATE INDEX IF NOT EXISTS idx_coach_hierarchy_invite_token ON coach_hierarchy(invite_token);

CREATE OR REPLACE FUNCTION generate_subcoach_invite(
  p_parent_coach_id UUID,
  p_invite_email TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing_invite RECORD;
  v_parent_name TEXT;
  v_invite_token TEXT;
  v_expires_at TIMESTAMP WITH TIME ZONE;
  v_result JSON;
BEGIN
  -- 1. Get parent coach name for the email
  SELECT full_name INTO v_parent_name
  FROM profiles
  WHERE id = (SELECT user_id FROM coaches WHERE id = p_parent_coach_id);

  -- 2. Check for active, unaccepted, and not expired invite
  SELECT * INTO v_existing_invite
  FROM coach_hierarchy
  WHERE invite_email = p_invite_email
    AND invite_accepted_at IS NULL
    AND invite_expires_at > NOW()
    AND parent_coach_id = p_parent_coach_id;

  IF FOUND THEN
    -- Update sent_at for analytics/logging
    UPDATE coach_hierarchy 
    SET invite_sent_at = NOW()
    WHERE id = v_existing_invite.id;

    -- Return existing invite info with flag
    RETURN json_build_object(
      'success', true,
      'active_exists', true,
      'invite_token', v_existing_invite.invite_token,
      'invite_email', v_existing_invite.invite_email,
      'expires_at', v_existing_invite.invite_expires_at,
      'parent_coach_name', v_parent_name
    );
  END IF;

  -- 3. Check if they are already a teammate (accepted)
  IF EXISTS (
    SELECT 1 FROM coach_hierarchy 
    WHERE invite_email = p_invite_email 
    AND invite_accepted_at IS NOT NULL
  ) THEN
    RETURN json_build_object(
      'success', false,
      'message', 'This coach is already a member of a team.'
    );
  END IF;

  -- 4. Generate new token
  v_invite_token := encode(gen_random_bytes(32), 'hex');
  v_expires_at := NOW() + INTERVAL '7 days';

  -- 5. Create new invite record
  INSERT INTO coach_hierarchy (
    parent_coach_id,
    invite_email,
    invite_token,
    invite_expires_at,
    parent_coach_name
  )
  VALUES (
    p_parent_coach_id,
    p_invite_email,
    v_invite_token,
    v_expires_at,
    v_parent_name
  )
  RETURNING * INTO v_existing_invite;

  RETURN json_build_object(
    'success', true,
    'active_exists', false,
    'invite_token', v_invite_token,
    'invite_email', p_invite_email,
    'expires_at', v_expires_at,
    'parent_coach_name', v_parent_name
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', SQLERRM
    );
END;
$$;
