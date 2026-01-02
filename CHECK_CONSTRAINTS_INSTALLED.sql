-- Check if constraints are actually installed
SELECT 
  proname as function_name,
  pg_get_functiondef(oid) as definition
FROM pg_proc 
WHERE proname IN ('prevent_session_violations', 'check_session_overlap', 'check_client_daily_limit');

-- Check if trigger exists
SELECT 
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'enforce_session_rules';

-- If nothing shows up, the constraints were NEVER applied!
-- You MUST run ULTIMATE_TRIGGER_FIX.sql in Supabase SQL Editor!