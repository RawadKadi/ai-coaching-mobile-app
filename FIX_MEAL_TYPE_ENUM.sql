-- ===================================================================
-- FIX: MEAL_TYPE ENUM AND RPC ERROR
-- ===================================================================
-- This script ensures the meal_type enum exists and fixes the RPC
-- create_meal_entry to handle the type casting correctly.
-- ===================================================================

BEGIN;

-- 1. Ensure the meal_type enum exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'meal_type') THEN
        CREATE TYPE meal_type AS ENUM ('breakfast', 'lunch', 'dinner', 'snack');
    END IF;
END $$;

-- 2. Update create_meal_entry RPC to be more robust
-- We use TEXT for the parameter and cast it to meal_type
CREATE OR REPLACE FUNCTION create_meal_entry(
    p_client_id UUID,
    p_meal_date DATE,
    p_meal_time TIME,
    p_meal_type TEXT,
    p_meal_name TEXT,
    p_description TEXT,
    p_calories NUMERIC,
    p_protein_g NUMERIC,
    p_carbs_g NUMERIC,
    p_fat_g NUMERIC,
    p_photo_url TEXT,
    p_ai_analyzed BOOLEAN,
    p_shared_with_coach BOOLEAN
)
RETURNS SETOF meals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Verify ownership
    IF NOT EXISTS (
        SELECT 1 FROM clients 
        WHERE id = p_client_id 
        AND user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Client ID % does not belong to the authenticated user %', p_client_id, auth.uid();
    END IF;

    RETURN QUERY
    INSERT INTO meals (
        client_id,
        meal_date,
        meal_time,
        meal_type,
        meal_name,
        description,
        calories,
        protein_g,
        carbs_g,
        fat_g,
        photo_url,
        ai_analyzed,
        shared_with_coach
    )
    VALUES (
        p_client_id,
        p_meal_date,
        p_meal_time,
        p_meal_type::meal_type, -- Cast to the enum
        p_meal_name,
        p_description,
        p_calories,
        p_protein_g,
        p_carbs_g,
        p_fat_g,
        p_photo_url,
        p_ai_analyzed,
        p_shared_with_coach
    )
    RETURNING *;
END;
$$;

-- 3. Grant permissions
GRANT EXECUTE ON FUNCTION create_meal_entry TO authenticated;

COMMIT;
