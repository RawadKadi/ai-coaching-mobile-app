-- ===================================================================
-- FIX INFINITE RECURSION USING SECURITY DEFINER FUNCTIONS
-- ===================================================================

-- 1. Create helper functions to check permissions without triggering RLS
-- These functions are SECURITY DEFINER, meaning they run with the privileges of the creator (postgres),
-- bypassing RLS on the tables they query.

CREATE OR REPLACE FUNCTION can_view_coach_client_link(link_coach_id uuid, link_client_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user is the coach
  IF EXISTS (SELECT 1 FROM coaches WHERE id = link_coach_id AND user_id = auth.uid()) THEN
    RETURN true;
  END IF;

  -- Check if user is the client
  IF EXISTS (SELECT 1 FROM clients WHERE id = link_client_id AND user_id = auth.uid()) THEN
    RETURN true;
  END IF;

  -- Check if user is admin
  IF EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION is_link_coach(link_coach_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM coaches WHERE id = link_coach_id AND user_id = auth.uid());
END;
$$;

-- 2. Update RLS policies on coach_client_links to use these functions

-- Drop existing policies to be safe
DROP POLICY IF EXISTS "Users can view their own links" ON coach_client_links;
DROP POLICY IF EXISTS "Coaches can view their client links" ON coach_client_links;
DROP POLICY IF EXISTS "Clients can view their coach links" ON coach_client_links;
DROP POLICY IF EXISTS "Coaches can manage their client links" ON coach_client_links;
DROP POLICY IF EXISTS "Admins can view all links" ON coach_client_links;

-- Create new non-recursive policies
CREATE POLICY "Users can view their own links"
  ON coach_client_links FOR SELECT
  TO authenticated
  USING (can_view_coach_client_link(coach_id, client_id));

CREATE POLICY "Coaches can manage their client links"
  ON coach_client_links FOR ALL
  TO authenticated
  USING (is_link_coach(coach_id))
  WITH CHECK (is_link_coach(coach_id));
