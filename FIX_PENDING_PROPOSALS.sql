-- ==========================================
-- FIX FOR PENDING RESOLUTIONS (Sessions Table)
-- ==========================================

-- 1. Add missing statuses to the session_status enum
ALTER TYPE session_status ADD VALUE IF NOT EXISTS 'proposed';
ALTER TYPE session_status ADD VALUE IF NOT EXISTS 'pending_resolution';
ALTER TYPE session_status ADD VALUE IF NOT EXISTS 'reschedule_requested';

-- 2. Add missing columns for tracking proposals
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS invite_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- 3. Ensure RLS allows updating these fields (if not already covered)
-- (The existing "Coaches can update their sessions" policy usually covers all columns, 
-- but we make sure the schema is correct first).
