-- ============================================================================
-- CHALLENGE MODES & AUTOMATIC STATUS TRANSITIONS
-- Created: 2026-01-21
-- Purpose: Formalize Client vs Campaign modes and enforce strict time-based states
-- ============================================================================

-- 1. Create Challenge Mode Enum
DO $$ BEGIN
    CREATE TYPE challenge_mode AS ENUM ('relative', 'fixed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Update Mother Challenges Table
ALTER TABLE mother_challenges
    ADD COLUMN IF NOT EXISTS mode challenge_mode NOT NULL DEFAULT 'relative';

-- Ensure status enum has upcoming/expired if not already (assuming challenge_status enum)
-- For this migration, we'll alter the text constraint if it was text, or just rely on existing values if flexible.
-- Checking previous files, status was often text or enum. Let's make sure we can support 'upcoming' and 'expired'.
-- Previous definition: CREATE TYPE challenge_status AS ENUM ('draft', 'suggested', 'active', 'completed', 'cancelled');
-- We need to add 'upcoming' and 'expired' to the enum if they don't exist.

ALTER TYPE challenge_status ADD VALUE IF NOT EXISTS 'upcoming' BEFORE 'active';
ALTER TYPE challenge_status ADD VALUE IF NOT EXISTS 'expired' AFTER 'completed';

-- 3. Automatic Status Update Function (Lazy Execution)
-- This function will be called whenever challenges are fetched to ensure freshness
CREATE OR REPLACE FUNCTION update_challenge_statuses(p_client_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Transition 1: Upcoming -> Active
    -- If today >= start_date AND status is upcoming
    UPDATE mother_challenges
    SET status = 'active', updated_at = NOW()
    WHERE client_id = p_client_id
    AND status = 'upcoming'
    AND start_date <= CURRENT_DATE;

    -- Transition 2: Active -> Completed (Time-based expiration)
    -- If today > end_date AND status is active
    -- Note: We mark as 'completed' or 'expired'? 
    -- Requirement: "Must auto-expire and transition state". 
    -- Let's stick to 'completed' implies successfully finished time, 
    -- 'expired' might imply user didn't finish it. 
    -- For now, let's treat "time ran out" as 'completed' (as in, the challenge period is over).
    -- User request says "users get a completion summary", implying 'completed' state is better for UI.
    -- However, "expired" was explicitly requested. Let's use 'expired' for clear distinction if desired,
    -- OR 'completed' if we just mean "finished".
    -- "Client challenges ... Must auto-expire".
    -- Let's use 'expired' to indicate "Time is up, you can't do it anymore".
    
    UPDATE mother_challenges
    SET status = 'expired', updated_at = NOW()
    WHERE client_id = p_client_id
    AND status = 'active'
    AND end_date < CURRENT_DATE;

END;
$$;

-- Grant execute
GRANT EXECUTE ON FUNCTION update_challenge_statuses TO authenticated;
