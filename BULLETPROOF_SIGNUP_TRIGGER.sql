-- ============================================
-- SQL: Bulletproof Signup Handling & Auto-Linking
-- ============================================

-- 1. Create a function to handle new user registration automatically
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_role TEXT;
  v_full_name TEXT;
  v_invite RECORD;
  v_coach_id UUID;
  v_brand_id UUID;
BEGIN
  -- Get metadata from signup (full_name and role)
  v_full_name := COALESCE(new.raw_user_meta_data->>'full_name', 'New User');
  v_role := COALESCE(new.raw_user_meta_data->>'role', 'client');

  -- 1. Create Profile
  INSERT INTO public.profiles (id, full_name, role, onboarding_completed)
  VALUES (new.id, v_full_name, v_role::user_role, false)
  ON CONFLICT (id) DO NOTHING;

  -- 2. Create Role-Specific Record
  IF v_role = 'coach' THEN
    INSERT INTO public.coaches (user_id, is_active)
    VALUES (new.id, true)
    RETURNING id INTO v_coach_id;

    -- Create AI Brain for coach
    INSERT INTO public.ai_coach_brains (coach_id, tone, style)
    VALUES (v_coach_id, 'professional and motivating', 'supportive and educational');

    -- 3. CHECK FOR PENDING SUB-COACH INVITE BY EMAIL
    SELECT * FROM public.coach_hierarchy
    WHERE invite_email = new.email
      AND invite_accepted_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1
    INTO v_invite;

    IF v_invite.id IS NOT NULL THEN
      -- Get parent's brand
      SELECT brand_id INTO v_brand_id FROM public.coaches WHERE id = v_invite.parent_coach_id;

      -- Auto-Link Hierarchy
      UPDATE public.coach_hierarchy
      SET 
        child_coach_id = v_coach_id,
        invite_accepted_at = NOW()
      WHERE id = v_invite.id;

      -- Auto-Assign Brand & Role Settings
      UPDATE public.coaches
      SET 
        brand_id = v_brand_id,
        is_parent_coach = false,
        can_manage_brand = false
      WHERE id = v_coach_id;
    END IF;

  ELSIF v_role = 'client' THEN
    INSERT INTO public.clients (user_id)
    VALUES (new.id);
  END IF;

  RETURN new;
END;
$$;

-- 2. Attach the trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Update validate_subcoach_invite to be more helpful
CREATE OR REPLACE FUNCTION public.validate_subcoach_invite(
  p_invite_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_invite RECORD;
BEGIN
  SELECT ch.*, p.full_name as parent_name
  FROM public.coach_hierarchy ch
  JOIN public.coaches c ON c.id = ch.parent_coach_id
  JOIN public.profiles p ON p.id = c.user_id
  WHERE ch.invite_token = p_invite_token
    AND ch.invite_accepted_at IS NULL
  INTO v_invite;
  
  IF v_invite IS NULL THEN
    RETURN jsonb_build_object(
      'valid', false, 
      'message', 'Invite already used or invalid.'
    );
  END IF;
  
  RETURN jsonb_build_object(
    'valid', true,
    'parent_coach_name', v_invite.parent_name,
    'invite_email', v_invite.invite_email
  );
END;
$$;
