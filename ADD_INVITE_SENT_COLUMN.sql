-- Add invite_sent column to sessions table
ALTER TABLE public.sessions 
ADD COLUMN IF NOT EXISTS invite_sent boolean DEFAULT false;
