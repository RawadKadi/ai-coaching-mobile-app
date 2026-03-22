-- ============================================
-- FIXED V2 SETUP SCRIPT
-- ============================================
-- This version works with your actual schema

-- Step 1: Find your user ID first
SELECT 
  au.id,
  au.email,
  p.full_name,
  p.role
FROM auth.users au
JOIN profiles p ON p.id = au.id
WHERE au.email = 'rawad182002@hotmail.com';

-- Copy the ID from above, then run this:

-- Step 2: Setup V2 for your coach (replace the ID in WHERE clause)
DO $$
DECLARE
  v_coach_id UUID;
  v_brand_id UUID;
  v_user_id UUID := 'PASTE_YOUR_ID_HERE'; -- ⚠️ PASTE THE ID FROM STEP 1
BEGIN
  -- Get coach record
  SELECT id INTO v_coach_id 
  FROM coaches 
  WHERE user_id = v_user_id;
  
  IF v_coach_id IS NULL THEN
    RAISE EXCEPTION 'No coach record found for this user';
  END IF;
  
  RAISE NOTICE 'Found coach_id: %', v_coach_id;
  
  -- Create brand
  INSERT INTO brands (name, logo_url, primary_color, secondary_color)
  VALUES ('My Coaching Brand', NULL, '#3B82F6', '#10B981')
  RETURNING id INTO v_brand_id;
  
  RAISE NOTICE 'Created brand_id: %', v_brand_id;
  
  -- Update coach with V2 fields
  UPDATE coaches
  SET 
    brand_id = v_brand_id,
    is_parent_coach = TRUE,
    can_manage_brand = TRUE
  WHERE id = v_coach_id;
  
  RAISE NOTICE '✅ SUCCESS! Coach initialized for V2';
  RAISE NOTICE 'brand_id: %', v_brand_id;
  RAISE NOTICE 'is_parent_coach: TRUE';
  RAISE NOTICE 'can_manage_brand: TRUE';
  
END $$;

-- Step 3: Verify setup
SELECT 
  au.email,
  p.full_name,
  c.id as coach_id,
  c.brand_id,
  c.is_parent_coach,
  c.can_manage_brand,
  b.name as brand_name,
  b.primary_color,
  b.secondary_color
FROM coaches c
JOIN profiles p ON p.id = c.user_id
JOIN auth.users au ON au.id = p.id
LEFT JOIN brands b ON b.id = c.brand_id
WHERE au.email = 'rawad182002@hotmail.com';
