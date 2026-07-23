-- ALTER TABLE public.sessions
-- Execute this script in your Supabase SQL Editor:

ALTER TABLE public.sessions 
ADD COLUMN IF NOT EXISTS meeting_provider text DEFAULT 'STREAM' CHECK (meeting_provider IN ('STREAM', 'GOOGLE_MEET')),
ADD COLUMN IF NOT EXISTS external_meeting_url text NULL;
