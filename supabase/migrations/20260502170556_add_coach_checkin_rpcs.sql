-- Drop existing functions if they exist (to allow recreating)
DROP FUNCTION IF EXISTS public.get_recent_checkins();
DROP FUNCTION IF EXISTS public.get_coach_stats();

-- Function to get recent check-ins for all clients assigned to the requesting coach
CREATE OR REPLACE FUNCTION public.get_recent_checkins()
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
    RETURN QUERY
    SELECT 
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
    ORDER BY ci.created_at DESC
    LIMIT 20;
END;
$$;

-- Function to get stats for the dashboard
CREATE OR REPLACE FUNCTION public.get_coach_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_coach_id uuid;
    v_total_roster integer := 0;
    v_active_now integer := 0;
    v_checked_in_today integer := 0;
BEGIN
    -- Get the coach's UUID based on the authenticated user
    SELECT id INTO v_coach_id
    FROM public.coaches
    WHERE user_id = auth.uid();

    IF v_coach_id IS NULL THEN
        RETURN jsonb_build_object(
            'totalClients', 0,
            'activeClients', 0,
            'pendingCheckIns', 0
        );
    END IF;

    -- 1. Get total roster (Only count clients who actually have profiles)
    -- This matches the logic in get_my_clients() to avoid discrepancies
    SELECT count(*) INTO v_total_roster
    FROM public.coach_client_links ccl
    JOIN public.clients c ON c.id = ccl.client_id
    JOIN public.profiles p ON p.id = c.user_id
    WHERE ccl.coach_id = v_coach_id;

    -- 2. Get active now (Must have 'active' status AND a valid profile)
    SELECT count(*) INTO v_active_now
    FROM public.coach_client_links ccl
    JOIN public.clients c ON c.id = ccl.client_id
    JOIN public.profiles p ON p.id = c.user_id
    WHERE ccl.coach_id = v_coach_id AND ccl.status = 'active';

    -- 3. Get how many active clients have checked in today
    SELECT count(DISTINCT ccl.client_id)
    INTO v_checked_in_today
    FROM public.coach_client_links ccl
    JOIN public.check_ins ci ON ci.client_id = ccl.client_id
    JOIN public.profiles p ON p.id = (SELECT user_id FROM public.clients WHERE id = ccl.client_id)
    WHERE ccl.coach_id = v_coach_id 
      AND ccl.status = 'active' 
      AND ci.date = CURRENT_DATE;

    -- Return the stats as a single object
    RETURN jsonb_build_object(
        'totalClients', COALESCE(v_total_roster, 0),
        'activeClients', COALESCE(v_active_now, 0),
        'pendingCheckIns', GREATEST(v_active_now - v_checked_in_today, 0)
    );
END;
$$;