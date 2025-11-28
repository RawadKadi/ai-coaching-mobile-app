-- ===================================================================
-- FIX: ALLOW COACHES TO MANAGE HABITS
-- ===================================================================

-- Add policy for coaches to manage habits (INSERT, UPDATE, DELETE)
-- Currently they only have SELECT permission via "Coaches can view their clients habits"

DROP POLICY IF EXISTS "Coaches can manage habits for their clients" ON habits;

CREATE POLICY "Coaches can manage habits for their clients"
  ON habits FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM coach_client_links ccl
      JOIN coaches co ON co.id = ccl.coach_id
      WHERE ccl.client_id = habits.client_id
      AND co.user_id = auth.uid()
      AND ccl.status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM coach_client_links ccl
      JOIN coaches co ON co.id = ccl.coach_id
      WHERE ccl.client_id = habits.client_id
      AND co.user_id = auth.uid()
      AND ccl.status = 'active'
    )
  );
