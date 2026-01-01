-- ULTIMATE FIX: Only check constraints when schedule fields change
-- This prevents false positives when just updating metadata

DROP TRIGGER IF EXISTS enforce_session_rules ON sessions;
DROP FUNCTION IF EXISTS prevent_session_violations() CASCADE;

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

  -- CRITICAL: Only validate if schedule fields are changing
  -- This prevents false positives when just updating metadata like invite_sent
  IF TG_OP = 'UPDATE' THEN
    -- Check if scheduled_at or duration_minutes changed
    IF OLD.scheduled_at = NEW.scheduled_at AND 
       OLD.duration_minutes = NEW.duration_minutes AND
       OLD.coach_id = NEW.coach_id AND
       OLD.client_id = NEW.client_id THEN
      -- No schedule changes, skip validation
      RETURN NEW;
    END IF;
    
    session_id_to_ignore := NEW.id;
  ELSE
    -- INSERT operation
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

CREATE TRIGGER enforce_session_rules
  BEFORE INSERT OR UPDATE ON sessions
  FOR EACH ROW
  EXECUTE FUNCTION prevent_session_violations();

SELECT 
  'FINAL FIX APPLIED!' as status,
  'Trigger now only validates when schedule fields change' as note,
  'Metadata updates (invite_sent, cancellation_reason) will not trigger validation' as benefit;
