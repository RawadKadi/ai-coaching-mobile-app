ALTER TYPE session_status ADD VALUE IF NOT EXISTS 'proposed';
ALTER TYPE session_status ADD VALUE IF NOT EXISTS 'pending_resolution';
ALTER TYPE session_status ADD VALUE IF NOT EXISTS 'reschedule_requested';
