-- Copy and run this EXACT SQL in Supabase SQL Editor

-- Drop old function
DROP FUNCTION IF EXISTS get_client_challenge_history(UUID);

-- Create new function with text casting (more compatible)
CREATE OR REPLACE FUNCTION get_client_challenge_history(
  p_client_id UUID
)
RETURNS TABLE (
  task_name TEXT,
  task_description TEXT,
  focus_type TEXT,
  intensity TEXT,
  assigned_date DATE,
  completed BOOLEAN,
  completed_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sc.name,
    COALESCE(sc.description, ''),
    sc.focus_type::TEXT,
    sc.intensity::TEXT,
    sc.assigned_date,
    sc.completed,
    sc.completed_at
  FROM sub_challenges sc
  JOIN mother_challenges mc ON sc.mother_challenge_id = mc.id
  WHERE mc.client_id = p_client_id
    AND sc.assigned_date >= CURRENT_DATE - INTERVAL '30 days'
    AND mc.status::TEXT != 'cancelled'
  ORDER BY sc.assigned_date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
