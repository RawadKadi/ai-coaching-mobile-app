-- =====================================================
-- AI-ASSISTED CHALLENGES SYSTEM - COMPLETE MIGRATION
-- =====================================================
-- Compatible with your existing schema
-- Creates ai_coach_brains table + challenges system

-- =====================================================
-- 1. ENUMS
-- =====================================================

CREATE TYPE challenge_status AS ENUM ('draft', 'suggested', 'active', 'completed', 'cancelled');
CREATE TYPE challenge_creator AS ENUM ('coach', 'ai');
CREATE TYPE challenge_focus_type AS ENUM ('training', 'nutrition', 'recovery', 'consistency');
CREATE TYPE suggestion_status AS ENUM ('pending', 'approved', 'dismissed', 'expired');
CREATE TYPE challenge_intensity AS ENUM ('light', 'moderate', 'intense');

-- =====================================================
-- 2. CREATE AI COACH BRAINS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS ai_coach_brains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id UUID NOT NULL UNIQUE REFERENCES coaches(id) ON DELETE CASCADE,
    
    -- Core AI Settings
    tone TEXT DEFAULT 'encouraging',
    style TEXT DEFAULT 'balanced',
    philosophy TEXT,
    rules TEXT[] DEFAULT '{}',
    forbidden_advice TEXT[] DEFAULT '{}',
    specialty_focus TEXT,
    system_prompt TEXT,
    
    -- Challenge-Specific Settings
    training_style TEXT DEFAULT 'balanced',
    forbidden_methods TEXT[] DEFAULT '{}',
    nutrition_philosophy TEXT,
    max_challenge_duration INTEGER DEFAULT 14 CHECK (max_challenge_duration BETWEEN 3 AND 14),
    preferred_intensity challenge_intensity DEFAULT 'moderate',
    allowed_challenge_types TEXT[] DEFAULT ARRAY['training', 'nutrition', 'recovery', 'consistency'],
    challenge_tone TEXT DEFAULT 'encouraging',
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_coach_brains_coach ON ai_coach_brains(coach_id);

-- =====================================================
-- 3. CHALLENGES TABLE
-- =====================================================

CREATE TABLE challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Ownership (using your existing schema structure)
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    coach_id UUID NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
    
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
    approved_by UUID REFERENCES coaches(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    
    -- AI Context
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

CREATE INDEX idx_challenges_client_status ON challenges(client_id, status);
CREATE INDEX idx_challenges_coach ON challenges(coach_id);
CREATE INDEX idx_challenges_active ON challenges(client_id) WHERE status = 'active';
CREATE UNIQUE INDEX idx_one_active_challenge_per_client ON challenges(client_id) WHERE status = 'active';

-- Auto-update trigger
CREATE OR REPLACE FUNCTION update_challenges_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER challenges_updated_at
    BEFORE UPDATE ON challenges
    FOR EACH ROW
    EXECUTE FUNCTION update_challenges_updated_at();

-- =====================================================
-- 4. CHALLENGE PROGRESS TABLE
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
    
    UNIQUE(challenge_id, date)
);

CREATE INDEX idx_challenge_progress_challenge ON challenge_progress(challenge_id, date DESC);

-- =====================================================
-- 5. AI CHALLENGE SUGGESTIONS TABLE
-- =====================================================

CREATE TABLE ai_challenge_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Ownership
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    coach_id UUID NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
    
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
    reviewed_by UUID REFERENCES coaches(id) ON DELETE SET NULL,
    
    -- Constraints
    CONSTRAINT valid_payload CHECK (
        challenge_payload ? 'name' AND
        challenge_payload ? 'focus_type' AND
        challenge_payload ? 'duration_days'
    )
);

CREATE INDEX idx_suggestions_coach_status ON ai_challenge_suggestions(coach_id, status, priority DESC);
CREATE INDEX idx_suggestions_expiration ON ai_challenge_suggestions(expires_at) WHERE status = 'pending';

-- =====================================================
-- 6. ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE ai_coach_brains ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_challenge_suggestions ENABLE ROW LEVEL SECURITY;

-- AI Coach Brains RLS
CREATE POLICY ai_brains_coach_all ON ai_coach_brains
    FOR ALL USING (
        coach_id IN (SELECT id FROM coaches WHERE user_id = auth.uid())
    );

-- Challenges RLS
CREATE POLICY challenges_coach_insert ON challenges
    FOR INSERT WITH CHECK (
        coach_id IN (SELECT id FROM coaches WHERE user_id = auth.uid())
        AND client_id IN (
            SELECT ccl.client_id FROM coach_client_links ccl
            WHERE ccl.coach_id IN (SELECT id FROM coaches WHERE user_id = auth.uid())
            AND ccl.status = 'active'
        )
    );

CREATE POLICY challenges_coach_select ON challenges
    FOR SELECT USING (
        coach_id IN (SELECT id FROM coaches WHERE user_id = auth.uid())
        OR client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())
    );

CREATE POLICY challenges_client_select ON challenges
    FOR SELECT USING (
        client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())
    );

CREATE POLICY challenges_coach_update ON challenges
    FOR UPDATE USING (
        coach_id IN (SELECT id FROM coaches WHERE user_id = auth.uid())
    );

CREATE POLICY challenges_coach_delete ON challenges
    FOR DELETE USING (
        coach_id IN (SELECT id FROM coaches WHERE user_id = auth.uid())
    );

-- Progress RLS
CREATE POLICY progress_client_insert ON challenge_progress
    FOR INSERT WITH CHECK (
        challenge_id IN (
            SELECT id FROM challenges 
            WHERE client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())
        )
    );

CREATE POLICY progress_client_select ON challenge_progress
    FOR SELECT USING (
        challenge_id IN (
            SELECT id FROM challenges 
            WHERE client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())
        )
    );

CREATE POLICY progress_coach_select ON challenge_progress
    FOR SELECT USING (
        challenge_id IN (
            SELECT id FROM challenges 
            WHERE coach_id IN (SELECT id FROM coaches WHERE user_id = auth.uid())
        )
    );

CREATE POLICY progress_client_update ON challenge_progress
    FOR UPDATE USING (
        challenge_id IN (
            SELECT id FROM challenges 
            WHERE client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())
        )
    );

-- Suggestions RLS
CREATE POLICY suggestions_coach_select ON ai_challenge_suggestions
    FOR SELECT USING (
        coach_id IN (SELECT id FROM coaches WHERE user_id = auth.uid())
    );

CREATE POLICY suggestions_coach_update ON ai_challenge_suggestions
    FOR UPDATE USING (
        coach_id IN (SELECT id FROM coaches WHERE user_id = auth.uid())
    );

-- =====================================================
-- 7. HELPER FUNCTIONS
-- =====================================================

CREATE OR REPLACE FUNCTION can_assign_challenge(p_client_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    active_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO active_count
    FROM challenges
    WHERE client_id = p_client_id AND status = 'active';
    RETURN active_count = 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION auto_complete_challenges()
RETURNS void AS $$
BEGIN
    UPDATE challenges SET status = 'completed'
    WHERE status = 'active' AND end_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 8. COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE ai_coach_brains IS 'AI configuration for each coach - controls AI behavior for challenges and other features';
COMMENT ON TABLE challenges IS 'Main challenges table - coach-led, AI-assisted challenges for clients';
COMMENT ON TABLE challenge_progress IS 'Daily progress tracking for active challenges';
COMMENT ON TABLE ai_challenge_suggestions IS 'Passive AI-generated challenge suggestions awaiting coach approval';

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

DO $$ 
BEGIN 
    RAISE NOTICE '✅ Challenges system migration completed successfully!'; 
    RAISE NOTICE '   - Created 4 tables: ai_coach_brains, challenges, challenge_progress, ai_challenge_suggestions';
    RAISE NOTICE '   - Created 5 enum types';
    RAISE NOTICE '   - Enabled RLS on all tables';
    RAISE NOTICE '   - Next step: Run the RPC functions migration';
END $$;
