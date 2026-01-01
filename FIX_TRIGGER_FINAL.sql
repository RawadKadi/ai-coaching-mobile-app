-- FINAL FIX: Properly handle UPDATE operations in trigger
-- This version correctly passes the session ID to skip self-checking

DROP TRIGGER IF EXISTS enforce_session_rules ON sessions;
DROP FUNCTION IF EXISTS prevent_session_violations();

-- Recreate function with simpler logic
CREATE OR REPLACE FUNCTION prevent_session_violations()
RETURNS TRIGGER AS $$
DECLARE
  session_id_to_ignore UUID;
  has_overlap BOOLEAN;
  has_daily_limit BOOLEAN;
BEGIN
  -- Skip validation for cancelled sessions
  IF NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  -- For UPDATE: ignore the current session when checking
  -- For INSERT: don't ignore any session
  IF TG_OP = 'UPDATE' THEN
    session_id_to_ignore := NEW.id;
  ELSE
    session_id_to_ignore := NULL;
  END IF;

  -- Rule 1: Check for coach time overlaps
  has_overlap := check_session_overlap(
    NEW.coach_id, 
    NEW.scheduled_at, 
    NEW.duration_minutes, 
    session_id_to_ignore
  );
  
  IF has_overlap THEN
    RAISE EXCEPTION 'OVERLAP_VIOLATION: Coach already has a session at this time'
      USING HINT = 'Choose a different time slot';
  END IF;

  -- Rule 2: Check client daily limit
  has_daily_limit := check_client_daily_limit(
    NEW.client_id, 
    NEW.scheduled_at, 
    session_id_to_ignore
  );
  
  IF has_daily_limit THEN
    RAISE EXCEPTION 'DAILY_LIMIT_VIOLATION: Client already has a session on this day'
      USING HINT = 'Only one session per day is allowed per client';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger
CREATE TRIGGER enforce_session_rules
  BEFORE INSERT OR UPDATE ON sessions
  FOR EACH ROW
  EXECUTE FUNCTION prevent_session_violations();

-- Test the fix
SELECT 
  'Trigger fixed!' as status,
  'UPDATE operations will now exclude the session being updated from overlap checks' as behavior;
