-- Create RPC to fetch analytics trend for the last 30 days
CREATE OR REPLACE FUNCTION public.get_coach_analytics_trend()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_coach_id uuid;
    v_result jsonb := '[]'::jsonb;
    v_date date;
    v_day_total_roster integer;
    v_day_high_performers integer;
BEGIN
    -- Get the coach's UUID based on the authenticated user
    SELECT id INTO v_coach_id
    FROM public.coaches
    WHERE user_id = auth.uid();

    IF v_coach_id IS NULL THEN
        RETURN '[]'::jsonb;
    END IF;

    -- Iterate through the last 30 days
    FOR i IN REVERSE 29..0 LOOP
        v_date := CURRENT_DATE - i;

        -- 1. Calculate total roster on that day
        SELECT count(*) INTO v_day_total_roster
        FROM public.coach_client_links ccl
        WHERE ccl.coach_id = v_coach_id 
          AND ccl.created_at::date <= v_date;

        -- 2. Calculate high performers on that day (perfect completion)
        WITH daily_tasks AS (
            SELECT 
                ccl.client_id,
                (
                    SELECT COUNT(*) FROM habits h 
                    WHERE h.client_id = ccl.client_id AND h.is_active = true AND h.created_at::date <= v_date
                ) + (
                    SELECT COUNT(*) FROM sub_challenges sc 
                    JOIN mother_challenges mc ON sc.mother_challenge_id = mc.id
                    WHERE mc.client_id = ccl.client_id AND sc.assigned_date = v_date
                ) as total_tasks,
                (
                    SELECT COUNT(*) FROM habit_logs hl
                    WHERE hl.client_id = ccl.client_id AND hl.date = v_date AND hl.completed = true
                ) + (
                    SELECT COUNT(*) FROM sub_challenges sc 
                    JOIN mother_challenges mc ON sc.mother_challenge_id = mc.id
                    WHERE mc.client_id = ccl.client_id AND sc.assigned_date = v_date AND sc.completed = true
                ) as completed_tasks
            FROM public.coach_client_links ccl
            WHERE ccl.coach_id = v_coach_id 
              AND ccl.status = 'active'
              AND ccl.created_at::date <= v_date
        )
        SELECT COUNT(*) INTO v_day_high_performers
        FROM daily_tasks
        WHERE total_tasks > 0 AND completed_tasks >= total_tasks;

        -- Append to result array
        v_result := v_result || jsonb_build_object(
            'date', v_date,
            'total_roster', v_day_total_roster,
            'high_performers', v_day_high_performers
        );
    END LOOP;

    RETURN v_result;
END;
$$;
