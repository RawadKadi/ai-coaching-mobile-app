-- Run this in your Supabase SQL Editor to fix the 403 Forbidden error when logging meals

-- 1. Drop existing policies to ensure a clean slate
DROP POLICY IF EXISTS "Clients can view own meals" ON meals;
DROP POLICY IF EXISTS "Clients can insert own meals" ON meals;
DROP POLICY IF EXISTS "Clients can update own meals" ON meals;

-- 2. Re-create the SELECT policy (allows clients to view their own meals)
CREATE POLICY "Clients can view own meals"
    ON meals FOR SELECT
    USING (
        client_id IN (
            SELECT id FROM clients WHERE user_id = auth.uid()
        )
    );

-- 3. Re-create the INSERT policy (allows clients to create new meals)
CREATE POLICY "Clients can insert own meals"
    ON meals FOR INSERT
    WITH CHECK (
        client_id IN (
            SELECT id FROM clients WHERE user_id = auth.uid()
        )
    );

-- 4. Re-create the UPDATE policy (allows clients to edit their own meals)
CREATE POLICY "Clients can update own meals"
    ON meals FOR UPDATE
    USING (
        client_id IN (
            SELECT id FROM clients WHERE user_id = auth.uid()
        )
    );
