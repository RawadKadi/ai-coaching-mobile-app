-- ============================================
-- RUN THESE IN SUPABASE SQL EDITOR
-- ============================================

-- 1. Get coach clients RPC
CREATE OR REPLACE FUNCTION get_coach_clients(
  p_coach_id UUID
)
RETURNS TABLE (
  id UUID,
  full_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    p.full_name
  FROM clients c
  JOIN coach_client_links ccl ON c.id = ccl.client_id
  JOIN profiles p ON c.user_id = p.id
  WHERE ccl.coach_id = p_coach_id
    AND ccl.status = 'active'
  ORDER BY p.full_name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Get client challenge history RPC
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
    sc.description,
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
