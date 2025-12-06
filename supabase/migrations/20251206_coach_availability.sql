-- Create coach_availability table
CREATE TABLE IF NOT EXISTS public.coach_availability (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    coach_id uuid REFERENCES public.coaches(id) ON DELETE CASCADE NOT NULL,
    day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0 = Sunday, 6 = Saturday
    start_time time NOT NULL,
    end_time time NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(coach_id, day_of_week, start_time, end_time)
);

-- Create coach_blocked_dates table
CREATE TABLE IF NOT EXISTS public.coach_blocked_dates (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    coach_id uuid REFERENCES public.coaches(id) ON DELETE CASCADE NOT NULL,
    date date NOT NULL,
    reason text,
    created_at timestamptz DEFAULT now(),
    UNIQUE(coach_id, date)
);

-- Enable RLS
ALTER TABLE public.coach_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_blocked_dates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for coach_availability

-- Coaches can view their own availability
CREATE POLICY "Coaches can view their own availability"
ON public.coach_availability
FOR SELECT
TO authenticated
USING (
    exists (
        select 1 from public.coaches
        where id = coach_availability.coach_id
        and user_id = auth.uid()
    )
);

-- Coaches can insert their own availability
CREATE POLICY "Coaches can insert their own availability"
ON public.coach_availability
FOR INSERT
TO authenticated
WITH CHECK (
    exists (
        select 1 from public.coaches
        where id = coach_availability.coach_id
        and user_id = auth.uid()
    )
);

-- Coaches can update their own availability
CREATE POLICY "Coaches can update their own availability"
ON public.coach_availability
FOR UPDATE
TO authenticated
USING (
    exists (
        select 1 from public.coaches
        where id = coach_availability.coach_id
        and user_id = auth.uid()
    )
);

-- Coaches can delete their own availability
CREATE POLICY "Coaches can delete their own availability"
ON public.coach_availability
FOR DELETE
TO authenticated
USING (
    exists (
        select 1 from public.coaches
        where id = coach_availability.coach_id
        and user_id = auth.uid()
    )
);

-- Clients can view availability of their coach (or any coach? For now, let's say any coach they are linked to or just public read if needed for booking)
-- For simplicity and booking flow, let's allow any authenticated user to read availability (so clients can book)
CREATE POLICY "Anyone can view coach availability"
ON public.coach_availability
FOR SELECT
TO authenticated
USING (true);


-- RLS Policies for coach_blocked_dates

-- Coaches can manage their blocked dates
CREATE POLICY "Coaches can manage their blocked dates"
ON public.coach_blocked_dates
FOR ALL
TO authenticated
USING (
    exists (
        select 1 from public.coaches
        where id = coach_blocked_dates.coach_id
        and user_id = auth.uid()
    )
);

-- Anyone can view blocked dates (to prevent booking)
CREATE POLICY "Anyone can view blocked dates"
ON public.coach_blocked_dates
FOR SELECT
TO authenticated
USING (true);
