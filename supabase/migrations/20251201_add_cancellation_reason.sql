-- Add cancellation_reason column to sessions table
ALTER TABLE sessions 
ADD COLUMN IF NOT EXISTS cancellation_reason text;

COMMENT ON COLUMN sessions.cancellation_reason IS 'Reason for session cancellation/postponement';
