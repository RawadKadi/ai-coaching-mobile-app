-- ============================================================================
-- CHALLENGES V3 - MOTHER + SUB-CHALLENGES ARCHITECTURE
-- Proper 2-level hierarchy
-- ============================================================================

-- Drop v2 tables
DROP TABLE IF EXISTS daily_challenge_suggestions CASCADE;
DROP TABLE IF EXISTS daily_challenges CASCADE;

-- Drop v3 tables if they exist (for re-running migration)
DROP TABLE IF EXISTS mother_challenge_suggestions CASCADE;
DROP TABLE IF EXISTS sub_challenges CASCADE;
DROP TABLE IF EXISTS mother_challenges CASCADE;

-- ============================================================================
-- MOTHER CHALLENGES (Container/Phase)
-- ============================================================================

CREATE TABLE mother_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relationships
    coach_id UUID NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    
    -- Phase Info
    name TEXT NOT NULL,  -- "Weekly Wellness Challenge"
    description TEXT,
    
    -- Duration
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    duration_days INTEGER GENERATED ALWAYS AS (end_date - start_date + 1) STORED,
    
    -- Status
    status challenge_status DEFAULT 'active',
    created_by challenge_creator NOT NULL,
    
    -- AI Context
    trigger_reason TEXT,
    ai_reasoning TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_dates CHECK (end_date >= start_date),
    CONSTRAINT max_duration CHECK ((end_date - start_date) <= 14)
);

CREATE INDEX idx_mother_challenges_client ON mother_challenges(client_id);
CREATE INDEX idx_mother_challenges_coach ON mother_challenges(coach_id);
CREATE INDEX idx_mother_challenges_dates ON mother_challenges(start_date, end_date);

-- ============================================================================
-- SUB-CHALLENGES (Daily Tasks)
-- ============================================================================

CREATE TABLE sub_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Belongs to mother challenge
    mother_challenge_id UUID NOT NULL REFERENCES mother_challenges(id) ON DELETE CASCADE,
    
    -- Daily Assignment
    assigned_date DATE NOT NULL,  -- Specific day within mother challenge
    
    -- Task Details
    name TEXT NOT NULL,  -- "Eat 3 servings of vegetables today"
    description TEXT,
    focus_type challenge_focus_type NOT NULL,
    intensity challenge_intensity DEFAULT 'medium',
    
    -- Completion
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    notes TEXT,
    proof_image_url TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
    
    -- Note: Date validation enforced by application logic and RPC functions
);

CREATE INDEX idx_sub_challenges_mother ON sub_challenges(mother_challenge_id);
CREATE INDEX idx_sub_challenges_date ON sub_challenges(assigned_date);
CREATE INDEX idx_sub_challenges_completed ON sub_challenges(completed);

-- ============================================================================
-- AI SUGGESTIONS (For Mother Challenges)
-- ============================================================================

CREATE TABLE mother_challenge_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    coach_id UUID NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    
    -- Suggestion Data
    mother_name TEXT NOT NULL,
    mother_description TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    
    -- Sub-challenges data (JSONB array of daily tasks)
    sub_challenges_data JSONB NOT NULL,  -- [{date, name, focus_type, description}...]
    
    trigger_reason TEXT NOT NULL,
    ai_reasoning TEXT,
    priority INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
    
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'dismissed', 'expired')),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mother_suggestions_coach ON mother_challenge_suggestions(coach_id);
CREATE INDEX idx_mother_suggestions_status ON mother_challenge_suggestions(status);

-- ============================================================================
-- UPDATED AT TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_mother_challenges_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER mother_challenges_updated_at
    BEFORE UPDATE ON mother_challenges
    FOR EACH ROW
    EXECUTE FUNCTION update_mother_challenges_updated_at();

CREATE TRIGGER sub_challenges_updated_at
    BEFORE UPDATE ON sub_challenges
    FOR EACH ROW
    EXECUTE FUNCTION update_mother_challenges_updated_at();

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE mother_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE mother_challenge_suggestions ENABLE ROW LEVEL SECURITY;

-- Coaches manage mother challenges
CREATE POLICY coaches_manage_mother_challenges ON mother_challenges
    FOR ALL
    USING (
        coach_id IN (SELECT id FROM coaches WHERE user_id = auth.uid())
    );

-- Clients view their mother challenges
CREATE POLICY clients_view_mother_challenges ON mother_challenges
    FOR SELECT
    USING (
        client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())
    );

-- Coaches manage sub-challenges
CREATE POLICY coaches_manage_sub_challenges ON sub_challenges
    FOR ALL
    USING (
        mother_challenge_id IN (
            SELECT id FROM mother_challenges 
            WHERE coach_id IN (SELECT id FROM coaches WHERE user_id = auth.uid())
        )
    );

-- Clients view and complete sub-challenges
CREATE POLICY clients_view_sub_challenges ON sub_challenges
    FOR SELECT
    USING (
        mother_challenge_id IN (
            SELECT id FROM mother_challenges 
            WHERE client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())
        )
    );

CREATE POLICY clients_complete_sub_challenges ON sub_challenges
    FOR UPDATE
    USING (
        mother_challenge_id IN (
            SELECT id FROM mother_challenges 
            WHERE client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())
        )
    )
    WITH CHECK (
        mother_challenge_id IN (
            SELECT id FROM mother_challenges 
            WHERE client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())
        )
    );

-- Coaches manage suggestions
CREATE POLICY coaches_manage_suggestions ON mother_challenge_suggestions
    FOR ALL
    USING (
        coach_id IN (SELECT id FROM coaches WHERE user_id = auth.uid())
    );

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE mother_challenges IS 'Phase/container challenges (e.g., Weekly Wellness)';
COMMENT ON TABLE sub_challenges IS 'Daily actionable tasks within a mother challenge';
COMMENT ON COLUMN sub_challenges.assigned_date IS 'Specific day this sub-challenge is for';
