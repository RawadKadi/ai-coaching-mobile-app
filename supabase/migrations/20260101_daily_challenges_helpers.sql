-- ============================================================================
-- DAILY CHALLENGES V2 - FIXED FOR ACTUAL SCHEMA
-- ============================================================================

DROP FUNCTION IF EXISTS get_client_daily_challenge_context(UUID);

CREATE OR REPLACE FUNCTION get_client_daily_challenge_context(
    p_client_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_context JSONB;
    v_client RECORD;
    v_recent_challenges JSONB;
    v_completion_stats JSONB;
BEGIN
    -- Get client basic info - matching actual schema
    SELECT
        c.id,
        c.goal,
        c.experience_level,
        c.dietary_restrictions,  -- This is JSONB
        c.medical_conditions     -- This is JSONB
    INTO v_client
    FROM clients c
    WHERE c.id = p_client_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Client not found';
    END IF;

    -- Get recent challenges (last 14 days)
    BEGIN
        SELECT jsonb_agg(
            jsonb_build_object(
                'date', assigned_date,
                'name', name,
                'focus_type', focus_type,
                'completed', completed,
                'intensity', intensity
            ) ORDER BY assigned_date DESC
        )
        INTO v_recent_challenges
        FROM daily_challenges
        WHERE client_id = p_client_id
        AND assigned_date >= CURRENT_DATE - 14
        LIMIT 20;
    EXCEPTION WHEN OTHERS THEN
        v_recent_challenges := '[]'::jsonb;
    END;

    -- Get completion stats (last 7 days)
    BEGIN
        SELECT jsonb_build_object(
            'total_challenges', COUNT(*),
            'completed', COUNT(*) FILTER (WHERE completed = true),
            'completion_rate', ROUND(
                (COUNT(*) FILTER (WHERE completed = true)::NUMERIC / 
                NULLIF(COUNT(*), 0) * 100), 0
            )
        )
        INTO v_completion_stats
        FROM daily_challenges
        WHERE client_id = p_client_id
        AND assigned_date >= CURRENT_DATE - 7;
    EXCEPTION WHEN OTHERS THEN
        v_completion_stats := '{}'::jsonb;
    END;

    -- Build context with correct types
    v_context := jsonb_build_object(
        'client', jsonb_build_object(
            'id', v_client.id,
            'goal', COALESCE(v_client.goal, 'General wellness'),
            'experience_level', COALESCE(v_client.experience_level, 'intermediate'),
            'dietary_restrictions', COALESCE(v_client.dietary_restrictions, '[]'::jsonb),
            'medical_conditions', COALESCE(v_client.medical_conditions, '[]'::jsonb)
        ),
        'recent_challenges', COALESCE(v_recent_challenges, '[]'::jsonb),
        'completion_stats', COALESCE(v_completion_stats, jsonb_build_object(
            'total_challenges', 0,
            'completed', 0,
            'completion_rate', 0
        ))
    );

    RETURN v_context;
END;
$$;

GRANT EXECUTE ON FUNCTION get_client_daily_challenge_context TO authenticated;

-- ============================================================================
-- HELPER: Count challenges for a date
-- ============================================================================

CREATE OR REPLACE FUNCTION count_challenges_for_date(
    p_client_id UUID,
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO v_count
    FROM daily_challenges
    WHERE client_id = p_client_id
    AND assigned_date = p_date
    AND status = 'active';

    RETURN COALESCE(v_count, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION count_challenges_for_date TO authenticated;
