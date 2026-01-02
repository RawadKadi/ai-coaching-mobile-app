-- ============================================================================
-- CHALLENGES V3 - RPC FUNCTIONS
-- Mother + Sub-Challenges Architecture
-- ============================================================================

-- ============================================================================
-- 1. CREATE MOTHER CHALLENGE WITH SUB-CHALLENGES
-- ============================================================================

CREATE OR REPLACE FUNCTION create_mother_challenge(
    p_coach_id UUID,
    p_client_id UUID,
    p_name TEXT,
    p_description TEXT,
    p_start_date DATE,
    p_end_date DATE,
    p_sub_challenges JSONB,  -- [{assigned_date, name, description, focus_type, intensity}...]
    p_created_by challenge_creator DEFAULT 'coach',
    p_trigger_reason TEXT DEFAULT NULL,
    p_ai_reasoning TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_mother_id UUID;
    v_sub JSONB;
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

    -- Create mother challenge
    INSERT INTO mother_challenges (
        coach_id,
        client_id,
        name,
        description,
        start_date,
        end_date,
        created_by,
        trigger_reason,
        ai_reasoning
    ) VALUES (
        p_coach_id,
        p_client_id,
        p_name,
        p_description,
        p_start_date,
        p_end_date,
        p_created_by,
        p_trigger_reason,
        p_ai_reasoning
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
-- 2. GET CLIENT'S ACTIVE MOTHER CHALLENGES
-- ============================================================================

CREATE OR REPLACE FUNCTION get_client_mother_challenges(
    p_client_id UUID,
    p_status TEXT DEFAULT 'active'
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    description TEXT,
    start_date DATE,
    end_date DATE,
    duration_days INTEGER,
    status challenge_status,
    created_by challenge_creator,
    total_subs BIGINT,
    completed_subs BIGINT,
    completion_rate INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        mc.id,
        mc.name,
        mc.description,
        mc.start_date,
        mc.end_date,
        mc.duration_days,
        mc.status,
        mc.created_by,
        COUNT(sc.id) as total_subs,
        COUNT(sc.id) FILTER (WHERE sc.completed = true) as completed_subs,
        ROUND((COUNT(sc.id) FILTER (WHERE sc.completed = true)::NUMERIC / 
               NULLIF(COUNT(sc.id), 0) * 100))::INTEGER as completion_rate
    FROM mother_challenges mc
    LEFT JOIN sub_challenges sc ON mc.id = sc.mother_challenge_id
    WHERE mc.client_id = p_client_id
    AND mc.status::TEXT = p_status
    GROUP BY mc.id
    ORDER BY mc.start_date DESC;
END;
$$;

-- ============================================================================
-- 3. GET TODAY'S SUB-CHALLENGES FOR CLIENT
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
    AND mc.status = 'active'
    ORDER BY sc.created_at ASC;
END;
$$;

-- ============================================================================
-- 4. MARK SUB-CHALLENGE COMPLETE/INCOMPLETE
-- ============================================================================

CREATE OR REPLACE FUNCTION mark_sub_challenge(
    p_sub_challenge_id UUID,
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
    -- Verify ownership via mother challenge
    IF NOT EXISTS (
        SELECT 1 FROM sub_challenges sc
        JOIN mother_challenges mc ON sc.mother_challenge_id = mc.id
        WHERE sc.id = p_sub_challenge_id
        AND mc.client_id = p_client_id
    ) THEN
        RAISE EXCEPTION 'Sub-challenge not found or access denied';
    END IF;

    -- Update sub-challenge
    UPDATE sub_challenges
    SET
        completed = p_completed,
        completed_at = CASE WHEN p_completed THEN NOW() ELSE NULL END,
        notes = COALESCE(p_notes, notes),
        proof_image_url = COALESCE(p_proof_url, proof_image_url),
        updated_at = NOW()
    WHERE id = p_sub_challenge_id;

    RETURN TRUE;
END;
$$;

-- ============================================================================
-- 5. GET MOTHER CHALLENGE WITH SUB-CHALLENGES
-- ============================================================================

CREATE OR REPLACE FUNCTION get_mother_challenge_details(
    p_mother_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
    v_mother RECORD;
    v_subs JSONB;
BEGIN
    -- Get mother challenge
    SELECT * INTO v_mother
    FROM mother_challenges
    WHERE id = p_mother_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Mother challenge not found';
    END IF;

    -- Get all sub-challenges grouped by date
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', id,
            'assigned_date', assigned_date,
            'name', name,
            'description', description,
            'focus_type', focus_type,
            'intensity', intensity,
            'completed', completed,
            'completed_at', completed_at,
            'notes', notes
        ) ORDER BY assigned_date, created_at
    )
    INTO v_subs
    FROM sub_challenges
    WHERE mother_challenge_id = p_mother_id;

    -- Build result
    v_result := jsonb_build_object(
        'mother', row_to_json(v_mother),
        'sub_challenges', COALESCE(v_subs, '[]'::jsonb)
    );

    RETURN v_result;
END;
$$;

-- ============================================================================
-- 6. CANCEL MOTHER CHALLENGE
-- ============================================================================

CREATE OR REPLACE FUNCTION cancel_mother_challenge(
    p_mother_id UUID,
    p_coach_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Verify ownership
    IF NOT EXISTS (
        SELECT 1 FROM mother_challenges
        WHERE id = p_mother_id
        AND coach_id = p_coach_id
    ) THEN
        RAISE EXCEPTION 'Challenge not found or access denied';
    END IF;

    UPDATE mother_challenges
    SET status = 'cancelled', updated_at = NOW()
    WHERE id = p_mother_id;

    RETURN TRUE;
END;
$$;

-- ============================================================================
-- 7. GET COACH'S MOTHER CHALLENGES
-- ============================================================================

CREATE OR REPLACE FUNCTION get_coach_mother_challenges(
    p_coach_id UUID,
    p_client_id UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    client_id UUID,
    client_name TEXT,
    name TEXT,
    description TEXT,
    start_date DATE,
    end_date DATE,
    duration_days INTEGER,
    status challenge_status,
    created_by challenge_creator,
    total_subs BIGINT,
    completed_subs BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        mc.id,
        mc.client_id,
        COALESCE(p.full_name, 'Client') as client_name,
        mc.name,
        mc.description,
        mc.start_date,
        mc.end_date,
        mc.duration_days,
        mc.status,
        mc.created_by,
        COUNT(sc.id) as total_subs,
        COUNT(sc.id) FILTER (WHERE sc.completed = true) as completed_subs
    FROM mother_challenges mc
    JOIN clients c ON mc.client_id = c.id
    LEFT JOIN profiles p ON c.user_id = p.id
    LEFT JOIN sub_challenges sc ON mc.id = sc.mother_challenge_id
    WHERE mc.coach_id = p_coach_id
    AND (p_client_id IS NULL OR mc.client_id = p_client_id)
    GROUP BY mc.id, mc.client_id, p.full_name
    ORDER BY mc.start_date DESC;
END;
$$;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION create_mother_challenge TO authenticated;
GRANT EXECUTE ON FUNCTION get_client_mother_challenges TO authenticated;
GRANT EXECUTE ON FUNCTION get_todays_sub_challenges TO authenticated;
GRANT EXECUTE ON FUNCTION mark_sub_challenge TO authenticated;
GRANT EXECUTE ON FUNCTION get_mother_challenge_details TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_mother_challenge TO authenticated;
GRANT EXECUTE ON FUNCTION get_coach_mother_challenges TO authenticated;
