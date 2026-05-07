-- Update get_coach_stats to include compliance count
CREATE OR REPLACE FUNCTION public.get_coach_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_coach_id uuid;
    v_total_roster integer := 0;
    v_active_clients integer := 0;
    v_compliant_today integer := 0;
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
            'compliantToday', 0,
            'activeChallenges', 0,
            'todaysSessions', 0
        );
    END IF;

    -- 1. Get total roster (all clients)
    SELECT count(*) INTO v_total_roster
    FROM public.coach_client_links ccl
    WHERE ccl.coach_id = v_coach_id;

    -- 2. Get active clients (status = 'active')
    SELECT count(*) INTO v_active_clients
    FROM public.coach_client_links ccl
    WHERE ccl.coach_id = v_coach_id AND ccl.status = 'active';

    -- 3. Get compliant clients today
    WITH client_tasks AS (
        SELECT 
            ccl.client_id,
            (
                SELECT COUNT(*) FROM habits h 
                WHERE h.client_id = ccl.client_id AND h.is_active = true AND h.created_at::date <= CURRENT_DATE
            ) + (
                SELECT COUNT(*) FROM sub_challenges sc 
                JOIN mother_challenges mc ON sc.mother_challenge_id = mc.id
                WHERE mc.client_id = ccl.client_id AND sc.assigned_date = CURRENT_DATE
            ) as total_tasks,
            (
                SELECT COUNT(*) FROM habit_logs hl
                WHERE hl.client_id = ccl.client_id AND hl.date = CURRENT_DATE AND hl.completed = true
            ) + (
                SELECT COUNT(*) FROM sub_challenges sc 
                JOIN mother_challenges mc ON sc.mother_challenge_id = mc.id
                WHERE mc.client_id = ccl.client_id AND sc.assigned_date = CURRENT_DATE AND sc.completed = true
            ) as completed_tasks
        FROM public.coach_client_links ccl
        WHERE ccl.coach_id = v_coach_id AND ccl.status = 'active'
    )
    SELECT COUNT(*) INTO v_compliant_today
    FROM client_tasks
    WHERE total_tasks > 0 AND completed_tasks >= total_tasks;

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

    -- Return the stats
    RETURN jsonb_build_object(
        'totalClients', v_total_roster,
        'activeClients', v_active_clients,
        'compliantToday', v_compliant_today,
        'activeChallenges', v_active_challenges,
        'todaysSessions', v_todays_sessions
    );
END;
$$;
