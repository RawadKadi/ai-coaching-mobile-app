-- Add category column to habits table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'habits' AND column_name = 'category'
  ) THEN
    ALTER TABLE habits ADD COLUMN category text;
  END IF;
END $$;

-- Create an index for category searches
CREATE INDEX IF NOT EXISTS idx_habits_category ON habits(category);
