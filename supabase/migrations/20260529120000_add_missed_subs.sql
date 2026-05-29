-- Add missed_subs to get_coach_mother_challenges

DROP FUNCTION IF EXISTS get_coach_mother_challenges(UUID, UUID);

CREATE OR REPLACE FUNCTION get_coach_mother_challenges(
    p_coach_id UUID,
    p_client_id UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    client_id UUID,
    client_name TEXT,
    client_avatar TEXT,
    name TEXT,
    description TEXT,
    start_date DATE,
    end_date DATE,
    duration_days INTEGER,
    status challenge_status,
    created_by challenge_creator,
    total_subs BIGINT,
    completed_subs BIGINT,
    missed_subs BIGINT
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
        p.avatar_url as client_avatar,
        mc.name,
        mc.description,
        mc.start_date,
        mc.end_date,
        mc.duration_days,
        mc.status,
        mc.created_by,
        COUNT(sc.id) as total_subs,
        COUNT(sc.id) FILTER (WHERE sc.completed = true) as completed_subs,
        COUNT(sc.id) FILTER (WHERE sc.completed = false AND sc.assigned_date < CURRENT_DATE) as missed_subs
    FROM mother_challenges mc
    JOIN clients c ON mc.client_id = c.id
    LEFT JOIN profiles p ON c.user_id = p.id
    LEFT JOIN sub_challenges sc ON mc.id = sc.mother_challenge_id
    WHERE mc.coach_id = p_coach_id
    AND (p_client_id IS NULL OR mc.client_id = p_client_id)
    GROUP BY mc.id, mc.client_id, p.full_name, p.avatar_url
    ORDER BY mc.start_date DESC;
END;
$$;
