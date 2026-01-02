-- ============================================================================
-- DAILY CHALLENGES SYSTEM - Complete Rebuild V2.0
-- Version: 2.0 (Daily-Focused) - FIXED
-- Date: 2026-01-01
-- ============================================================================

-- Drop old tables and recreate with daily model
DROP TABLE IF EXISTS challenge_progress CASCADE;
DROP TABLE IF EXISTS ai_challenge_suggestions CASCADE;
DROP TABLE IF EXISTS challenges CASCADE;

-- ============================================================================
-- ENUM TYPES - Drop and Recreate
-- ============================================================================

-- Drop existing enums if they exist
DROP TYPE IF EXISTS challenge_status CASCADE;
DROP TYPE IF EXISTS challenge_creator CASCADE;
DROP TYPE IF EXISTS challenge_focus_type CASCADE;
DROP TYPE IF EXISTS challenge_intensity CASCADE;
DROP TYPE IF EXISTS suggestion_status CASCADE;

-- Recreate all enums
CREATE TYPE challenge_status AS ENUM ('active', 'completed', 'cancelled', 'skipped');
CREATE TYPE challenge_creator AS ENUM ('coach', 'ai');
CREATE TYPE challenge_focus_type AS ENUM ('training', 'nutrition', 'recovery', 'consistency');
CREATE TYPE challenge_intensity AS ENUM ('low', 'medium', 'high');

-- ============================================================================
-- DAILY CHALLENGES TABLE
-- ============================================================================

CREATE TABLE daily_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relationships
    coach_id UUID NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    
    -- Daily Model (KEY CHANGE: Single date, not duration)
    assigned_date DATE NOT NULL,  -- The specific day this challenge is for
    
    -- Challenge Details
    name TEXT NOT NULL,
    description TEXT,
    focus_type challenge_focus_type NOT NULL,
    intensity challenge_intensity DEFAULT 'medium',
    rules TEXT[] NOT NULL DEFAULT '{}',
    
    -- Status & Origin
    status challenge_status DEFAULT 'active',
    created_by challenge_creator NOT NULL,
    
    -- Completion Tracking (Simplified)
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    notes TEXT,  -- Client notes when completing
    proof_image_url TEXT,  -- Optional photo proof
    
    -- AI Context
    trigger_reason TEXT,  -- Why AI suggested this
    ai_reasoning TEXT,  -- AI explanation
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_date CHECK (assigned_date >= CURRENT_DATE - INTERVAL '30 days')
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_daily_challenges_client_date ON daily_challenges(client_id, assigned_date);
CREATE INDEX idx_daily_challenges_coach ON daily_challenges(coach_id);
CREATE INDEX idx_daily_challenges_status ON daily_challenges(status);
CREATE INDEX idx_daily_challenges_date ON daily_challenges(assigned_date);

-- ============================================================================
-- AI SUGGESTIONS TABLE (Daily Model)
-- ============================================================================

CREATE TABLE daily_challenge_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    coach_id UUID NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    
    -- Daily Model
    suggested_date DATE NOT NULL,
    
    -- Suggestion Details
    challenge_data JSONB NOT NULL,  -- {name, description, focus_type, rules, etc}
    trigger_reason TEXT NOT NULL,
    trigger_data JSONB,
    ai_reasoning TEXT,
    priority INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
    
    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'dismissed', 'expired')),
    
    -- Approval tracking
    approved_by UUID REFERENCES coaches(id),
    approved_at TIMESTAMPTZ,
    modifications JSONB,  -- Coach edits before approval
    
    -- Expiration
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_challenge_data CHECK (
        challenge_data ? 'name' AND 
        challenge_data ? 'focus_type' AND
        challenge_data ? 'rules'
    )
);

CREATE INDEX idx_daily_suggestions_coach ON daily_challenge_suggestions(coach_id);
CREATE INDEX idx_daily_suggestions_client_date ON daily_challenge_suggestions(client_id, suggested_date);
CREATE INDEX idx_daily_suggestions_status ON daily_challenge_suggestions(status);

-- ============================================================================
-- UPDATED AT TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION update_daily_challenges_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER daily_challenges_updated_at
    BEFORE UPDATE ON daily_challenges
    FOR EACH ROW
    EXECUTE FUNCTION update_daily_challenges_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE daily_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_challenge_suggestions ENABLE ROW LEVEL SECURITY;

-- Coaches can manage their clients' challenges
CREATE POLICY coaches_manage_daily_challenges ON daily_challenges
    FOR ALL
    USING (
        coach_id IN (
            SELECT id FROM coaches WHERE user_id = auth.uid()
        )
    );

-- Clients can view their own challenges
CREATE POLICY clients_view_daily_challenges ON daily_challenges
    FOR SELECT
    USING (
        client_id IN (
            SELECT id FROM clients WHERE user_id = auth.uid()
        )
    );

-- Clients can update completion status
CREATE POLICY clients_complete_daily_challenges ON daily_challenges
    FOR UPDATE
    USING (
        client_id IN (
            SELECT id FROM clients WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        client_id IN (
            SELECT id FROM clients WHERE user_id = auth.uid()
        )
    );

-- Coaches manage suggestions
CREATE POLICY coaches_manage_suggestions ON daily_challenge_suggestions
    FOR ALL
    USING (
        coach_id IN (
            SELECT id FROM coaches WHERE user_id = auth.uid()
        )
    );

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE daily_challenges IS 'Daily challenges - each challenge is for ONE specific day';
COMMENT ON COLUMN daily_challenges.assigned_date IS 'The specific day this challenge is assigned to';
COMMENT ON COLUMN daily_challenges.completed IS 'Simple boolean - did client complete this challenge?';
COMMENT ON TABLE daily_challenge_suggestions IS 'AI-generated daily challenge suggestions awaiting coach approval';
