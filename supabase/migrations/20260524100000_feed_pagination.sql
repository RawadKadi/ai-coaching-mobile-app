-- Drop existing function to recreate it with parameters
DROP FUNCTION IF EXISTS public.get_recent_checkins();

-- Function to get recent check-ins for all clients assigned to the requesting coach
CREATE OR REPLACE FUNCTION public.get_recent_checkins(
    p_cursor timestamptz DEFAULT NULL,
    p_limit integer DEFAULT 15
)
RETURNS TABLE (
    checkin_id uuid,
    client_id uuid,
    client_name text,
    client_avatar text,
    created_at timestamptz,
    weight_kg numeric,
    energy_level integer,
    mood text
) 
LANGUAGE plpgsql
SECURITY DEFINER -- Runs as the definer to allow complex joins across RLS boundaries
SET search_path = public
AS $$
DECLARE
    v_coach_id uuid;
BEGIN
    -- Get the coach's UUID based on the authenticated user
    SELECT id INTO v_coach_id
    FROM public.coaches
    WHERE user_id = auth.uid();

    IF v_coach_id IS NULL THEN
        RETURN; -- If the user is not a coach, return nothing
    END IF;

    -- Return the check-ins from clients linked to this coach
    -- DISTINCT ON ensures we only get the absolute latest check-in per client
    RETURN QUERY
    WITH latest_checkins AS (
        SELECT DISTINCT ON (ci.client_id)
            ci.id AS checkin_id,
            c.id AS client_id,
            p.full_name AS client_name,
            p.avatar_url AS client_avatar,
            ci.created_at,
            ci.weight_kg,
            ci.energy_level,
            ci.mood
        FROM public.check_ins ci
        JOIN public.clients c ON c.id = ci.client_id
        JOIN public.profiles p ON p.id = c.user_id
        JOIN public.coach_client_links ccl ON ccl.client_id = c.id
        WHERE ccl.coach_id = v_coach_id AND ccl.status = 'active'
        ORDER BY ci.client_id, ci.created_at DESC
    )
    SELECT 
        l.checkin_id,
        l.client_id,
        l.client_name,
        l.client_avatar,
        l.created_at,
        l.weight_kg,
        l.energy_level,
        l.mood
    FROM latest_checkins l
    WHERE p_cursor IS NULL OR l.created_at < p_cursor
    ORDER BY l.created_at DESC
    LIMIT p_limit;
END;
$$;
