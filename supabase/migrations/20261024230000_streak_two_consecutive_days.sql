-- ===================================================================
-- DATABASE MIGRATION: 2 CONSECUTIVE MISSED DAYS STREAK RULE
-- ===================================================================
-- Missing 1 day preserves streak in cold state.
-- Only missing 2 consecutive days resets the streak to 0.
-- ===================================================================

CREATE OR REPLACE FUNCTION public.get_client_streak(
  p_client_id uuid,
  p_timezone  text DEFAULT 'UTC'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_streak           integer := 0;
  v_today            date    := (NOW() AT TIME ZONE p_timezone)::date;
  v_date             date    := v_today;
  v_total_habits     integer;
  v_completed_habits integer;
  v_is_perfect       boolean;
  v_consecutive_miss integer := 0;
BEGIN
  LOOP
    -- How many currently active habits existed on this date?
    SELECT COUNT(*) INTO v_total_habits
    FROM habits
    WHERE client_id = p_client_id
      AND is_active = true
      AND created_at::date <= v_date;

    IF v_total_habits = 0 THEN
      IF v_date = v_today THEN
        v_date := v_date - 1;
        CONTINUE;
      ELSE
        EXIT;
      END IF;
    END IF;

    -- How many of those SAME active habits were completed on this date?
    SELECT COUNT(*) INTO v_completed_habits
    FROM habit_logs hl
    JOIN habits h ON h.id = hl.habit_id
    WHERE hl.client_id = p_client_id
      AND hl.date = v_date
      AND hl.completed = true
      AND h.is_active = true
      AND h.created_at::date <= v_date;

    v_is_perfect := (v_completed_habits >= v_total_habits);

    IF v_is_perfect THEN
      v_streak := v_streak + 1;
      v_consecutive_miss := 0;
    ELSE
      IF v_date = v_today THEN
        -- Grace period — today still in progress
        NULL;
      ELSE
        v_consecutive_miss := v_consecutive_miss + 1;
        -- If 2 consecutive days were missed, streak is broken
        IF v_consecutive_miss >= 2 THEN
          EXIT;
        END IF;
      END IF;
    END IF;

    v_date := v_date - 1;

    IF v_streak > 365 THEN EXIT; END IF;
    IF v_date < '2024-01-01'::date THEN EXIT; END IF;

  END LOOP;

  -- If 2 consecutive days were missed immediately prior to today, streak is 0
  IF v_consecutive_miss >= 2 THEN
    RETURN 0;
  END IF;

  RETURN v_streak;
END;
$$;
