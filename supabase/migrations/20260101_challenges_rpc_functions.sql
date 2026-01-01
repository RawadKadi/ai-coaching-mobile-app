-- =====================================================
-- AI-ASSISTED CHALLENGES SYSTEM - RPC FUNCTIONS
-- =====================================================
-- Created: 2026-01-01
-- Purpose: Business logic functions for challenges system

-- =====================================================
-- 1. GET CLIENT CHALLENGE CONTEXT
-- =====================================================
-- Returns comprehensive context for AI challenge generation
-- Used by: AI suggestion triggers and on-demand generation

CREATE OR REPLACE FUNCTION get_client_challenge_context(p_client_id UUID)
RETURNS JSONB AS $$
DECLARE
    context JSONB;
    client_info JSONB;
    recent_checkins JSONB;
    recent_challenges JSONB;
    recent_meals JSONB;
    recent_sessions JSONB;
    goal_info JSONB;
BEGIN
    -- Get client basic info
    SELECT jsonb_build_object(
        'id', c.user_id,
        'goal', c.goal,
        'experience_level', c.experience_level,
        'health_conditions', c.medical_conditions,
        'dietary_restrictions', c.dietary_restrictions
    )
    INTO client_info
    FROM clients c
    WHERE c.user_id = p_client_id;
    
    -- Get recent check-ins (last 7 days)
    SELECT jsonb_agg(
        jsonb_build_object(
            'date', date,
            'weight_kg', weight_kg,
            'energy_level', energy_level,
            'stress_level', stress_level,
            'mood', mood
        ) ORDER BY date DESC
    )
    INTO recent_checkins
    FROM (
        SELECT * FROM check_ins
        WHERE client_id = p_client_id
        AND date >= CURRENT_DATE - INTERVAL '7 days'
        ORDER BY date DESC
        LIMIT 7
    ) sub;
    
    -- Get recent challenges (last 14 days)
    SELECT jsonb_agg(
        jsonb_build_object(
            'name', name,
            'focus_type', focus_type,
            'status', status,
            'start_date', start_date,
            'end_date', end_date,
            'completed', CASE WHEN status = 'completed' THEN true ELSE false END
        ) ORDER BY created_at DESC
    )
    INTO recent_challenges
    FROM (
        SELECT * FROM challenges
        WHERE client_id = p_client_id
        AND created_at >= NOW() - INTERVAL '14 days'
        ORDER BY created_at DESC
        LIMIT 5
    ) sub;
    
    -- Get recent meals (last 3 days)
    SELECT jsonb_agg(
        jsonb_build_object(
            'meal_date', meal_date,
            'meal_type', meal_type,
            'name', name,
            'calories', calories,
            'protein_g', protein_g
        ) ORDER BY meal_date DESC
    )
    INTO recent_meals
    FROM (
        SELECT * FROM meal_entries
        WHERE client_id = p_client_id
        AND meal_date >= CURRENT_DATE - INTERVAL '3 days'
        ORDER BY meal_date DESC
        LIMIT 10
    ) sub;
    
    -- Get recent sessions (last 7 days)
    SELECT jsonb_agg(
        jsonb_build_object(
            'scheduled_at', scheduled_at,
            'status', status,
            'session_type', session_type,
            'completed', CASE WHEN status = 'completed' THEN true ELSE false END
        ) ORDER BY scheduled_at DESC
    )
    INTO recent_sessions
    FROM (
        SELECT * FROM sessions
        WHERE client_id = p_client_id
        AND scheduled_at >= NOW() - INTERVAL '7 days'
        ORDER BY scheduled_at DESC
        LIMIT 5
    ) sub;
    
    -- Build complete context
    context := jsonb_build_object(
        'client', COALESCE(client_info, '{}'::jsonb),
        'recent_checkins', COALESCE(recent_checkins, '[]'::jsonb),
        'recent_challenges', COALESCE(recent_challenges, '[]'::jsonb),
        'recent_meals', COALESCE(recent_meals, '[]'::jsonb),
        'recent_sessions', COALESCE(recent_sessions, '[]'::jsonb),
        'timestamp', NOW()
    );
    
    RETURN context;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 2. CHECK CHALLENGE ELIGIBILITY
-- =====================================================
-- Validates if a client can receive a new challenge

CREATE OR REPLACE FUNCTION check_challenge_eligibility(p_client_id UUID)
RETURNS JSONB AS $$
DECLARE
    active_count INTEGER;
    recent_count INTEGER;
    result JSONB;
BEGIN
    -- Count active challenges
    SELECT COUNT(*)
    INTO active_count
    FROM challenges
    WHERE client_id = p_client_id
    AND status = 'active';
    
    -- Count recent challenges (last 7 days)
    SELECT COUNT(*)
    INTO recent_count
    FROM challenges
    WHERE client_id = p_client_id
    AND created_at >= NOW() - INTERVAL '7 days';
    
    -- Build result
    IF active_count > 0 THEN
        result := jsonb_build_object(
            'eligible', false,
            'reason', 'Client already has an active challenge',
            'active_count', active_count
        );
    ELSIF recent_count >= 3 THEN
        result := jsonb_build_object(
            'eligible', false,
            'reason', 'Too many challenges assigned recently (max 3 per week)',
            'recent_count', recent_count
        );
    ELSE
        result := jsonb_build_object(
            'eligible', true,
            'reason', 'Client can receive a new challenge',
            'active_count', active_count,
            'recent_count', recent_count
        );
    END IF;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 3. APPROVE CHALLENGE SUGGESTION
-- =====================================================
-- Converts an AI suggestion to an active challenge

CREATE OR REPLACE FUNCTION approve_challenge_suggestion(
    p_suggestion_id UUID,
    p_coach_id UUID,
    p_modifications JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    suggestion RECORD;
    payload JSONB;
    challenge_id UUID;
    eligibility JSONB;
BEGIN
    -- Get suggestion
    SELECT *
    INTO suggestion
    FROM ai_challenge_suggestions
    WHERE id = p_suggestion_id
    AND coach_id = p_coach_id
    AND status = 'pending';
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Suggestion not found or already processed';
    END IF;
    
    -- Check if expired
    IF suggestion.expires_at < NOW() THEN
        UPDATE ai_challenge_suggestions
        SET status = 'expired'
        WHERE id = p_suggestion_id;
        
        RAISE EXCEPTION 'Suggestion has expired';
    END IF;
    
    -- Check eligibility
    eligibility := check_challenge_eligibility(suggestion.client_id);
    
    IF NOT (eligibility->>'eligible')::boolean THEN
        RAISE EXCEPTION 'Client not eligible: %', eligibility->>'reason';
    END IF;
    
    -- Merge modifications if provided
    IF p_modifications IS NOT NULL THEN
        payload := suggestion.challenge_payload || p_modifications;
    ELSE
        payload := suggestion.challenge_payload;
    END IF;
    
    -- Create challenge from suggestion
    INSERT INTO challenges (
        client_id,
        coach_id,
        name,
        description,
        focus_type,
        duration_days,
        rules,
        start_date,
        status,
        created_by,
        approved_by,
        approved_at,
        trigger_reason,
        ai_metadata
    )
    VALUES (
        suggestion.client_id,
        p_coach_id,
        payload->>'name',
        payload->>'description',
        (payload->>'focus_type')::challenge_focus_type,
        (payload->>'duration_days')::integer,
        ARRAY(SELECT jsonb_array_elements_text(payload->'rules')),
        COALESCE((payload->>'start_date')::date, CURRENT_DATE),
        'active',
        'ai',
        p_coach_id,
        NOW(),
        suggestion.trigger_reason,
        payload
    )
    RETURNING id INTO challenge_id;
    
    -- Mark suggestion as approved
    UPDATE ai_challenge_suggestions
    SET 
        status = 'approved',
        reviewed_at = NOW(),
        reviewed_by = p_coach_id
    WHERE id = p_suggestion_id;
    
    RETURN challenge_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 4. DISMISS CHALLENGE SUGGESTION
-- =====================================================
-- Allows coach to dismiss an AI suggestion

CREATE OR REPLACE FUNCTION dismiss_challenge_suggestion(
    p_suggestion_id UUID,
    p_coach_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE ai_challenge_suggestions
    SET 
        status = 'dismissed',
        reviewed_at = NOW(),
        reviewed_by = p_coach_id
    WHERE id = p_suggestion_id
    AND coach_id = p_coach_id
    AND status = 'pending';
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. GET COACH CHALLENGE SUGGESTIONS
-- =====================================================
-- Returns pending suggestions for coach dashboard

CREATE OR REPLACE FUNCTION get_coach_challenge_suggestions(p_coach_id UUID)
RETURNS TABLE (
    id UUID,
    client_id UUID,
    client_name TEXT,
    challenge_payload JSONB,
    trigger_reason TEXT,
    trigger_data JSONB,
    priority INTEGER,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.client_id,
        p.full_name AS client_name,
        s.challenge_payload,
        s.trigger_reason,
        s.trigger_data,
        s.priority,
        s.expires_at,
        s.created_at
    FROM ai_challenge_suggestions s
    JOIN profiles p ON p.id = s.client_id
    WHERE s.coach_id = p_coach_id
    AND s.status = 'pending'
    AND s.expires_at > NOW()
    ORDER BY s.priority DESC, s.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. CREATE MANUAL CHALLENGE
-- =====================================================
-- Coach creates a challenge manually (not AI-generated)

CREATE OR REPLACE FUNCTION create_manual_challenge(
    p_coach_id UUID,
    p_client_id UUID,
    p_name TEXT,
    p_description TEXT,
    p_focus_type challenge_focus_type,
    p_duration_days INTEGER,
    p_rules TEXT[],
    p_start_date DATE DEFAULT CURRENT_DATE
)
RETURNS UUID AS $$
DECLARE
    challenge_id UUID;
    eligibility JSONB;
    is_coach BOOLEAN;
BEGIN
    -- Verify coach-client relationship
    SELECT EXISTS (
        SELECT 1
        FROM coaches c
        JOIN coach_client_links ccl ON ccl.coach_id = c.id
        WHERE c.user_id = p_coach_id
        AND ccl.client_id = p_client_id
        AND ccl.status = 'active'
    ) INTO is_coach;
    
    IF NOT is_coach THEN
        RAISE EXCEPTION 'Coach-client relationship not found or inactive';
    END IF;
    
    -- Check eligibility
    eligibility := check_challenge_eligibility(p_client_id);
    
    IF NOT (eligibility->>'eligible')::boolean THEN
        RAISE EXCEPTION 'Client not eligible: %', eligibility->>'reason';
    END IF;
    
    -- Validate duration
    IF p_duration_days < 3 OR p_duration_days > 14 THEN
        RAISE EXCEPTION 'Challenge duration must be between 3 and 14 days';
    END IF;
    
    -- Create challenge
    INSERT INTO challenges (
        client_id,
        coach_id,
        name,
        description,
        focus_type,
        duration_days,
        rules,
        start_date,
        status,
        created_by,
        approved_by,
        approved_at
    )
    VALUES (
        p_client_id,
        p_coach_id,
        p_name,
        p_description,
        p_focus_type,
        p_duration_days,
        p_rules,
        p_start_date,
        'active',
        'coach',
        p_coach_id,
        NOW()
    )
    RETURNING id INTO challenge_id;
    
    RETURN challenge_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 7. CANCEL CHALLENGE
-- =====================================================
-- Allows coach or client to cancel an active challenge

CREATE OR REPLACE FUNCTION cancel_challenge(
    p_challenge_id UUID,
    p_user_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    challenge RECORD;
    is_authorized BOOLEAN;
BEGIN
    -- Get challenge
    SELECT *
    INTO challenge
    FROM challenges
    WHERE id = p_challenge_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Challenge not found';
    END IF;
    
    -- Check authorization (coach or client)
    SELECT (
        challenge.coach_id = p_user_id OR
        challenge.client_id = p_user_id
    ) INTO is_authorized;
    
    IF NOT is_authorized THEN
        RAISE EXCEPTION 'Not authorized to cancel this challenge';
    END IF;
    
    -- Cannot cancel completed challenges
    IF challenge.status = 'completed' THEN
        RAISE EXCEPTION 'Cannot cancel a completed challenge';
    END IF;
    
    -- Update challenge
    UPDATE challenges
    SET 
        status = 'cancelled',
        ai_metadata = ai_metadata || 
            jsonb_build_object(
                'cancelled_by', p_user_id,
                'cancelled_at', NOW(),
                'cancellation_reason', p_reason
            )
    WHERE id = p_challenge_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 8. MARK CHALLENGE PROGRESS
-- =====================================================
-- Client marks a day as completed

CREATE OR REPLACE FUNCTION mark_challenge_progress(
    p_challenge_id UUID,
    p_client_id UUID,
    p_date DATE,
    p_completed BOOLEAN,
    p_notes TEXT DEFAULT NULL,
    p_proof_url TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    progress_id UUID;
    challenge RECORD;
BEGIN
    -- Verify challenge belongs to client
    SELECT *
    INTO challenge
    FROM challenges
    WHERE id = p_challenge_id
    AND client_id = p_client_id
    AND status = 'active';
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Challenge not found or not active for this client';
    END IF;
    
    -- Verify date is within challenge range
    IF p_date < challenge.start_date OR p_date > challenge.end_date THEN
        RAISE EXCEPTION 'Date is outside challenge range';
    END IF;
    
    -- Insert or update progress
    INSERT INTO challenge_progress (
        challenge_id,
        date,
        completed,
        notes,
        proof_url
    )
    VALUES (
        p_challenge_id,
        p_date,
        p_completed,
        p_notes,
        p_proof_url
    )
    ON CONFLICT (challenge_id, date)
    DO UPDATE SET
        completed = EXCLUDED.completed,
        notes = EXCLUDED.notes,
        proof_url = EXCLUDED.proof_url
    RETURNING id INTO progress_id;
    
    RETURN progress_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 9. GET CHALLENGE WITH PROGRESS
-- =====================================================
-- Returns challenge details with daily progress

CREATE OR REPLACE FUNCTION get_challenge_with_progress(p_challenge_id UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'challenge', row_to_json(c),
        'progress', (
            SELECT jsonb_agg(row_to_json(cp) ORDER BY cp.date)
            FROM challenge_progress cp
            WHERE cp.challenge_id = c.id
        ),
        'completion_rate', (
            SELECT ROUND(
                (COUNT(*) FILTER (WHERE completed = true)::numeric / 
                NULLIF(c.duration_days, 0)) * 100, 
                2
            )
            FROM challenge_progress cp
            WHERE cp.challenge_id = c.id
        )
    )
    INTO result
    FROM challenges c
    WHERE c.id = p_challenge_id;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 10. DETECT CHALLENGE TRIGGERS
-- =====================================================
-- Background job to detect when clients need challenges
-- This will be called by a scheduled Edge Function

CREATE OR REPLACE FUNCTION detect_challenge_triggers()
RETURNS TABLE (
    client_id UUID,
    coach_id UUID,
    trigger_type TEXT,
    trigger_data JSONB,
    priority INTEGER
) AS $$
BEGIN
    -- Trigger 1: Missed check-ins (high priority)
    RETURN QUERY
    SELECT DISTINCT
        c.user_id AS client_id,
        coach.user_id AS coach_id,
        'missed_checkins' AS trigger_type,
        jsonb_build_object(
            'days_missed', 7 - COUNT(ci.id),
            'last_checkin', MAX(ci.date)
        ) AS trigger_data,
        5 AS priority
    FROM clients c
    JOIN coach_client_links ccl ON ccl.client_id = c.user_id
    JOIN coaches coach ON coach.id = ccl.coach_id
    LEFT JOIN check_ins ci ON ci.client_id = c.user_id 
        AND ci.date >= CURRENT_DATE - INTERVAL '7 days'
    WHERE ccl.status = 'active'
    AND NOT EXISTS (
        SELECT 1 FROM challenges ch
        WHERE ch.client_id = c.user_id
        AND ch.status = 'active'
    )
    GROUP BY c.user_id, coach.user_id
    HAVING COUNT(ci.id) < 3; -- Less than 3 check-ins in last 7 days
    
    -- Trigger 2: Plateau detection (medium priority)
    RETURN QUERY
    SELECT DISTINCT
        c.user_id AS client_id,
        coach.user_id AS coach_id,
        'plateau_detected' AS trigger_type,
        jsonb_build_object(
            'weight_change', 
            ABS(MAX(ci.weight_kg) - MIN(ci.weight_kg))
        ) AS trigger_data,
        3 AS priority
    FROM clients c
    JOIN coach_client_links ccl ON ccl.client_id = c.user_id
    JOIN coaches coach ON coach.id = ccl.coach_id
    JOIN check_ins ci ON ci.client_id = c.user_id
        AND ci.date >= CURRENT_DATE - INTERVAL '14 days'
    WHERE ccl.status = 'active'
    AND NOT EXISTS (
        SELECT 1 FROM challenges ch
        WHERE ch.client_id = c.user_id
        AND ch.status = 'active'
    )
    GROUP BY c.user_id, coach.user_id
    HAVING ABS(MAX(ci.weight_kg) - MIN(ci.weight_kg)) < 0.5; -- Less than 0.5kg change
    
    -- Trigger 3: Low energy trend (medium priority)
    RETURN QUERY
    SELECT DISTINCT
        c.user_id AS client_id,
        coach.user_id AS coach_id,
        'low_energy_trend' AS trigger_type,
        jsonb_build_object(
            'avg_energy', AVG(ci.energy_level)
        ) AS trigger_data,
        4 AS priority
    FROM clients c
    JOIN coach_client_links ccl ON ccl.client_id = c.user_id
    JOIN coaches coach ON coach.id = ccl.coach_id
    JOIN check_ins ci ON ci.client_id = c.user_id
        AND ci.date >= CURRENT_DATE - INTERVAL '7 days'
    WHERE ccl.status = 'active'
    AND NOT EXISTS (
        SELECT 1 FROM challenges ch
        WHERE ch.client_id = c.user_id
        AND ch.status = 'active'
    )
    GROUP BY c.user_id, coach.user_id
    HAVING AVG(ci.energy_level) < 3; -- Average energy below 3/5
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 11. GRANT PERMISSIONS
-- =====================================================

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_client_challenge_context(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_challenge_eligibility(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_challenge_suggestion(UUID, UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION dismiss_challenge_suggestion(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_coach_challenge_suggestions(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION create_manual_challenge(UUID, UUID, TEXT, TEXT, challenge_focus_type, INTEGER, TEXT[], DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_challenge(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_challenge_progress(UUID, UUID, DATE, BOOLEAN, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_challenge_with_progress(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION detect_challenge_triggers() TO authenticated;

-- =====================================================
-- END OF RPC FUNCTIONS
-- =====================================================
