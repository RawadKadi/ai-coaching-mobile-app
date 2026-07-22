-- Add recurrence_rule column to sessions table
ALTER TABLE public.sessions 
ADD COLUMN IF NOT EXISTS recurrence_rule TEXT;
