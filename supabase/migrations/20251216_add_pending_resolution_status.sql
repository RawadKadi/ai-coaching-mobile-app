-- Add 'pending_resolution' to session_status enum
ALTER TYPE session_status ADD VALUE IF NOT EXISTS 'pending_resolution';
