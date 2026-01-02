-- ============================================================================
-- DAILY CHALLENGES RPC FUNCTIONS
-- Version: 2.0 (Daily-Focused)
-- ============================================================================

-- ============================================================================
-- 1. CREATE DAILY CHALLENGE (Manual or from AI approval)
-- ============================================================================

CREATE OR REPLACE FUNCTION create_daily_challenge(
    p_coach_id UUID,
    p_client_id UUID,
    p_assigned_date DATE,
    p_name TEXT,
    p_description TEXT,
    p_focus_type challenge_focus_type,
    p_intensity challenge_intensity,
    p_rules TEXT[],
    p_created_by challenge_creator DEFAULT 'coach',
    p_trigger_reason TEXT DEFAULT NULL,
    p_ai_reasoning TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_challenge_id UUID;
BEGIN
    -- Verify coach-client relationship
    IF NOT EXISTS (
        SELECT 1 FROM coach_client_links
        WHERE coach_id = p_coach_id
        AND client_id = p_client_id
        AND status = 'active'
    ) THEN
        RAISE EXCEPTION 'Coach-client relationship not found or inactive';
    END IF;

    -- Create challenge
    INSERT INTO daily_challenges (
        coach_id,
        client_id,
        assigned_date,
        name,
        description,
        focus_type,
        intensity,
        rules,
        created_by,
        trigger_reason,
        ai_reasoning
    ) VALUES (
        p_coach_id,
        p_client_id,
        p_assigned_date,
        p_name,
        p_description,
        p_focus_type,
        p_intensity,
        p_rules,
        p_created_by,
        p_trigger_reason,
        p_ai_reasoning
    )
    RETURNING id INTO v_challenge_id;

    RETURN v_challenge_id;
END;
$$;

-- ============================================================================
-- 2. GET CLIENT'S CHALLENGES FOR A SPECIFIC DAY
-- ============================================================================

CREATE OR REPLACE FUNCTION get_daily_challenges_for_date(
    p_client_id UUID,
    p_date DATE
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    description TEXT,
    focus_type challenge_focus_type,
    intensity challenge_intensity,
    rules TEXT[],
    status challenge_status,
    completed BOOLEAN,
    completed_at TIMESTAMPTZ,
    notes TEXT,
    proof_image_url TEXT,
    created_by challenge_creator,
    ai_reasoning TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        dc.id,
        dc.name,
        dc.description,
        dc.focus_type,
        dc.intensity,
        dc.rules,
        dc.status,
        dc.completed,
        dc.completed_at,
        dc.notes,
        dc.proof_image_url,
        dc.created_by,
        dc.ai_reasoning,
        dc.created_at
    FROM daily_challenges dc
    WHERE dc.client_id = p_client_id
    AND dc.assigned_date = p_date
    AND dc.status = 'active'
    ORDER BY dc.created_at ASC;
END;
$$;

-- ============================================================================
-- 3. GET COACH'S VIEW OF CLIENT CHALLENGES (Date Range)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_coach_client_challenges(
    p_coach_id UUID,
    p_client_id UUID DEFAULT NULL,
    p_start_date DATE DEFAULT CURRENT_DATE,
    p_end_date DATE DEFAULT CURRENT_DATE + 7
)
RETURNS TABLE (
    id UUID,
    client_id UUID,
    client_name TEXT,
    assigned_date DATE,
    name TEXT,
    description TEXT,
    focus_type challenge_focus_type,
    intensity challenge_intensity,
    rules TEXT[],
    status challenge_status,
    completed BOOLEAN,
    created_by challenge_creator
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        dc.id,
        dc.client_id,
        COALESCE(p.full_name, 'Client') as client_name,
        dc.assigned_date,
        dc.name,
        dc.description,
        dc.focus_type,
        dc.intensity,
        dc.rules,
        dc.status,
        dc.completed,
        dc.created_by
    FROM daily_challenges dc
    JOIN clients c ON dc.client_id = c.id
    LEFT JOIN profiles p ON c.user_id = p.id
    WHERE dc.coach_id = p_coach_id
    AND (p_client_id IS NULL OR dc.client_id = p_client_id)
    AND dc.assigned_date BETWEEN p_start_date AND p_end_date
    ORDER BY dc.assigned_date ASC, dc.created_at ASC;
END;
$$;

-- ============================================================================
-- 4. MARK CHALLENGE COMPLETE/INCOMPLETE
-- ============================================================================

CREATE OR REPLACE FUNCTION mark_daily_challenge(
    p_challenge_id UUID,
    p_client_id UUID,
    p_completed BOOLEAN,
    p_notes TEXT DEFAULT NULL,
    p_proof_url TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Verify ownership
    IF NOT EXISTS (
        SELECT 1 FROM daily_challenges
        WHERE id = p_challenge_id
        AND client_id = p_client_id
    ) THEN
        RAISE EXCEPTION 'Challenge not found or access denied';
    END IF;

    -- Update challenge
    UPDATE daily_challenges
    SET
        completed = p_completed,
        completed_at = CASE WHEN p_completed THEN NOW() ELSE NULL END,
        notes = COALESCE(p_notes, notes),
        proof_image_url = COALESCE(p_proof_url, proof_image_url),
        updated_at = NOW()
    WHERE id = p_challenge_id;

    RETURN TRUE;
END;
$$;

-- ============================================================================
-- 5. CANCEL/DELETE DAILY CHALLENGE
-- ============================================================================

CREATE OR REPLACE FUNCTION cancel_daily_challenge(
    p_challenge_id UUID,
    p_coach_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Verify ownership
    IF NOT EXISTS (
        SELECT 1 FROM daily_challenges
        WHERE id = p_challenge_id
        AND coach_id = p_coach_id
    ) THEN
        RAISE EXCEPTION 'Challenge not found or access denied';
    END IF;

    UPDATE daily_challenges
    SET status = 'cancelled', updated_at = NOW()
    WHERE id = p_challenge_id;

    RETURN TRUE;
END;
$$;

-- ============================================================================
-- 6. GET DAILY CHALLENGE SUGGESTIONS FOR COACH
-- ============================================================================

CREATE OR REPLACE FUNCTION get_daily_challenge_suggestions(
    p_coach_id UUID,
    p_status TEXT DEFAULT 'pending'
)
RETURNS TABLE (
    id UUID,
    client_id UUID,
    client_name TEXT,
    suggested_date DATE,
    challenge_data JSONB,
    trigger_reason TEXT,
    ai_reasoning TEXT,
    priority INTEGER,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        dcs.id,
        dcs.client_id,
        COALESCE(p.full_name, 'Client') as client_name,
        dcs.suggested_date,
        dcs.challenge_data,
        dcs.trigger_reason,
        dcs.ai_reasoning,
        dcs.priority,
        dcs.expires_at,
        dcs.created_at
    FROM daily_challenge_suggestions dcs
    JOIN clients c ON dcs.client_id = c.id
    LEFT JOIN profiles p ON c.user_id = p.id
    WHERE dcs.coach_id = p_coach_id
    AND dcs.status = p_status
    AND dcs.expires_at > NOW()
    ORDER BY dcs.priority DESC, dcs.created_at DESC;
END;
$$;

-- ============================================================================
-- 7. APPROVE DAILY CHALLENGE SUGGESTION
-- ============================================================================

CREATE OR REPLACE FUNCTION approve_daily_suggestion(
    p_suggestion_id UUID,
    p_coach_id UUID,
    p_modifications JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_suggestion RECORD;
    v_challenge_id UUID;
    v_final_data JSONB;
BEGIN
    -- Get suggestion
    SELECT * INTO v_suggestion
    FROM daily_challenge_suggestions
    WHERE id = p_suggestion_id
    AND coach_id = p_coach_id
    AND status = 'pending';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Suggestion not found or already processed';
    END IF;

    -- Merge modifications with original data
    v_final_data := v_suggestion.challenge_data;
    IF p_modifications IS NOT NULL THEN
        v_final_data := v_final_data || p_modifications;
    END IF;

    -- Create challenge
    INSERT INTO daily_challenges (
        coach_id,
        client_id,
        assigned_date,
        name,
        description,
        focus_type,
        intensity,
        rules,
        created_by,
        trigger_reason,
        ai_reasoning
    ) VALUES (
        p_coach_id,
        v_suggestion.client_id,
        v_suggestion.suggested_date,
        v_final_data->>'name',
        v_final_data->>'description',
        (v_final_data->>'focus_type')::challenge_focus_type,
        COALESCE((v_final_data->>'intensity')::challenge_intensity, 'medium'),
        ARRAY(SELECT jsonb_array_elements_text(v_final_data->'rules')),
        'ai',
        v_suggestion.trigger_reason,
        v_suggestion.ai_reasoning
    )
    RETURNING id INTO v_challenge_id;

    -- Mark suggestion as approved
    UPDATE daily_challenge_suggestions
    SET
        status = 'approved',
        approved_by = p_coach_id,
        approved_at = NOW(),
        modifications = p_modifications
    WHERE id = p_suggestion_id;

    RETURN v_challenge_id;
END;
$$;

-- ============================================================================
-- 8. DISMISS DAILY CHALLENGE SUGGESTION
-- ============================================================================

CREATE OR REPLACE FUNCTION dismiss_daily_suggestion(
    p_suggestion_id UUID,
    p_coach_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE daily_challenge_suggestions
    SET status = 'dismissed'
    WHERE id = p_suggestion_id
    AND coach_id = p_coach_id;

    RETURN FOUND;
END;
$$;

-- ============================================================================
-- 9. BATCH CREATE CHALLENGES (For week generation)
-- ============================================================================

CREATE OR REPLACE FUNCTION create_daily_challenges_batch(
    p_coach_id UUID,
    p_client_id UUID,
    p_challenges JSONB  -- Array of challenge objects
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_challenge JSONB;
    v_challenge_id UUID;
    v_created_ids UUID[] := '{}';
BEGIN
    -- Verify coach-client relationship
    IF NOT EXISTS (
        SELECT 1 FROM coach_client_links
        WHERE coach_id = p_coach_id
        AND client_id = p_client_id
        AND status = 'active'
    ) THEN
        RAISE EXCEPTION 'Coach-client relationship not found or inactive';
    END IF;

    -- Loop through challenges
    FOR v_challenge IN SELECT * FROM jsonb_array_elements(p_challenges)
    LOOP
        INSERT INTO daily_challenges (
            coach_id,
            client_id,
            assigned_date,
            name,
            description,
            focus_type,
            intensity,
            rules,
            created_by,
            ai_reasoning
        ) VALUES (
            p_coach_id,
            p_client_id,
            (v_challenge->>'assigned_date')::DATE,
            v_challenge->>'name',
            v_challenge->>'description',
            (v_challenge->>'focus_type')::challenge_focus_type,
            COALESCE((v_challenge->>'intensity')::challenge_intensity, 'medium'),
            ARRAY(SELECT jsonb_array_elements_text(v_challenge->'rules')),
            COALESCE((v_challenge->>'created_by')::challenge_creator, 'coach'),
            v_challenge->>'ai_reasoning'
        )
        RETURNING id INTO v_challenge_id;

        v_created_ids := array_append(v_created_ids, v_challenge_id);
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'created_count', array_length(v_created_ids, 1),
        'challenge_ids', to_jsonb(v_created_ids)
    );
END;
$$;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION create_daily_challenge TO authenticated;
GRANT EXECUTE ON FUNCTION get_daily_challenges_for_date TO authenticated;
GRANT EXECUTE ON FUNCTION get_coach_client_challenges TO authenticated;
GRANT EXECUTE ON FUNCTION mark_daily_challenge TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_daily_challenge TO authenticated;
GRANT EXECUTE ON FUNCTION get_daily_challenge_suggestions TO authenticated;
GRANT EXECUTE ON FUNCTION approve_daily_suggestion TO authenticated;
GRANT EXECUTE ON FUNCTION dismiss_daily_suggestion TO authenticated;
GRANT EXECUTE ON FUNCTION create_daily_challenges_batch TO authenticated;
