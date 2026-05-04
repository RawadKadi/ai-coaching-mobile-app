-- Add missing columns to habits table and update RLS policies
DO $$ 
BEGIN
  -- Add category column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'habits' AND column_name = 'category'
  ) THEN
    ALTER TABLE habits ADD COLUMN category text;
  END IF;

  -- Add verification_type column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'habits' AND column_name = 'verification_type'
  ) THEN
    ALTER TABLE habits ADD COLUMN verification_type text DEFAULT 'none';
  END IF;
END $$;

-- Create an index for category searches if not exists
CREATE INDEX IF NOT EXISTS idx_habits_category ON habits(category);

-- Update RLS policies to allow coaches to manage habits for their clients
DROP POLICY IF EXISTS "Coaches can manage their clients habits" ON habits;
CREATE POLICY "Coaches can manage their clients habits"
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

-- Force schema cache reload (Supabase specific hint)
NOTIFY pgrst, 'reload schema';
