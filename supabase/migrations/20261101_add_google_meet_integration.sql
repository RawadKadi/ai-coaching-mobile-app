-- Add Google Meet OAuth columns to coaches table
ALTER TABLE coaches
ADD COLUMN IF NOT EXISTS google_meet_connected boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS google_access_token text,
ADD COLUMN IF NOT EXISTS google_refresh_token text,
ADD COLUMN IF NOT EXISTS google_token_expiry timestamptz;

