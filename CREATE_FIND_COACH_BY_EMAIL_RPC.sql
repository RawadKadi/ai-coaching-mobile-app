-- ============================================
-- FIX: Find Coach by Email RPC
-- ============================================
-- This allows searching for coaches by their email address
-- which is stored in auth.users, not in the profiles or coaches tables

CREATE OR REPLACE FUNCTION find_coach_by_email(
  p_email TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_profile RECORD;
  v_coach RECORD;
  v_result JSON;
BEGIN
  -- Find the user ID by email from auth.users
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE LOWER(email) = LOWER(p_email)
  LIMIT 1;
  
  IF v_user_id IS NULL THEN
    RETURN json_build_object(
      'found', false,
      'error', 'No user found with this email'
    );
  END IF;
  
  -- Get the profile
  SELECT * INTO v_profile
  FROM profiles
  WHERE id = v_user_id
  AND role = 'coach';
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'found', false,
      'error', 'User found but not a coach'
    );
  END IF;
  
  -- Get the coach record
  SELECT * INTO v_coach
  FROM coaches
  WHERE user_id = v_user_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'found', false,
      'error', 'Coach profile not found'
    );
  END IF;
  
  -- Return coach data
  v_result := json_build_object(
    'found', true,
    'coach_id', v_coach.id,
    'user_id', v_user_id,
    'brand_id', v_coach.brand_id,
    'full_name', v_profile.full_name,
    'email', p_email
  );
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'found', false,
      'error', SQLERRM
    );
END;
$$;

-- Grant permission
GRANT EXECUTE ON FUNCTION find_coach_by_email(TEXT) TO authenticated;

-- Test it (replace with real email):
-- SELECT find_coach_by_email('coach@example.com');
