-- ============================================
-- DIAGNOSE RPC ISSUE
-- ============================================

-- Step 1: Check if get_sub_coaches function exists
SELECT 
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines
WHERE routine_name = 'get_sub_coaches';

-- Expected: 1 row showing the function exists
-- If empty: Function doesn't exist, need to create it

-- Step 2: Check if the function has correct parameters
SELECT 
  parameter_name,
  data_type,
  parameter_mode
FROM information_schema.parameters
WHERE specific_name IN (
  SELECT specific_name 
  FROM information_schema.routines 
  WHERE routine_name = 'get_sub_coaches'
)
ORDER BY ordinal_position;

-- Expected: parameter_name = 'p_parent_coach_id', data_type = 'uuid', mode = 'IN'

-- Step 3: Try to manually call the function (replace with your coach ID)
SELECT * FROM get_sub_coaches('YOUR_COACH_ID_HERE');

-- If this fails, the function has an error
-- Copy the error message and share it
