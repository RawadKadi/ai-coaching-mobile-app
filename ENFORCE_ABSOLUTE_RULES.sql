-- ================================================================
-- ABSOLUTE RULES - DATABASE CONSTRAINTS
-- These constraints PREVENT the two critical violations:
-- 1. No two clients can have overlapping sessions with same coach
-- 2. Each client can have MAX 1 session per day
-- ================================================================

-- Step 1: Clean up existing violations before adding constraints
-- This will keep only the MOST RECENT session for each (client + day) combination

WITH ranked_sessions AS (
  SELECT 
    id,
    client_id,
    coach_id,
    DATE(scheduled_at) as session_date,
    scheduled_at,
    ROW_NUMBER() OVER (
      PARTITION BY client_id, DATE(scheduled_at) 
      ORDER BY created_at DESC, scheduled_at DESC
    ) as rn
  FROM sessions
  WHERE status != 'cancelled'
)
DELETE FROM sessions
WHERE id IN (
  SELECT id FROM ranked_sessions WHERE rn > 1
);

-- Verify cleanup
SELECT 
  'Cleanup complete!' as message,
  COUNT(*) as total_sessions,
  COUNT(DISTINCT (client_id, DATE(scheduled_at))) as unique_client_days
FROM sessions
WHERE status != 'cancelled';

-- Step 2: Create a function to check for overlaps
-- This function returns TRUE if there's an overlap, FALSE otherwise
CREATE OR REPLACE FUNCTION check_session_overlap(
  p_coach_id UUID,
  p_scheduled_at TIMESTAMPTZ,
  p_duration_minutes INT,
  p_session_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  overlap_count INT;
BEGIN
  SELECT COUNT(*)
  INTO overlap_count
  FROM sessions
  WHERE coach_id = p_coach_id
    AND status != 'cancelled'
    AND (p_session_id IS NULL OR id != p_session_id)
    AND DATE(scheduled_at) = DATE(p_scheduled_at)
    AND (
      -- Check for time overlap
      (scheduled_at, scheduled_at + (duration_minutes || ' minutes')::INTERVAL) OVERLAPS
      (p_scheduled_at, p_scheduled_at + (p_duration_minutes || ' minutes')::INTERVAL)
    );
  
  RETURN overlap_count > 0;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create a function to check client daily limit
CREATE OR REPLACE FUNCTION check_client_daily_limit(
  p_client_id UUID,
  p_scheduled_at TIMESTAMPTZ,
  p_session_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  session_count INT;
BEGIN
  SELECT COUNT(*)
  INTO session_count
  FROM sessions
  WHERE client_id = p_client_id
    AND status != 'cancelled'
    AND (p_session_id IS NULL OR id != p_session_id)
    AND DATE(scheduled_at) = DATE(p_scheduled_at);
  
  RETURN session_count > 0;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create trigger to enforce rules on INSERT
CREATE OR REPLACE FUNCTION prevent_session_violations()
RETURNS TRIGGER AS $$
BEGIN
  -- Skip validation for cancelled sessions
  IF NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  -- Rule 1: Check for coach time overlaps
  IF check_session_overlap(NEW.coach_id, NEW.scheduled_at, NEW.duration_minutes, NEW.id) THEN
    RAISE EXCEPTION 'OVERLAP_VIOLATION: Coach already has a session at this time'
      USING HINT = 'Choose a different time slot';
  END IF;

  -- Rule 2: Check client daily limit
  IF check_client_daily_limit(NEW.client_id, NEW.scheduled_at, NEW.id) THEN
    RAISE EXCEPTION 'DAILY_LIMIT_VIOLATION: Client already has a session on this day'
      USING HINT = 'Only one session per day is allowed per client';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS enforce_session_rules ON sessions;

-- Create trigger for both INSERT and UPDATE
CREATE TRIGGER enforce_session_rules
  BEFORE INSERT OR UPDATE ON sessions
  FOR EACH ROW
  EXECUTE FUNCTION prevent_session_violations();

-- Verify setup
SELECT 
  'Database constraints activated!' as status,
  'Overlaps: PREVENTED' as rule_1,
  'Max 1/day: ENFORCED' as rule_2;
