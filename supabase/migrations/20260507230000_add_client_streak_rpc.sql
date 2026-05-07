-- Add get_client_streak RPC
CREATE OR REPLACE FUNCTION public.get_client_streak(p_client_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_streak integer := 0;
    v_date date := CURRENT_DATE;
    v_total_tasks integer;
    v_completed_tasks integer;
    v_is_perfect boolean;
BEGIN
    LOOP
        -- Habits
        SELECT COUNT(*) INTO v_total_tasks
        FROM habits
        WHERE client_id = p_client_id 
          AND is_active = true
          AND created_at::date <= v_date;

        -- Sub-challenges (linked via mother_challenges)
        SELECT COUNT(*) + v_total_tasks INTO v_total_tasks
        FROM sub_challenges sc
        JOIN mother_challenges mc ON sc.mother_challenge_id = mc.id
        WHERE mc.client_id = p_client_id 
          AND sc.assigned_date = v_date;

        IF v_total_tasks = 0 THEN
            -- If it's today and no tasks, we check yesterday
            IF v_date = CURRENT_DATE THEN
                v_date := v_date - 1;
                CONTINUE;
            ELSE
                EXIT; -- No tasks assigned in the past, streak ends
            END IF;
        END IF;

        -- Completed Habits
        SELECT COUNT(*) INTO v_completed_tasks
        FROM habit_logs
        WHERE client_id = p_client_id 
          AND date = v_date
          AND completed = true;

        -- Completed Sub-challenges
        SELECT COUNT(*) + v_completed_tasks INTO v_completed_tasks
        FROM sub_challenges sc
        JOIN mother_challenges mc ON sc.mother_challenge_id = mc.id
        WHERE mc.client_id = p_client_id 
          AND sc.assigned_date = v_date
          AND sc.completed = true;

        v_is_perfect := (v_completed_tasks >= v_total_tasks);

        IF v_is_perfect THEN
            v_streak := v_streak + 1;
        ELSE
            IF v_date < CURRENT_DATE THEN
                EXIT; -- Broken streak in the past
            END IF;
            -- Today not yet perfect, but maybe yesterday was.
        END IF;
        
        v_date := v_date - 1;
        
        -- Safety break to prevent infinite loops (max 365 days)
        IF v_streak > 365 THEN
            EXIT;
        END IF;
        
        -- Prevent going back before the app existed or something reasonable
        IF v_date < '2024-01-01'::date THEN
            EXIT;
        END IF;
    END LOOP;
    
    RETURN v_streak;
END;
$$;
