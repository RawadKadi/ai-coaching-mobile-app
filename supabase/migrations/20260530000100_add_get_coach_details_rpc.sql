-- Create get_coach_details function to safely retrieve coach details for clients
-- Uses SECURITY DEFINER to bypass RLS and fetch email from auth.users
CREATE OR REPLACE FUNCTION public.get_coach_details(p_coach_id UUID)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'id', c.id,
    'user_id', c.user_id,
    'business_name', c.business_name,
    'specialty', c.specialty,
    'bio', c.bio,
    'meeting_link', c.meeting_link,
    'subscription_tier', c.subscription_tier,
    'profiles', jsonb_build_object(
      'full_name', p.full_name,
      'avatar_url', p.avatar_url,
      'phone', p.phone,
      'timezone', p.timezone,
      'email', au.email
    )
  ) INTO v_result
  FROM public.coaches c
  JOIN public.profiles p ON p.id = c.user_id
  JOIN auth.users au ON au.id = c.user_id
  WHERE c.id = p_coach_id OR c.user_id = p_coach_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_coach_details(UUID) TO authenticated;
