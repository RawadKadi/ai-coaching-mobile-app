-- RPC to get all clients for a coach
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
