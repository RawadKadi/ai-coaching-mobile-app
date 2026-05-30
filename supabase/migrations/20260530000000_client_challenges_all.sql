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
    completion_rate INTEGER,
    mode challenge_mode
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Update statuses before fetching to ensure freshness
    PERFORM update_challenge_statuses(p_client_id);

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
               NULLIF(COUNT(sc.id), 0) * 100))::INTEGER as completion_rate,
        mc.mode
    FROM mother_challenges mc
    LEFT JOIN sub_challenges sc ON mc.id = sc.mother_challenge_id
    WHERE mc.client_id = p_client_id
    AND (p_status = 'all' OR mc.status::TEXT = p_status)
    GROUP BY mc.id
    ORDER BY mc.start_date DESC;
END;
$$;
