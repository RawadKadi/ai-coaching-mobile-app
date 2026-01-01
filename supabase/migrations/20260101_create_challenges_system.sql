-- =====================================================
-- AI-ASSISTED CHALLENGES SYSTEM - DATABASE SCHEMA
-- =====================================================
-- Created: 2026-01-01
-- Purpose: Full schema for coach-led, AI-assisted challenges
-- Principles: Coach authority first, max 1 active challenge per client

-- =====================================================
-- 1. ENUMS
-- =====================================================

CREATE TYPE challenge_status AS ENUM ('draft', 'suggested', 'active', 'completed', 'cancelled');
CREATE TYPE challenge_creator AS ENUM ('coach', 'ai');
CREATE TYPE challenge_focus_type AS ENUM ('training', 'nutrition', 'recovery', 'consistency');
CREATE TYPE suggestion_status AS ENUM ('pending', 'approved', 'dismissed', 'expired');
CREATE TYPE challenge_intensity AS ENUM ('light', 'moderate', 'intense');

-- =====================================================
-- 2. CHALLENGES TABLE (MAIN)
-- =====================================================

CREATE TABLE challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Ownership
    client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    coach_id UUID NOT NULL REFERENCES coaches(user_id) ON DELETE CASCADE,
    
    -- Challenge Definition
    name TEXT NOT NULL CHECK (char_length(name) BETWEEN 3 AND 100),
    description TEXT,
    focus_type challenge_focus_type NOT NULL,
    duration_days INTEGER NOT NULL CHECK (duration_days BETWEEN 3 AND 14),
    rules TEXT[] DEFAULT '{}',
    
    -- Scheduling
    start_date DATE NOT NULL,
    end_date DATE GENERATED ALWAYS AS (start_date + duration_days) STORED,
    
    -- Status & Workflow
    status challenge_status NOT NULL DEFAULT 'draft',
    created_by challenge_creator NOT NULL DEFAULT 'coach',
    approved_by UUID REFERENCES coaches(user_id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    
    -- AI Context (for suggestions)
    trigger_reason TEXT,
    ai_metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_approval CHECK (
        (status IN ('active', 'completed') AND approved_by IS NOT NULL)
        OR (status NOT IN ('active', 'completed'))
    )
);

-- Index for performance
CREATE INDEX idx_challenges_client_status ON challenges(client_id, status);
CREATE INDEX idx_challenges_coach ON challenges(coach_id);
CREATE INDEX idx_challenges_active ON challenges(client_id) WHERE status = 'active';

-- Unique constraint: Max 1 active challenge per client
CREATE UNIQUE INDEX idx_one_active_challenge_per_client 
ON challenges(client_id) 
WHERE status = 'active';

-- Auto-update updated_at
CREATE TRIGGER challenges_updated_at
    BEFORE UPDATE ON challenges
    FOR EACH ROW
    EXECUTE FUNCTION moddatetime(updated_at);

-- =====================================================
-- 3. CHALLENGE PROGRESS TABLE
-- =====================================================

CREATE TABLE challenge_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    
    -- Daily Tracking
    date DATE NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    notes TEXT,
    proof_url TEXT,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(challenge_id, date)
);

-- Index for fast daily queries
CREATE INDEX idx_challenge_progress_challenge ON challenge_progress(challenge_id, date DESC);

-- =====================================================
-- 4. AI CHALLENGE SUGGESTIONS TABLE
-- =====================================================

CREATE TABLE ai_challenge_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Ownership
    client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    coach_id UUID NOT NULL REFERENCES coaches(user_id) ON DELETE CASCADE,
    
    -- Suggestion Payload
    challenge_payload JSONB NOT NULL,
    trigger_reason TEXT NOT NULL,
    trigger_data JSONB DEFAULT '{}'::jsonb,
    
    -- Priority & Status
    priority INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
    status suggestion_status NOT NULL DEFAULT 'pending',
    
    -- Expiration
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES coaches(user_id) ON DELETE SET NULL,
    
    -- Constraints
    CONSTRAINT valid_payload CHECK (
        challenge_payload ? 'name' AND
        challenge_payload ? 'focus_type' AND
        challenge_payload ? 'duration_days'
    )
);

-- Index for coach dashboard
CREATE INDEX idx_suggestions_coach_status ON ai_challenge_suggestions(coach_id, status, priority DESC);
CREATE INDEX idx_suggestions_expiration ON ai_challenge_suggestions(expires_at) WHERE status = 'pending';

-- =====================================================
-- 5. AI COACH BRAIN ENHANCEMENTS
-- =====================================================

-- Add challenge-specific fields to existing ai_coach_brains table
ALTER TABLE ai_coach_brains
    ADD COLUMN IF NOT EXISTS training_style TEXT DEFAULT 'balanced',
    ADD COLUMN IF NOT EXISTS forbidden_methods TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS nutrition_philosophy TEXT,
    ADD COLUMN IF NOT EXISTS max_challenge_duration INTEGER DEFAULT 14 CHECK (max_challenge_duration BETWEEN 3 AND 14),
    ADD COLUMN IF NOT EXISTS preferred_intensity challenge_intensity DEFAULT 'moderate',
    ADD COLUMN IF NOT EXISTS allowed_challenge_types TEXT[] DEFAULT ARRAY['training', 'nutrition', 'recovery', 'consistency'],
    ADD COLUMN IF NOT EXISTS challenge_tone TEXT DEFAULT 'encouraging';

-- =====================================================
-- 6. ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_challenge_suggestions ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 6a. CHALLENGES TABLE RLS
-- =====================================================

-- Coaches can insert challenges for their clients
CREATE POLICY challenges_coach_insert ON challenges
    FOR INSERT
    WITH CHECK (
        auth.uid() IN (
            SELECT user_id FROM coaches WHERE user_id = coach_id
        )
        AND client_id IN (
            SELECT ccl.client_id 
            FROM coach_client_links ccl
            JOIN coaches c ON c.id = ccl.coach_id
            WHERE c.user_id = auth.uid() AND ccl.status = 'active'
        )
    );

-- Coaches can view challenges for their clients
CREATE POLICY challenges_coach_select ON challenges
    FOR SELECT
    USING (
        auth.uid() IN (
            SELECT c.user_id
            FROM coaches c
            JOIN coach_client_links ccl ON ccl.coach_id = c.id
            WHERE ccl.client_id = challenges.client_id
            AND ccl.status = 'active'
        )
    );

-- Clients can view their own challenges
CREATE POLICY challenges_client_select ON challenges
    FOR SELECT
    USING (client_id = auth.uid());

-- Coaches can update their challenges
CREATE POLICY challenges_coach_update ON challenges
    FOR UPDATE
    USING (
        auth.uid() IN (
            SELECT c.user_id
            FROM coaches c
            WHERE c.user_id = coach_id
        )
    );

-- Coaches can delete their challenges
CREATE POLICY challenges_coach_delete ON challenges
    FOR DELETE
    USING (
        auth.uid() IN (
            SELECT c.user_id
            FROM coaches c
            WHERE c.user_id = coach_id
        )
    );

-- =====================================================
-- 6b. CHALLENGE PROGRESS RLS
-- =====================================================

-- Clients can insert progress for their own challenges
CREATE POLICY progress_client_insert ON challenge_progress
    FOR INSERT
    WITH CHECK (
        challenge_id IN (
            SELECT id FROM challenges WHERE client_id = auth.uid()
        )
    );

-- Clients can view their own progress
CREATE POLICY progress_client_select ON challenge_progress
    FOR SELECT
    USING (
        challenge_id IN (
            SELECT id FROM challenges WHERE client_id = auth.uid()
        )
    );

-- Coaches can view progress for their clients' challenges
CREATE POLICY progress_coach_select ON challenge_progress
    FOR SELECT
    USING (
        challenge_id IN (
            SELECT ch.id
            FROM challenges ch
            JOIN coaches c ON c.user_id = ch.coach_id
            WHERE c.user_id = auth.uid()
        )
    );

-- Clients can update their own progress
CREATE POLICY progress_client_update ON challenge_progress
    FOR UPDATE
    USING (
        challenge_id IN (
            SELECT id FROM challenges WHERE client_id = auth.uid()
        )
    );

-- =====================================================
-- 6c. AI SUGGESTIONS RLS
-- =====================================================

-- System/Functions can insert suggestions (no direct user insert)
-- We'll handle this via RPC functions that run with elevated privileges

-- Coaches can view their suggestions
CREATE POLICY suggestions_coach_select ON ai_challenge_suggestions
    FOR SELECT
    USING (
        auth.uid() IN (
            SELECT user_id FROM coaches WHERE user_id = coach_id
        )
    );

-- Coaches can update suggestions (approve/dismiss)
CREATE POLICY suggestions_coach_update ON ai_challenge_suggestions
    FOR UPDATE
    USING (
        auth.uid() IN (
            SELECT user_id FROM coaches WHERE user_id = coach_id
        )
    );

-- =====================================================
-- 7. TRIGGERS & AUTOMATION
-- =====================================================

-- Auto-expire suggestions after 7 days
CREATE OR REPLACE FUNCTION expire_old_suggestions()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE ai_challenge_suggestions
    SET status = 'expired'
    WHERE status = 'pending'
    AND expires_at < NOW();
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Run expiration check periodically (requires pg_cron extension)
-- This will be handled via a scheduled Edge Function instead

-- Auto-complete challenges when end_date passes
CREATE OR REPLACE FUNCTION auto_complete_challenges()
RETURNS void AS $$
BEGIN
    UPDATE challenges
    SET status = 'completed'
    WHERE status = 'active'
    AND end_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 8. HELPER FUNCTIONS
-- =====================================================

-- Function to check if client can receive a new challenge
CREATE OR REPLACE FUNCTION can_assign_challenge(p_client_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    active_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO active_count
    FROM challenges
    WHERE client_id = p_client_id
    AND status = 'active';
    
    RETURN active_count = 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 9. COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE challenges IS 'Main challenges table - coach-led, AI-assisted challenges for clients';
COMMENT ON TABLE challenge_progress IS 'Daily progress tracking for active challenges';
COMMENT ON TABLE ai_challenge_suggestions IS 'Passive AI-generated challenge suggestions awaiting coach approval';
COMMENT ON COLUMN challenges.status IS 'draft=being created, suggested=AI proposed, active=client working on it, completed=finished, cancelled=stopped early';
COMMENT ON COLUMN challenges.created_by IS 'Tracks whether challenge was manually created by coach or AI-generated';
COMMENT ON COLUMN challenges.approved_by IS 'Coach who approved the challenge (required for active/completed status)';
COMMENT ON COLUMN ai_challenge_suggestions.trigger_reason IS 'Why AI suggested this challenge (e.g., "plateau_detected", "missed_checkins")';
COMMENT ON COLUMN ai_challenge_suggestions.priority IS 'Priority level 1-5, where 5 is most urgent';

-- =====================================================
-- END OF MIGRATION
-- =====================================================
