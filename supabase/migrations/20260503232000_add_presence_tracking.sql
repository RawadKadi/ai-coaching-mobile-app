
-- Add last_seen_at to profiles for real-time activity tracking
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;
-- Reset any accidental 'now()' values to NULL so everyone starts as offline
UPDATE public.profiles SET last_seen_at = NULL;
-- Remove default if it was added
ALTER TABLE public.profiles ALTER COLUMN last_seen_at DROP DEFAULT;

-- Update the dashboard stats function to use last_seen_at for "Active Now"
CREATE OR REPLACE FUNCTION public.get_coach_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_coach_id uuid;
    v_total_roster integer := 0;
    v_online_now integer := 0;
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

    -- 1. Total Roster: All active links with valid profiles
    SELECT count(*) INTO v_total_roster
    FROM public.coach_client_links ccl
    JOIN public.clients c ON c.id = ccl.client_id
    JOIN public.profiles p ON p.id = c.user_id
    WHERE ccl.coach_id = v_coach_id AND ccl.status = 'active';

    -- 2. Active Now: Clients seen in the last 5 minutes (excluding the coach themselves)
    SELECT count(*) INTO v_online_now
    FROM public.coach_client_links ccl
    JOIN public.clients c ON c.id = ccl.client_id
    JOIN public.profiles p ON p.id = c.user_id
    WHERE ccl.coach_id = v_coach_id 
      AND ccl.status = 'active'
      AND p.id != auth.uid()
      AND p.last_seen_at > (now() - interval '5 minutes');

    -- 3. Pending Check-ins: Active clients who haven't checked in today
    SELECT count(DISTINCT ccl.client_id)
    INTO v_checked_in_today
    FROM public.coach_client_links ccl
    JOIN public.check_ins ci ON ci.client_id = ccl.client_id
    WHERE ccl.coach_id = v_coach_id 
      AND ccl.status = 'active' 
      AND ci.date = CURRENT_DATE;

    RETURN jsonb_build_object(
        'totalClients', COALESCE(v_total_roster, 0),
        'activeClients', COALESCE(v_online_now, 0),
        'pendingCheckIns', GREATEST(v_total_roster - v_checked_in_today, 0)
    );
END;
$$;
