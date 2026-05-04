
-- Update get_my_clients to include client_user_id for real-time presence tracking
DROP FUNCTION IF EXISTS public.get_my_clients();

CREATE OR REPLACE FUNCTION public.get_my_clients()
RETURNS TABLE (
  link_id uuid,
  status text,
  client_id uuid,
  client_user_id uuid,
  client_goal text,
  client_experience text,
  client_name text,
  client_avatar text
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ccl.id as link_id,
    ccl.status::text,
    c.id as client_id,
    c.user_id as client_user_id,
    c.goal as client_goal,
    c.experience_level as client_experience,
    p.full_name as client_name,
    p.avatar_url as client_avatar
  FROM coach_client_links ccl
  JOIN coaches co ON co.id = ccl.coach_id
  JOIN clients c ON c.id = ccl.client_id
  JOIN profiles p ON p.id = c.user_id
  WHERE co.user_id = auth.uid()
  ORDER BY p.full_name ASC;
END;
$$;
