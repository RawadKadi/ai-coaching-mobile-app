-- Allow clients to view their assigned coaches
-- This policy was missing from the previous RLS fix

CREATE POLICY "Clients can view their coaches"
  ON coaches FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM coach_client_links ccl
      JOIN clients c ON c.id = ccl.client_id
      WHERE ccl.coach_id = coaches.id
      AND c.user_id = auth.uid()
      AND ccl.status = 'active'
    )
  );
