-- Updated RPC with correct return types matching schema ENUMs
CREATE OR REPLACE FUNCTION get_client_challenge_history(
  p_client_id UUID
)
RETURNS TABLE (
  task_name TEXT,
  task_description TEXT,
  focus_type challenge_focus_type,  -- Using the actual enum type
  intensity challenge_intensity,     -- Using the actual enum type
  assigned_date DATE,
  completed BOOLEAN,
  completed_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sc.name::TEXT,
    sc.description::TEXT,
    sc.focus_type,
    sc.intensity,
    sc.assigned_date,
    sc.completed,
    sc.completed_at
  FROM sub_challenges sc
  JOIN mother_challenges mc ON sc.mother_challenge_id = mc.id
  WHERE mc.client_id = p_client_id
    AND sc.assigned_date >= CURRENT_DATE - INTERVAL '30 days'
    AND mc.status != 'cancelled'
  ORDER BY sc.assigned_date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
