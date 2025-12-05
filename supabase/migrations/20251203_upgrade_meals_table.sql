-- Upgrade meals table to support AI features
-- 1. Rename existing columns to match new schema
DO $$
BEGIN
  IF EXISTS(SELECT * FROM information_schema.columns WHERE table_name = 'meals' AND column_name = 'date') THEN
    ALTER TABLE meals RENAME COLUMN "date" TO meal_date;
  END IF;
  
  IF EXISTS(SELECT * FROM information_schema.columns WHERE table_name = 'meals' AND column_name = 'name') THEN
    ALTER TABLE meals RENAME COLUMN "name" TO meal_name;
  END IF;
END $$;

-- 2. Add missing columns
ALTER TABLE meals 
ADD COLUMN IF NOT EXISTS meal_time TIME DEFAULT '12:00:00', -- Default for existing rows
ADD COLUMN IF NOT EXISTS fiber_g DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS sugar_g DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS sodium_mg DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS potassium_mg DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS calcium_mg DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS iron_mg DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS vitamin_a_ug DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS vitamin_c_mg DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS vitamin_d_ug DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS cooking_method TEXT,
ADD COLUMN IF NOT EXISTS portion_size TEXT,
ADD COLUMN IF NOT EXISTS ai_analyzed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ai_confidence DECIMAL(3, 2),
ADD COLUMN IF NOT EXISTS ai_notes TEXT,
ADD COLUMN IF NOT EXISTS user_modified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS shared_with_coach BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS shared_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3. Create other missing tables (idempotent)
CREATE TABLE IF NOT EXISTS meal_ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meal_id UUID NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
    ingredient_name TEXT NOT NULL,
    quantity DECIMAL(10, 2),
    unit TEXT,
    calories DECIMAL(10, 2),
    protein_g DECIMAL(10, 2),
    carbs_g DECIMAL(10, 2),
    fat_g DECIMAL(10, 2),
    ai_detected BOOLEAN DEFAULT TRUE,
    confidence DECIMAL(3, 2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS daily_nutrition_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    summary_date DATE NOT NULL,
    total_calories DECIMAL(10, 2) DEFAULT 0,
    total_protein_g DECIMAL(10, 2) DEFAULT 0,
    total_carbs_g DECIMAL(10, 2) DEFAULT 0,
    total_fat_g DECIMAL(10, 2) DEFAULT 0,
    total_fiber_g DECIMAL(10, 2) DEFAULT 0,
    meals_logged INTEGER DEFAULT 0,
    active_minutes INTEGER DEFAULT 0,
    calories_burned DECIMAL(10, 2) DEFAULT 0,
    net_calories DECIMAL(10, 2) GENERATED ALWAYS AS (total_calories - COALESCE(calories_burned, 0)) STORED,
    UNIQUE(client_id, summary_date),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS client_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL UNIQUE REFERENCES clients(id) ON DELETE CASCADE,
    auto_generate_challenges BOOLEAN DEFAULT TRUE,
    challenge_difficulty TEXT DEFAULT 'moderate',
    default_cuisine_type TEXT DEFAULT 'lebanese',
    meal_photo_required BOOLEAN DEFAULT FALSE,
    auto_share_meals BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enable RLS on new tables
ALTER TABLE meal_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_nutrition_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_settings ENABLE ROW LEVEL SECURITY;

-- 5. Add basic policies for new tables (simplified for immediate fix)
-- Meal Ingredients
DROP POLICY IF EXISTS "Clients can manage own ingredients" ON meal_ingredients;
CREATE POLICY "Clients can manage own ingredients" ON meal_ingredients
    USING (meal_id IN (SELECT id FROM meals WHERE client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())))
    WITH CHECK (meal_id IN (SELECT id FROM meals WHERE client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())));

-- Daily Summary
DROP POLICY IF EXISTS "Clients can view own summary" ON daily_nutrition_summary;
CREATE POLICY "Clients can view own summary" ON daily_nutrition_summary
    USING (client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()));

-- Client Settings
DROP POLICY IF EXISTS "Clients can manage own settings" ON client_settings;
CREATE POLICY "Clients can manage own settings" ON client_settings
    USING (client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()))
    WITH CHECK (client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()));
