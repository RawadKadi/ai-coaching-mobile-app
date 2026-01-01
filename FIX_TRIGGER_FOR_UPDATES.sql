-- FIX: Update database trigger to allow updates to existing sessions
-- The current trigger blocks UPDATES because it checks the session against itself

-- Drop the old trigger
DROP TRIGGER IF EXISTS enforce_session_rules ON sessions;
DROP FUNCTION IF EXISTS prevent_session_violations();

-- Recreate the function with proper UPDATE handling
CREATE OR REPLACE FUNCTION prevent_session_violations()
RETURNS TRIGGER AS $$
BEGIN
  -- Skip validation for cancelled sessions
  IF NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  -- For UPDATE operations, pass the session ID so we don't check it against itself
  -- For INSERT operations, pass NULL
  DECLARE
    current_session_id UUID;
  BEGIN
    IF TG_OP = 'UPDATE' THEN
      current_session_id := NEW.id;
    ELSE
      current_session_id := NULL;
    END IF;

    -- Rule 1: Check for coach time overlaps
    IF check_session_overlap(NEW.coach_id, NEW.scheduled_at, NEW.duration_minutes, current_session_id) THEN
      RAISE EXCEPTION 'OVERLAP_VIOLATION: Coach already has a session at this time'
        USING HINT = 'Choose a different time slot';
    END IF;

    -- Rule 2: Check client daily limit
    IF check_client_daily_limit(NEW.client_id, NEW.scheduled_at, current_session_id) THEN
      RAISE EXCEPTION 'DAILY_LIMIT_VIOLATION: Client already has a session on this day'
        USING HINT = 'Only one session per day is allowed per client';
    END IF;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER enforce_session_rules
  BEFORE INSERT OR UPDATE ON sessions
  FOR EACH ROW
  EXECUTE FUNCTION prevent_session_violations();

-- Verify
SELECT 'Trigger updated successfully!' as status;
