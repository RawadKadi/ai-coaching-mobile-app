-- ===================================================================
-- SETUP API FUNCTIONS (SECURE DATA ACCESS)
-- ===================================================================
-- This creates "API endpoints" (Postgres Functions) that your app
-- can call directly. This bypasses RLS complexity while maintaining
-- strict security (checking auth.uid() inside the function).
-- ===================================================================

-- 1. Function to get all clients for the logged-in coach
CREATE OR REPLACE FUNCTION get_my_clients()
RETURNS TABLE (
  link_id uuid,
  status link_status,
  client_id uuid,
  client_goal text,
  client_experience text,
  client_name text,
  client_avatar text
) 
SECURITY DEFINER -- Runs with admin privileges (bypasses RLS)
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ccl.id as link_id,
    ccl.status,
    c.id as client_id,
    c.goal as client_goal,
    c.experience_level as client_experience,
    p.full_name as client_name,
    p.avatar_url as client_avatar
  FROM coach_client_links ccl
  JOIN coaches co ON co.id = ccl.coach_id
  JOIN clients c ON c.id = ccl.client_id
  JOIN profiles p ON p.id = c.user_id
  WHERE co.user_id = auth.uid() -- STRICT SECURITY CHECK
  ORDER BY p.full_name ASC;
END;
$$;

-- 2. Function to get dashboard stats for the logged-in coach
CREATE OR REPLACE FUNCTION get_coach_stats()
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  total_clients int;
  active_clients int;
  pending_checkins int;
  today_date date := CURRENT_DATE;
BEGIN
  -- 1. Get client counts
  SELECT 
    count(*), 
    count(*) FILTER (WHERE status = 'active')
  INTO 
    total_clients, 
    active_clients
  FROM coach_client_links ccl
  JOIN coaches co ON co.id = ccl.coach_id
  WHERE co.user_id = auth.uid(); -- STRICT SECURITY CHECK
  
  -- 2. Get pending check-ins count
  -- (Active clients who don't have a check-in for today)
  SELECT count(*)
  INTO pending_checkins
  FROM coach_client_links ccl
  JOIN coaches co ON co.id = ccl.coach_id
  WHERE co.user_id = auth.uid()
  AND ccl.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM check_ins ci
    WHERE ci.client_id = ccl.client_id
    AND ci.date = today_date
  );
  
  RETURN jsonb_build_object(
    'totalClients', COALESCE(total_clients, 0),
    'activeClients', COALESCE(active_clients, 0),
    'pendingCheckIns', COALESCE(pending_checkins, 0)
  );
END;
$$;

-- 3. Function to get recent check-ins for a coach's roster
CREATE OR REPLACE FUNCTION get_recent_checkins()
RETURNS TABLE (
  checkin_id uuid,
  client_id uuid,
  client_name text,
  client_avatar text,
  weight_kg numeric,
  energy_level int,
  mood text,
  created_at timestamptz
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ci.id as checkin_id,
    c.id as client_id,
    p.full_name as client_name,
    p.avatar_url as client_avatar,
    ci.weight_kg,
    ci.energy_level,
    ci.mood,
    ci.created_at
  FROM check_ins ci
  JOIN clients c ON c.id = ci.client_id
  JOIN profiles p ON p.id = c.user_id
  JOIN coach_client_links ccl ON ccl.client_id = c.id
  JOIN coaches co ON co.id = ccl.coach_id
  WHERE co.user_id = auth.uid()
  AND ccl.status = 'active'
  AND ci.date >= CURRENT_DATE - INTERVAL '2 days'
  ORDER BY ci.created_at DESC
  LIMIT 20;
END;
$$;
