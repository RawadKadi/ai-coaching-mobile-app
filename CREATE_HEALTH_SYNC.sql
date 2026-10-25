-- ================================================================
-- HEALTH SYNC DATABASE MIGRATION
-- Supports automated health data ingestion (Apple HealthKit & Health Connect)
-- ================================================================

-- 1. Extend daily_logs with sleep, active minutes, and silent biometrics
ALTER TABLE public.daily_logs 
  ADD COLUMN IF NOT EXISTS sleep_hours numeric(4,2),
  ADD COLUMN IF NOT EXISTS active_minutes integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS resting_heart_rate integer,
  ADD COLUMN IF NOT EXISTS hrv_ms numeric(5,2),
  ADD COLUMN IF NOT EXISTS synced_at timestamptz DEFAULT now();

-- 2. Extend workouts for external synced workouts (Strava, Apple Health, Nike Run Club)
ALTER TABLE public.workouts
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS external_id text;

-- Index external_id per client to prevent duplicate synced sessions
CREATE UNIQUE INDEX IF NOT EXISTS idx_workouts_client_external_id 
  ON public.workouts(client_id, external_id) 
  WHERE external_id IS NOT NULL;

-- 3. Extend habits for automated task completion (e.g. 'steps', 'active_time')
ALTER TABLE public.habits
  ADD COLUMN IF NOT EXISTS sync_metric text;

-- Add comment descriptors
COMMENT ON COLUMN public.daily_logs.sleep_hours IS 'Sleep duration in hours from phone/wearable sync';
COMMENT ON COLUMN public.daily_logs.active_minutes IS 'Total exercise/active duration in minutes for the day';
COMMENT ON COLUMN public.daily_logs.resting_heart_rate IS 'Passive resting heart rate (bpm) for coach/AI fatigue tracking';
COMMENT ON COLUMN public.daily_logs.hrv_ms IS 'Passive Heart Rate Variability (ms) for coach/AI fatigue tracking';
COMMENT ON COLUMN public.workouts.source IS 'Source of the workout: manual or health_sync';
COMMENT ON COLUMN public.workouts.external_id IS 'Unique identifier from external health store to prevent duplicate imports';
COMMENT ON COLUMN public.habits.sync_metric IS 'Metric type that auto-completes this habit: steps, active_time, or null';
