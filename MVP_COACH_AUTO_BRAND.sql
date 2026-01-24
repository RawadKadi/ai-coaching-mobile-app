-- ============================================
-- MVP COACH AUTO-BRAND CREATION
-- ============================================
-- When a coach signs up on their own (not via invite),
-- automatically make them a parent coach with their own brand.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_role TEXT;
  v_full_name TEXT;
  v_token_from_meta TEXT;
  v_invite RECORD;
  v_coach_id UUID;
  v_brand_id UUID;
  v_new_brand_id UUID;
BEGIN
  -- Extract metadata
  v_full_name := COALESCE(new.raw_user_meta_data->>'full_name', 'New User');
  v_role := COALESCE(new.raw_user_meta_data->>'role', 'client');
  v_token_from_meta := new.raw_user_meta_data->>'invite_token';

  -- Create profile
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (new.id, v_full_name, v_role::user_role)
  ON CONFLICT (id) DO NOTHING;

  IF v_role = 'coach' THEN
    -- Create coach record
    INSERT INTO public.coaches (user_id, is_active)
    VALUES (new.id, true)
    RETURNING id INTO v_coach_id;

    -- Create AI brain
    INSERT INTO public.ai_coach_brains (coach_id) VALUES (v_coach_id);

    -- Try to find existing invite (for sub-coach signup)
    SELECT * FROM public.coach_hierarchy
    WHERE ((invite_token = v_token_from_meta) OR (LOWER(invite_email) = LOWER(new.email)))
    AND invite_accepted_at IS NULL
    ORDER BY created_at DESC LIMIT 1
    INTO v_invite;

    -- CASE 1: Sub-coach invited by another coach
    IF v_invite.id IS NOT NULL AND LOWER(v_invite.invite_email) = LOWER(new.email) THEN
      -- Get parent coach's brand
      SELECT brand_id INTO v_brand_id FROM public.coaches WHERE id = v_invite.parent_coach_id;

      -- Link to parent's brand as sub-coach
      UPDATE public.coach_hierarchy
      SET child_coach_id = v_coach_id, invite_accepted_at = NOW()
      WHERE id = v_invite.id;

      UPDATE public.coaches
      SET 
        brand_id = v_brand_id,
        is_parent_coach = false,
        can_manage_brand = false
      WHERE id = v_coach_id;

    -- CASE 2: Standalone coach signup (MVP Main Coach)
    ELSE
      -- Create new brand for this coach
      INSERT INTO public.brands (
        name,
        primary_color,
        secondary_color,
        created_by
      )
      VALUES (
        v_full_name || '''s Coaching',
        '#3B82F6',  -- Default blue
        '#10B981',  -- Default green
        v_coach_id
      )
      RETURNING id INTO v_new_brand_id;

      -- Make them a parent coach with their own brand
      UPDATE public.coaches
      SET 
        brand_id = v_new_brand_id,
        is_parent_coach = true,
        can_manage_brand = true
      WHERE id = v_coach_id;
    END IF;

  ELSIF v_role = 'client' THEN
    INSERT INTO public.clients (user_id) VALUES (new.id);
  END IF;

  RETURN new;
END;
$$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
