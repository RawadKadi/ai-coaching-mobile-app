-- =====================================================
-- FIX COACH BRAND LINKAGE
-- Migration: 20260122_fix_coach_brand_linkage.sql
-- Description: Creates brands for coaches who don't have one and links them
-- =====================================================

-- Create brands for all coaches who don't have a brand_id
DO $$
DECLARE
  coach_record RECORD;
  new_brand_id UUID;
BEGIN
  FOR coach_record IN 
    SELECT c.id, c.user_id, p.full_name 
    FROM coaches c
    JOIN profiles p ON p.id = c.user_id
    WHERE c.brand_id IS NULL
  LOOP
    -- Create a new brand for this coach
    INSERT INTO brands (
      id,
      name,
      primary_color,
      secondary_color,
      accent_color,
      background_color,
      dark_mode_enabled,
      dark_background_color,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      COALESCE(coach_record.full_name, 'My Brand') || '''s Brand',
      '#3B82F6',  -- Default blue
      '#10B981',  -- Default green
      '#F59E0B',  -- Default amber
      '#0F172A',  -- Dark background (so clients see dark theme!)
      true,       -- Enable dark mode
      '#0F172A',  -- Dark background for dark mode
      NOW(),
      NOW()
    )
    RETURNING id INTO new_brand_id;

    -- Link the brand to the coach
    UPDATE coaches
    SET 
      brand_id = new_brand_id,
      can_manage_brand = true
    WHERE id = coach_record.id;

    RAISE NOTICE 'Created brand % for coach %', new_brand_id, coach_record.id;
  END LOOP;
END $$;

-- Verify the fix worked
SELECT 
  c.id as coach_id,
  p.full_name,
  c.brand_id,
  b.name as brand_name,
  b.background_color
FROM coaches c
JOIN profiles p ON p.id = c.user_id
LEFT JOIN brands b ON b.id = c.brand_id
ORDER BY c.created_at DESC
LIMIT 10;
