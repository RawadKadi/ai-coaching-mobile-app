-- Timezone-aware streak RPC (habits only, active habits only)
-- Streak is based solely on daily habits (daily protocols).
-- Both the total count AND the completed count are scoped to currently active habits,
-- so deactivated/removed habits do not inflate past day results.
-- p_timezone: IANA timezone ID e.g. 'Europe/Paris', 'America/New_York'
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
    -- Joining back to habits ensures removed habits don't inflate the count.
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
    ELSE
      IF v_date = v_today THEN
        NULL; -- grace period — today still in progress
      ELSE
        EXIT; -- missed a past day — streak broken
      END IF;
    END IF;

    v_date := v_date - 1;

    IF v_streak > 365 THEN EXIT; END IF;
    IF v_date < '2024-01-01'::date THEN EXIT; END IF;

  END LOOP;

  RETURN v_streak;
END;
$$;
