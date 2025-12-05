-- Add new columns to sessions table
ALTER TABLE public.sessions 
ADD COLUMN IF NOT EXISTS session_type text DEFAULT 'training',
ADD COLUMN IF NOT EXISTS notes text,
ADD COLUMN IF NOT EXISTS is_locked boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS ai_generated boolean DEFAULT false;

-- Add check constraint for session_type
ALTER TABLE public.sessions 
DROP CONSTRAINT IF EXISTS sessions_session_type_check;

ALTER TABLE public.sessions 
ADD CONSTRAINT sessions_session_type_check 
CHECK (session_type IN ('training', 'nutrition', 'check_in', 'consultation', 'other'));

-- Update RLS policies to allow clients to see only locked sessions
DROP POLICY IF EXISTS "Clients can view their own sessions" ON public.sessions;

CREATE POLICY "Clients can view their own locked sessions"
ON public.sessions
FOR SELECT
TO authenticated
USING (
    auth.uid() = client_id 
    AND (is_locked = true OR status = 'completed')
);

-- Coaches can still see everything (assuming existing policy covers this, but ensuring it here)
-- If there's a generic "Coaches can view their own sessions" policy, it should remain valid.
