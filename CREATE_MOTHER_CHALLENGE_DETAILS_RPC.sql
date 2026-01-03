-- RPC to get mother challenge details with all sub-challenges
-- Used in the challenge details page
CREATE OR REPLACE FUNCTION get_mother_challenge_details(
  p_mother_challenge_id UUID
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  start_date DATE,
  end_date DATE,
  duration_days INTEGER,
  status TEXT,
  client_name TEXT,
  coach_name TEXT,
  created_at TIMESTAMPTZ,
  sub_challenges JSONB
) AS $$
BEGIN
  RETURN QUERY
  WITH sub_challenges_agg AS (
    SELECT 
      sc.mother_challenge_id,
      jsonb_agg(
        jsonb_build_object(
          'id', sc.id,
          'name', sc.name,
          'description', sc.description,
          'assigned_date', sc.assigned_date,
          'focus_type', sc.focus_type::TEXT,
          'intensity', sc.intensity::TEXT,
          'completed', sc.completed,
          'completed_at', sc.completed_at
        ) ORDER BY sc.assigned_date, sc.created_at
      ) AS sub_challenges_data
    FROM sub_challenges sc
    WHERE sc.mother_challenge_id = p_mother_challenge_id
    GROUP BY sc.mother_challenge_id
  )
  SELECT 
    mc.id,
    mc.name,
    mc.description,
    mc.start_date,
    mc.end_date,
    mc.duration_days,
    mc.status::TEXT,
    client_profile.full_name AS client_name,
    coach_profile.full_name AS coach_name,
    mc.created_at,
    COALESCE(sca.sub_challenges_data, '[]'::jsonb) AS sub_challenges
  FROM mother_challenges mc
  JOIN clients c ON mc.client_id = c.id
  JOIN profiles client_profile ON c.user_id = client_profile.id
  JOIN coaches coach ON mc.coach_id = coach.id
  JOIN profiles coach_profile ON coach.user_id = coach_profile.id
  LEFT JOIN sub_challenges_agg sca ON mc.id = sca.mother_challenge_id
  WHERE mc.id = p_mother_challenge_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
