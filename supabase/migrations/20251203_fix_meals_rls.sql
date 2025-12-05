-- Fix RLS policies to allow coaches to view shared meals
-- This was missing from the upgrade script

-- 1. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Coaches can view shared meals of their clients" ON meals;
DROP POLICY IF EXISTS "Coaches can view ingredients of shared meals" ON meal_ingredients;

-- 2. Add policy for MEALS
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

-- 3. Add policy for MEAL INGREDIENTS
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
