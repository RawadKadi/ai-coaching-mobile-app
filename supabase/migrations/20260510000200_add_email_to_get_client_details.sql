-- Update get_client_details to include the client's email from auth.users
-- Uses SECURITY DEFINER so it can access auth.users
CREATE OR REPLACE FUNCTION get_client_details(target_client_id UUID)
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
    'date_of_birth', c.date_of_birth,
    'gender', c.gender,
    'height_cm', c.height_cm,
    'goal', c.goal,
    'experience_level', c.experience_level,
    'dietary_restrictions', c.dietary_restrictions,
    'medical_conditions', c.medical_conditions,
    'profiles', jsonb_build_object(
      'full_name', p.full_name,
      'avatar_url', p.avatar_url,
      'role', p.role,
      'email', au.email
    ),
    'latest_weight', (
      SELECT weight_kg
      FROM check_ins
      WHERE client_id = target_client_id
        AND weight_kg IS NOT NULL
      ORDER BY date DESC
      LIMIT 1
    )
  ) INTO v_result
  FROM clients c
  JOIN profiles p ON p.id = c.user_id
  JOIN auth.users au ON au.id = c.user_id
  WHERE c.id = target_client_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_client_details TO authenticated;
