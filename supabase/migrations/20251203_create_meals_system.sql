-- =====================================================
-- AI-Powered Nutrition Tracking System
-- =====================================================
-- This migration creates comprehensive meal tracking with AI analysis,
-- ingredient management, daily nutrition summaries, and client AI settings

-- =====================================================
-- 1. MEALS TABLE
-- =====================================================
-- Stores individual meal entries with AI-generated nutritional analysis
CREATE TABLE IF NOT EXISTS meals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    
    -- Meal Metadata
    meal_date DATE NOT NULL,
    meal_time TIME NOT NULL,
    meal_type TEXT CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
    meal_name TEXT NOT NULL,
    description TEXT,
    
    -- Image Data
    photo_url TEXT,
    
    -- Macronutrients (in grams)
    calories DECIMAL(10, 2),
    protein_g DECIMAL(10, 2),
    carbs_g DECIMAL(10, 2),
    fat_g DECIMAL(10, 2),
    fiber_g DECIMAL(10, 2),
    sugar_g DECIMAL(10, 2),
    
    -- Micronutrients (in mg unless specified)
    sodium_mg DECIMAL(10, 2),
    potassium_mg DECIMAL(10, 2),
    calcium_mg DECIMAL(10, 2),
    iron_mg DECIMAL(10, 2),
    vitamin_a_ug DECIMAL(10, 2),  -- micrograms
    vitamin_c_mg DECIMAL(10, 2),
    vitamin_d_ug DECIMAL(10, 2),  -- micrograms
    
    -- Cooking Details
    cooking_method TEXT,  -- e.g., 'fried', 'grilled', 'baked', 'raw'
    portion_size TEXT,    -- e.g., '1 plate', '200g', '1 cup'
    
    -- AI Analysis
    ai_analyzed BOOLEAN DEFAULT FALSE,
    ai_confidence DECIMAL(3, 2),  -- 0.00 to 1.00
    ai_notes TEXT,  -- Any special notes from AI analysis
    
    -- User Modifications
    user_modified BOOLEAN DEFAULT FALSE,  -- True if user edited AI results
    
    -- Sharing
    shared_with_coach BOOLEAN DEFAULT FALSE,
    shared_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 2. MEAL INGREDIENTS TABLE
-- =====================================================
-- Many-to-many relationship for tracking individual ingredients per meal
CREATE TABLE IF NOT EXISTS meal_ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meal_id UUID NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
    
    -- Ingredient Details
    ingredient_name TEXT NOT NULL,
    quantity DECIMAL(10, 2),
    unit TEXT,  -- e.g., 'g', 'ml', 'cup', 'tbsp'
    
    -- Nutritional Contribution (optional - for detailed tracking)
    calories DECIMAL(10, 2),
    protein_g DECIMAL(10, 2),
    carbs_g DECIMAL(10, 2),
    fat_g DECIMAL(10, 2),
    
    -- AI Detection
    ai_detected BOOLEAN DEFAULT TRUE,  -- False if user manually added
    confidence DECIMAL(3, 2),  -- AI confidence for this ingredient
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 3. DAILY NUTRITION SUMMARY TABLE
-- =====================================================
-- Aggregate daily nutrition metrics per client
CREATE TABLE IF NOT EXISTS daily_nutrition_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    summary_date DATE NOT NULL,
    
    -- Daily Totals
    total_calories DECIMAL(10, 2) DEFAULT 0,
    total_protein_g DECIMAL(10, 2) DEFAULT 0,
    total_carbs_g DECIMAL(10, 2) DEFAULT 0,
    total_fat_g DECIMAL(10, 2) DEFAULT 0,
    total_fiber_g DECIMAL(10, 2) DEFAULT 0,
    
    -- Meal Counts
    meals_logged INTEGER DEFAULT 0,
    
    -- Activity (from challenges)
    active_minutes INTEGER DEFAULT 0,
    calories_burned DECIMAL(10, 2) DEFAULT 0,
    
    -- Net Calculations
    net_calories DECIMAL(10, 2) GENERATED ALWAYS AS (total_calories - COALESCE(calories_burned, 0)) STORED,
    
    -- Unique constraint: one summary per client per day
    UNIQUE(client_id, summary_date),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 4. CLIENT SETTINGS TABLE
-- =====================================================
-- Store client-specific AI and app preferences
CREATE TABLE IF NOT EXISTS client_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL UNIQUE REFERENCES clients(id) ON DELETE CASCADE,
    
    -- AI Challenge Settings
    auto_generate_challenges BOOLEAN DEFAULT TRUE,
    challenge_difficulty TEXT DEFAULT 'moderate' CHECK (challenge_difficulty IN ('easy', 'moderate', 'hard')),
    
    -- Nutrition Preferences
    default_cuisine_type TEXT DEFAULT 'lebanese',  -- Help AI with better recognition
    meal_photo_required BOOLEAN DEFAULT FALSE,  -- Require photo for meal logging
    
    -- Privacy
    auto_share_meals BOOLEAN DEFAULT FALSE,  -- Auto-share meals with coach
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 5. INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX idx_meals_client_date ON meals(client_id, meal_date DESC);
CREATE INDEX idx_meals_shared ON meals(client_id, shared_with_coach);
CREATE INDEX idx_meal_ingredients_meal ON meal_ingredients(meal_id);
CREATE INDEX idx_daily_nutrition_client_date ON daily_nutrition_summary(client_id, summary_date DESC);
CREATE INDEX idx_client_settings_client ON client_settings(client_id);

-- =====================================================
-- 6. ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_nutrition_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_settings ENABLE ROW LEVEL SECURITY;

-- MEALS POLICIES
-- Clients can view their own meals
CREATE POLICY "Clients can view own meals"
    ON meals FOR SELECT
    USING (
        client_id IN (
            SELECT id FROM clients WHERE user_id = auth.uid()
        )
    );

-- Clients can insert their own meals
CREATE POLICY "Clients can insert own meals"
    ON meals FOR INSERT
    WITH CHECK (
        client_id IN (
            SELECT id FROM clients WHERE user_id = auth.uid()
        )
    );

-- Clients can update their own meals
CREATE POLICY "Clients can update own meals"
    ON meals FOR UPDATE
    USING (
        client_id IN (
            SELECT id FROM clients WHERE user_id = auth.uid()
        )
    );

-- Coaches can view meals of their clients (only if shared)
CREATE POLICY "Coaches can view shared meals of their clients"
    ON meals FOR SELECT
    USING (
        shared_with_coach = TRUE
        AND client_id IN (
            SELECT ccl.client_id 
            FROM coach_client_links ccl
            JOIN coaches c ON c.id = ccl.coach_id
            WHERE c.user_id = auth.uid() 
            AND ccl.status = 'active'
        )
    );

-- MEAL INGREDIENTS POLICIES
-- Clients can manage ingredients for their meals
CREATE POLICY "Clients can view own meal ingredients"
    ON meal_ingredients FOR SELECT
    USING (
        meal_id IN (
            SELECT id FROM meals WHERE client_id IN (
                SELECT id FROM clients WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Clients can insert own meal ingredients"
    ON meal_ingredients FOR INSERT
    WITH CHECK (
        meal_id IN (
            SELECT id FROM meals WHERE client_id IN (
                SELECT id FROM clients WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Clients can update own meal ingredients"
    ON meal_ingredients FOR UPDATE
    USING (
        meal_id IN (
            SELECT id FROM meals WHERE client_id IN (
                SELECT id FROM clients WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Clients can delete own meal ingredients"
    ON meal_ingredients FOR DELETE
    USING (
        meal_id IN (
            SELECT id FROM meals WHERE client_id IN (
                SELECT id FROM clients WHERE user_id = auth.uid()
            )
        )
    );

-- Coaches can view ingredients of shared meals
CREATE POLICY "Coaches can view ingredients of shared meals"
    ON meal_ingredients FOR SELECT
    USING (
        meal_id IN (
            SELECT m.id FROM meals m
            WHERE m.shared_with_coach = TRUE
            AND m.client_id IN (
                SELECT ccl.client_id 
                FROM coach_client_links ccl
                JOIN coaches c ON c.id = ccl.coach_id
                WHERE c.user_id = auth.uid() 
                AND ccl.status = 'active'
            )
        )
    );

-- DAILY NUTRITION SUMMARY POLICIES
-- Clients can view their own summaries
CREATE POLICY "Clients can view own nutrition summaries"
    ON daily_nutrition_summary FOR SELECT
    USING (
        client_id IN (
            SELECT id FROM clients WHERE user_id = auth.uid()
        )
    );

-- Coaches can view summaries of their clients
CREATE POLICY "Coaches can view client nutrition summaries"
    ON daily_nutrition_summary FOR SELECT
    USING (
        client_id IN (
            SELECT ccl.client_id 
            FROM coach_client_links ccl
            JOIN coaches c ON c.id = ccl.coach_id
            WHERE c.user_id = auth.uid() 
            AND ccl.status = 'active'
        )
    );

-- System can insert/update summaries (via triggers)
CREATE POLICY "System can manage nutrition summaries"
    ON daily_nutrition_summary FOR ALL
    USING (true)
    WITH CHECK (true);

-- CLIENT SETTINGS POLICIES
-- Clients can view and update their own settings
CREATE POLICY "Clients can view own settings"
    ON client_settings FOR SELECT
    USING (
        client_id IN (
            SELECT id FROM clients WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Clients can insert own settings"
    ON client_settings FOR INSERT
    WITH CHECK (
        client_id IN (
            SELECT id FROM clients WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Clients can update own settings"
    ON client_settings FOR UPDATE
    USING (
        client_id IN (
            SELECT id FROM clients WHERE user_id = auth.uid()
        )
    );

-- Coaches can view settings of their clients
CREATE POLICY "Coaches can view client settings"
    ON client_settings FOR SELECT
    USING (
        client_id IN (
            SELECT ccl.client_id 
            FROM coach_client_links ccl
            JOIN coaches c ON c.id = ccl.coach_id
            WHERE c.user_id = auth.uid() 
            AND ccl.status = 'active'
        )
    );

-- Coaches can update auto_generate_challenges for their clients
CREATE POLICY "Coaches can update client challenge settings"
    ON client_settings FOR UPDATE
    USING (
        client_id IN (
            SELECT ccl.client_id 
            FROM coach_client_links ccl
            JOIN coaches c ON c.id = ccl.coach_id
            WHERE c.user_id = auth.uid() 
            AND ccl.status = 'active'
        )
    );

-- =====================================================
-- 7. TRIGGERS FOR AUTO-UPDATING SUMMARIES
-- =====================================================

-- Function to update daily nutrition summary when meal is added/updated
CREATE OR REPLACE FUNCTION update_daily_nutrition_summary()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert or update the daily summary
    INSERT INTO daily_nutrition_summary (
        client_id,
        summary_date,
        total_calories,
        total_protein_g,
        total_carbs_g,
        total_fat_g,
        total_fiber_g,
        meals_logged
    )
    SELECT 
        client_id,
        meal_date,
        SUM(COALESCE(calories, 0)),
        SUM(COALESCE(protein_g, 0)),
        SUM(COALESCE(carbs_g, 0)),
        SUM(COALESCE(fat_g, 0)),
        SUM(COALESCE(fiber_g, 0)),
        COUNT(*)
    FROM meals
    WHERE client_id = NEW.client_id AND meal_date = NEW.meal_date
    GROUP BY client_id, meal_date
    ON CONFLICT (client_id, summary_date) 
    DO UPDATE SET
        total_calories = EXCLUDED.total_calories,
        total_protein_g = EXCLUDED.total_protein_g,
        total_carbs_g = EXCLUDED.total_carbs_g,
        total_fat_g = EXCLUDED.total_fat_g,
        total_fiber_g = EXCLUDED.total_fiber_g,
        meals_logged = EXCLUDED.meals_logged,
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on meals insert/update
CREATE TRIGGER trigger_update_nutrition_summary
    AFTER INSERT OR UPDATE ON meals
    FOR EACH ROW
    EXECUTE FUNCTION update_daily_nutrition_summary();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_meals_updated_at
    BEFORE UPDATE ON meals
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_client_settings_updated_at
    BEFORE UPDATE ON client_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_daily_nutrition_summary_updated_at
    BEFORE UPDATE ON daily_nutrition_summary
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 8. CREATE DEFAULT SETTINGS FOR EXISTING CLIENTS
-- =====================================================
INSERT INTO client_settings (client_id)
SELECT id FROM clients
WHERE id NOT IN (SELECT client_id FROM client_settings)
ON CONFLICT (client_id) DO NOTHING;
