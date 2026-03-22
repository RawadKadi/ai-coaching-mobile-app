-- ============================================
-- ONE-STEP V2 SETUP (EASIEST METHOD)
-- ============================================
-- Just replace the email and run this entire script!

DO $$
DECLARE
  v_coach_id UUID;
  v_brand_id UUID;
  v_user_id UUID;
  v_email TEXT := 'rawad182002@hotmail.com'; -- ✅ YOUR EMAIL IS HERE
BEGIN
  -- Get user ID from auth.users
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = v_email;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found with email: %', v_email;
  END IF;
  
  RAISE NOTICE 'Found user_id: %', v_user_id;
  
  -- Get coach record
  SELECT id INTO v_coach_id
  FROM coaches
  WHERE user_id = v_user_id;
  
  IF v_coach_id IS NULL THEN
    RAISE EXCEPTION 'No coach record found. Are you sure this is a coach account?';
  END IF;
  
  RAISE NOTICE 'Found coach_id: %', v_coach_id;
  
  -- Check if brand already exists
  IF EXISTS (SELECT 1 FROM coaches WHERE id = v_coach_id AND brand_id IS NOT NULL) THEN
    RAISE NOTICE '⚠️  Coach already has a brand! Skipping brand creation.';
    SELECT brand_id INTO v_brand_id FROM coaches WHERE id = v_coach_id;
  ELSE
    -- Create new brand
    INSERT INTO brands (name, logo_url, primary_color, secondary_color)
    VALUES ('Elite Coaching', NULL, '#3B82F6', '#10B981')
    RETURNING id INTO v_brand_id;
    
    RAISE NOTICE 'Created new brand_id: %', v_brand_id;
  END IF;
  
  -- Update coach with V2 fields
  UPDATE coaches
  SET 
    brand_id = v_brand_id,
    is_parent_coach = TRUE,
    can_manage_brand = TRUE
  WHERE id = v_coach_id;
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ SUCCESS! V2 SETUP COMPLETE!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Coach Email: %', v_email;
  RAISE NOTICE 'Brand ID: %', v_brand_id;
  RAISE NOTICE 'Is Parent Coach: TRUE';
  RAISE NOTICE 'Can Manage Brand: TRUE';
  RAISE NOTICE '';
  RAISE NOTICE 'Now: Reload your app to see the changes!';
  RAISE NOTICE '========================================';
  
END $$;

-- Verify the setup
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
