-- ===================================================================
-- SETUP CLIENT DETAILS API (SECURE ACCESS)
-- ===================================================================
-- Creates functions to fetch client details and habits securely,
-- bypassing RLS to avoid any recursion or permission errors.
-- ===================================================================

-- 1. Function to get single client details (with profile)
CREATE OR REPLACE FUNCTION get_client_details(target_client_id uuid)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT 
    to_jsonb(c.*) || jsonb_build_object('profiles', to_jsonb(p.*))
  INTO result
  FROM clients c
  JOIN profiles p ON p.id = c.user_id
  JOIN coach_client_links ccl ON ccl.client_id = c.id
  JOIN coaches co ON co.id = ccl.coach_id
  WHERE c.id = target_client_id
  AND co.user_id = auth.uid(); -- Security check: Must be linked to coach

  RETURN result;
END;
$$;

-- 2. Function to get client habits
CREATE OR REPLACE FUNCTION get_client_habits(target_client_id uuid)
RETURNS SETOF habits
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Security check: Ensure coach is linked to client
  IF NOT EXISTS (
    SELECT 1 FROM coach_client_links ccl
    JOIN coaches co ON co.id = ccl.coach_id
    WHERE ccl.client_id = target_client_id
    AND co.user_id = auth.uid()
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT * FROM habits
  WHERE client_id = target_client_id
  ORDER BY created_at DESC;
END;
$$;
