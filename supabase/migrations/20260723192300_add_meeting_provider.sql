-- Add meeting_provider and external_meeting_url columns to sessions table
ALTER TABLE public.sessions 
ADD COLUMN IF NOT EXISTS meeting_provider text DEFAULT 'STREAM' CHECK (meeting_provider IN ('STREAM', 'GOOGLE_MEET')),
ADD COLUMN IF NOT EXISTS external_meeting_url text NULL;

COMMENT ON COLUMN public.sessions.meeting_provider IS 'Meeting provider type: STREAM (native) or GOOGLE_MEET (external)';
COMMENT ON COLUMN public.sessions.external_meeting_url IS 'Custom external link for fallback providers (e.g. Google Meet URL)';
