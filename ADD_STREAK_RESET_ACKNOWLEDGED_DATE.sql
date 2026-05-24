-- ===================================================================
-- DATABASE MIGRATION: ADD STREAK RESET ACKNOWLEDGED DATE TO CLIENTS
-- ===================================================================
-- Run this script in your Supabase SQL Editor.
-- ===================================================================

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS streak_reset_acknowledged_date date;
