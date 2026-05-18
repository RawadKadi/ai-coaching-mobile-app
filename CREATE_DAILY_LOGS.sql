-- ================================================================
-- CREATE DAILY LOGS TABLE FOR AUTOMATED STEP TRACKING
-- ================================================================

CREATE TABLE IF NOT EXISTS public.daily_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  date date NOT NULL,
  steps integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(client_id, date)
);

-- Index for speedy queries
CREATE INDEX IF NOT EXISTS idx_daily_logs_client_date ON public.daily_logs(client_id, date DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.daily_logs ENABLE ROW LEVEL SECURITY;

-- 1. Clients can manage their own daily logs (read, insert, update)
CREATE POLICY "Clients can manage their own daily logs"
  ON public.daily_logs FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clients
      WHERE public.clients.id = daily_logs.client_id
      AND public.clients.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clients
      WHERE public.clients.id = daily_logs.client_id
      AND public.clients.user_id = auth.uid()
    )
  );

-- 2. Coaches can view their clients' daily logs
CREATE POLICY "Coaches can view their clients daily logs"
  ON public.daily_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.coach_client_links ccl
      JOIN public.coaches co ON co.id = ccl.coach_id
      WHERE ccl.client_id = daily_logs.client_id
      AND co.user_id = auth.uid()
      AND ccl.status = 'active'
    )
  );
