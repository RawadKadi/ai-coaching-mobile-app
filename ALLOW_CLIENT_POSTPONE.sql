-- Allow clients to update their own sessions (e.g. to postpone)
DROP POLICY IF EXISTS "Clients can update their own sessions" ON sessions;

CREATE POLICY "Clients can update their own sessions"
ON sessions
FOR UPDATE
TO authenticated
USING (
  client_id = (SELECT id FROM clients WHERE user_id = auth.uid())
)
WITH CHECK (
  client_id = (SELECT id FROM clients WHERE user_id = auth.uid())
);
