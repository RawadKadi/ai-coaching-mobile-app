-- ============================================
-- ADD: Team Invitation Acknowledgment Field
-- ============================================

-- Add field to track if sub-coach has seen the "welcome to team" message
ALTER TABLE coach_hierarchy
ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add field to store the brand name for display
ALTER TABLE coach_hierarchy
ADD COLUMN IF NOT EXISTS parent_coach_name TEXT;

COMMENT ON COLUMN coach_hierarchy.acknowledged_at IS 'When the sub-coach acknowledged being added to the team';
COMMENT ON COLUMN coach_hierarchy.parent_coach_name IS 'Name of the parent coach for display purposes';

-- Create function to update parent coach name when adding sub-coach
CREATE OR REPLACE FUNCTION update_parent_coach_name()
RETURNS TRIGGER AS $$
DECLARE
  v_parent_name TEXT;
BEGIN
  -- Get the parent coach's name
  SELECT p.full_name INTO v_parent_name
  FROM coaches c
  JOIN profiles p ON p.id = c.user_id
  WHERE c.id = NEW.parent_coach_id;
  
  -- Update the record
  NEW.parent_coach_name := v_parent_name;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS set_parent_coach_name_trigger ON coach_hierarchy;
CREATE TRIGGER set_parent_coach_name_trigger
BEFORE INSERT ON coach_hierarchy
FOR EACH ROW
EXECUTE FUNCTION update_parent_coach_name();

-- Grant permissions
GRANT UPDATE ON coach_hierarchy TO authenticated;
