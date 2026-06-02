-- Add missing columns to the coaches table
-- Safe to run multiple times (IF NOT EXISTS)

ALTER TABLE public.coaches
  ADD COLUMN IF NOT EXISTS business_name TEXT,
  ADD COLUMN IF NOT EXISTS specialty TEXT,
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Verify the columns exist
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'coaches'
  AND column_name IN ('business_name', 'specialty', 'logo_url')
ORDER BY column_name;
