-- ================================================================
-- ABSOLUTE DAILY SINGULARITY - DATABASE SAFETY NET
-- Enforces that a client can only have ONE session per day (scheduled_at::date).
-- Throws a 409 Conflict exception if an insertion/update would violate this rule,
-- which acts as our database-level safety net.
-- ================================================================

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
  IF TG_OP = 'UPDATE' THEN
    IF OLD.scheduled_at = NEW.scheduled_at AND 
       OLD.duration_minutes = NEW.duration_minutes AND
       OLD.coach_id = NEW.coach_id AND
       OLD.client_id = NEW.client_id THEN
      RETURN NEW;
    END IF;
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

  -- Rule 2: Enforce Absolute Daily Singularity (1 session per client per day)
  -- Throw a clear 409 Conflict exception if bypassed
  has_daily_limit := check_client_daily_limit(
    NEW.client_id, 
    NEW.scheduled_at, 
    session_id_to_ignore
  );
  
  IF has_daily_limit THEN
    RAISE EXCEPTION '409 Conflict: Daily Singularity Violation. Client already has a session on this day.'
      USING HINT = 'Only one session per day is allowed per client. Bypass attempt blocked.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Re-create the trigger to run BEFORE INSERT OR UPDATE on sessions
DROP TRIGGER IF EXISTS enforce_session_rules ON sessions;
CREATE TRIGGER enforce_session_rules
  BEFORE INSERT OR UPDATE ON sessions
  FOR EACH ROW
  EXECUTE FUNCTION prevent_session_violations();

SELECT 
  'DATABASE CONSTRAINTS FULLY RE-ACTIVATED!' as status,
  'Absolute Daily Singularity: ENFORCED WITH 409 ERROR' as rules;
