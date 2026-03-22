-- ============================================================================
-- FIX: Challenge Creation Bug - Duplicate INSERT Values
-- Date: 2026-01-24
-- Issue: create_mother_challenge had 17 VALUES for 11 columns
--        Client challenges not showing due to status filtering
-- ============================================================================

-- Ensure required enum types exist
DO $$ BEGIN
    CREATE TYPE challenge_mode AS ENUM ('relative', 'fixed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add missing values to challenge_status enum if they don't exist
DO $$ BEGIN
    ALTER TYPE challenge_status ADD VALUE IF NOT EXISTS 'upcoming';
    ALTER TYPE challenge_status ADD VALUE IF NOT EXISTS 'expired';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add mode column to mother_challenges if it doesn't exist
ALTER TABLE mother_challenges
    ADD COLUMN IF NOT EXISTS mode challenge_mode NOT NULL DEFAULT 'relative';

-- Drop all existing versions of the functions to avoid conflicts
DROP FUNCTION IF EXISTS create_mother_challenge CASCADE;
DROP FUNCTION IF EXISTS get_todays_sub_challenges CASCADE;

-- Fix the create_mother_challenge function
CREATE OR REPLACE FUNCTION create_mother_challenge(
    p_coach_id UUID,
    p_client_id UUID,
    p_name TEXT,
    p_description TEXT,
    p_start_date DATE,
    p_end_date DATE,
    p_sub_challenges JSONB,
    p_created_by challenge_creator DEFAULT 'coach',
    p_trigger_reason TEXT DEFAULT NULL,
    p_ai_reasoning TEXT DEFAULT NULL,
    p_mode challenge_mode DEFAULT 'relative'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_mother_id UUID;
    v_sub JSONB;
    v_start_date DATE;
    v_end_date DATE;
    v_initial_status challenge_status;
BEGIN
    -- Handle Relative Mode defaults
    IF p_mode = 'relative' THEN
        -- Relative challenges start TODAY if not specified
        v_start_date := COALESCE(p_start_date, CURRENT_DATE);
    ELSE
        v_start_date := p_start_date;
    END IF;
    
    v_end_date := p_end_date;
    
    -- Determine Initial Status
    IF v_start_date > CURRENT_DATE THEN
        v_initial_status := 'upcoming';
    ELSE
        v_initial_status := 'active';
    END IF;

    -- Verify coach-client relationship
    IF NOT EXISTS (
        SELECT 1 FROM coach_client_links
        WHERE coach_id = p_coach_id
        AND client_id = p_client_id
        AND status = 'active'
    ) THEN
        RAISE EXCEPTION 'Coach-client relationship not found or inactive';
    END IF;

    -- Create mother challenge (FIXED: removed duplicate values)
    INSERT INTO mother_challenges (
        coach_id,
        client_id,
        name,
        description,
        start_date,
        end_date,
        created_by,
        trigger_reason,
        ai_reasoning,
        status,
        mode
    ) VALUES (
        p_coach_id,
        p_client_id,
        p_name,
        p_description,
        v_start_date,
        v_end_date,
        p_created_by,
        p_trigger_reason,
        p_ai_reasoning,
        v_initial_status,
        p_mode
    )
    RETURNING id INTO v_mother_id;

    -- Create all sub-challenges
    FOR v_sub IN SELECT * FROM jsonb_array_elements(p_sub_challenges)
    LOOP
        INSERT INTO sub_challenges (
            mother_challenge_id,
            assigned_date,
            name,
            description,
            focus_type,
            intensity
        ) VALUES (
            v_mother_id,
            (v_sub->>'assigned_date')::DATE,
            v_sub->>'name',
            v_sub->>'description',
            (v_sub->>'focus_type')::challenge_focus_type,
            COALESCE((v_sub->>'intensity')::challenge_intensity, 'medium')
        );
    END LOOP;

    RETURN v_mother_id;
END;
$$;

-- ============================================================================
-- FIX: Update get_todays_sub_challenges to show challenges that have started
-- Show challenges where start_date <= today, regardless of active/upcoming status
-- ============================================================================

CREATE OR REPLACE FUNCTION get_todays_sub_challenges(
    p_client_id UUID,
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    id UUID,
    mother_challenge_id UUID,
    mother_name TEXT,
    name TEXT,
    description TEXT,
    focus_type challenge_focus_type,
    intensity challenge_intensity,
    completed BOOLEAN,
    completed_at TIMESTAMPTZ,
    notes TEXT,
    proof_image_url TEXT,
    created_by challenge_creator
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        sc.id,
        sc.mother_challenge_id,
        mc.name as mother_name,
        sc.name,
        sc.description,
        sc.focus_type,
        sc.intensity,
        sc.completed,
        sc.completed_at,
        sc.notes,
        sc.proof_image_url,
        mc.created_by
    FROM sub_challenges sc
    JOIN mother_challenges mc ON sc.mother_challenge_id = mc.id
    WHERE mc.client_id = p_client_id
    AND sc.assigned_date = p_date
    AND mc.start_date <= p_date  -- Show if challenge has started
    AND mc.status != 'cancelled'  -- Hide cancelled challenges
    ORDER BY sc.created_at ASC;
END;
$$;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION create_mother_challenge TO authenticated;
GRANT EXECUTE ON FUNCTION get_todays_sub_challenges TO authenticated;
