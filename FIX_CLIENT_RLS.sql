-- Check current RLS policies on clients table
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'clients';

-- If the above shows restrictive policies, run this to fix:
-- This allows users to insert their own client record during signup

DROP POLICY IF EXISTS "Users can insert own client record" ON clients;
CREATE POLICY "Users can insert own client record"
ON clients
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Also ensure users can read their own client data
DROP POLICY IF EXISTS "Users can view own client record" ON clients;
CREATE POLICY "Users can view own client record"
ON clients
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Allow coaches to view their clients' records (already exists but just in case)
DROP POLICY IF EXISTS "Coaches can view their clients" ON clients;
CREATE POLICY "Coaches can view their clients"
ON clients
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM coach_client_links ccl
    JOIN coaches c ON c.id = ccl.coach_id
    WHERE ccl.client_id = clients.id
    AND c.user_id = auth.uid()
    AND ccl.status = 'active'
  )
);
