-- ===================================================================
-- DATABASE MIGRATION: REDEFINE ACTIVE/PENDING CLIENTS BASED ON STREAKS
-- ===================================================================

-- 1. Redefine get_coach_stats() to calculate Active Clients and Pending Check-Ins based on Current Win Streaks
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
    v_pending_checkins integer := 0;
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
            'todaysSessions', 0,
            'pendingCheckIns', 0
        );
    END IF;

    -- 1. Get total roster (all clients linked to this coach, only count those with valid profiles)
    SELECT count(*) INTO v_total_roster
    FROM public.coach_client_links ccl
    JOIN public.clients c ON c.id = ccl.client_id
    JOIN public.profiles p ON p.id = c.user_id
    WHERE ccl.coach_id = v_coach_id;

    -- 2. Get active clients based on Current Win Streaks (streak >= 1)
    SELECT count(*) INTO v_active_clients
    FROM public.coach_client_links ccl
    JOIN public.clients c ON c.id = ccl.client_id
    JOIN public.profiles p ON p.id = c.user_id
    WHERE ccl.coach_id = v_coach_id
      AND public.get_client_streak(c.id, COALESCE(p.timezone, 'UTC')) >= 1;

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
        WHERE ccl.coach_id = v_coach_id
    )
    SELECT COUNT(*) INTO v_compliant_today
    FROM client_tasks
    WHERE total_tasks > 0 AND completed_tasks >= total_tasks;

    -- 4. Get active challenges count from mother_challenges
    SELECT count(*) INTO v_active_challenges
    FROM public.mother_challenges
    WHERE coach_id = v_coach_id AND status = 'active';

    -- 5. Get today's scheduled sessions count
    SELECT count(*) INTO v_todays_sessions
    FROM public.sessions
    WHERE coach_id = v_coach_id 
      AND status = 'scheduled' 
      AND scheduled_at::date = CURRENT_DATE;

    -- 6. Get pending check-ins count based on Current Win Streaks (streak = 0)
    SELECT count(*) INTO v_pending_checkins
    FROM public.coach_client_links ccl
    JOIN public.clients c ON c.id = ccl.client_id
    JOIN public.profiles p ON p.id = c.user_id
    WHERE ccl.coach_id = v_coach_id
      AND public.get_client_streak(c.id, COALESCE(p.timezone, 'UTC')) = 0;

    -- Return the stats
    RETURN jsonb_build_object(
        'totalClients', v_total_roster,
        'activeClients', v_active_clients,
        'compliantToday', v_compliant_today,
        'activeChallenges', v_active_challenges,
        'todaysSessions', v_todays_sessions,
        'pendingCheckIns', v_pending_checkins
    );
END;
$$;


-- 2. Redefine get_my_clients() to compute client status based on Current Win Streaks
CREATE OR REPLACE FUNCTION public.get_my_clients()
RETURNS TABLE (
  link_id uuid,
  status text,
  client_id uuid,
  client_user_id uuid,
  client_goal text,
  client_experience text,
  client_name text,
  client_avatar text
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ccl.id as link_id,
    CASE 
      WHEN public.get_client_streak(c.id, COALESCE(p.timezone, 'UTC')) >= 1 THEN 'active'
      ELSE 'pending'
    END::text as status,
    c.id as client_id,
    c.user_id as client_user_id,
    c.goal as client_goal,
    c.experience_level as client_experience,
    p.full_name as client_name,
    p.avatar_url as client_avatar
  FROM coach_client_links ccl
  JOIN coaches co ON co.id = ccl.coach_id
  JOIN clients c ON c.id = ccl.client_id
  JOIN profiles p ON p.id = c.user_id
  WHERE co.user_id = auth.uid()
  ORDER BY p.full_name ASC;
END;
$$;
