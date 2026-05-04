-- Update get_coach_stats to include active challenges and today's sessions
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
    v_active_challenges integer := 0;
    v_todays_sessions integer := 0;
BEGIN
    -- Get the coach's UUID based on the authenticated user
    SELECT id INTO v_coach_id
    FROM public.coaches
    WHERE user_id = auth.uid();

    IF v_coach_id IS NULL THEN
        RETURN jsonb_build_object(
            'totalClients', 0,
            'activeClients', 0,
            'pendingCheckIns', 0,
            'activeChallenges', 0,
            'todaysSessions', 0
        );
    END IF;

    -- 1. Get total roster
    SELECT count(*) INTO v_total_roster
    FROM public.coach_client_links ccl
    JOIN public.clients c ON c.id = ccl.client_id
    JOIN public.profiles p ON p.id = c.user_id
    WHERE ccl.coach_id = v_coach_id;

    -- 2. Get active now
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
    WHERE ccl.coach_id = v_coach_id 
      AND ccl.status = 'active' 
      AND ci.date = CURRENT_DATE;

    -- 4. Get active challenges count
    SELECT count(*) INTO v_active_challenges
    FROM public.challenges
    WHERE coach_id = auth.uid() AND status = 'active';

    -- 5. Get today's scheduled sessions count
    SELECT count(*) INTO v_todays_sessions
    FROM public.sessions
    WHERE coach_id = v_coach_id 
      AND status = 'scheduled' 
      AND scheduled_at::date = CURRENT_DATE;

    -- Return the stats as a single object
    RETURN jsonb_build_object(
        'totalClients', COALESCE(v_total_roster, 0),
        'activeClients', COALESCE(v_active_now, 0),
        'pendingCheckIns', GREATEST(v_active_now - v_checked_in_today, 0),
        'activeChallenges', COALESCE(v_active_challenges, 0),
        'todaysSessions', COALESCE(v_todays_sessions, 0)
    );
END;
$$;
