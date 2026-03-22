-- Migration: Sub-Coach Termination Feature

-- 1. Add status tracking to hierarchy table
ALTER TABLE coach_hierarchy 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
ADD COLUMN IF NOT EXISTS terminated_at TIMESTAMP WITH TIME ZONE;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_coach_hierarchy_status ON coach_hierarchy(status);

-- 2. Add 'sub_coach_terminated' to allowed event types in analytics_events
ALTER TABLE analytics_events 
DROP CONSTRAINT IF EXISTS valid_event_type;

ALTER TABLE analytics_events
ADD CONSTRAINT valid_event_type CHECK (
  event_type IN (
    'login',
    'challenge_complete',
    'session_attend',
    'meal_log',
    'check_in',
    'message_sent',
    'invite_used',
    'client_transferred',
    'sub_coach_terminated'
  )
);

-- 3. Create RPC Function to Terminate Sub-Coach
CREATE OR REPLACE FUNCTION terminate_sub_coach(
  p_sub_coach_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_main_coach_id UUID;
  v_hierarchy_id UUID;
  v_brand_id UUID;
BEGIN
  -- Get main coach ID from auth (Security check)
  SELECT id, brand_id INTO v_main_coach_id, v_brand_id
  FROM coaches
  WHERE user_id = auth.uid();

  IF v_main_coach_id IS NULL THEN
    RAISE EXCEPTION 'Not authorized: Caller is not a coach';
  END IF;

  -- Verify hierarchy relationship exists and is active
  SELECT id INTO v_hierarchy_id
  FROM coach_hierarchy
  WHERE parent_coach_id = v_main_coach_id
  AND child_coach_id = p_sub_coach_id
  AND (status IS NULL OR status = 'active');

  IF v_hierarchy_id IS NULL THEN
    RAISE EXCEPTION 'Action failed: Sub-coach not found in your team or already terminated.';
  END IF;

  -- 1. Terminate hierarchy relationship
  UPDATE coach_hierarchy
  SET status = 'terminated',
      terminated_at = NOW()
  WHERE id = v_hierarchy_id;

  -- 2. Detach sub-coach from brand (Make them independent)
  UPDATE coaches
  SET brand_id = NULL,
      is_parent_coach = TRUE -- Start them as their own independent coach
  WHERE id = p_sub_coach_id;

  -- 3. Unassign clients (Set status to inactive)
  -- Logic: We do not transfer them automatically to Main Coach to avoid confusion.
  -- Main coach can re-assign them manually from the "All Clients" list if they have permissions.
  -- Or typically, clients revert to "unassigned" state or stay linked to brand but no coach?
  -- Current implementation: Just mark the link as inactive.
  UPDATE coach_client_links
  SET status = 'inactive',
      ended_at = NOW()
  WHERE coach_id = p_sub_coach_id
  AND status = 'active';

  -- 4. Log the event for audit
  INSERT INTO analytics_events (event_type, brand_id, coach_id, event_data)
  VALUES (
    'sub_coach_terminated', 
    v_brand_id,
    v_main_coach_id,
    jsonb_build_object(
      'sub_coach_id', p_sub_coach_id, 
      'reason', p_reason,
      'action', 'brand_detached_clients_unassigned'
    )
  );

  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Termination failed: %', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION terminate_sub_coach(UUID, TEXT) TO authenticated;
