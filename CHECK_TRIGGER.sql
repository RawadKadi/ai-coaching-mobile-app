-- DIAGNOSTIC QUERIES - Run these in Supabase SQL Editor

-- 1. Check the most recent clients (including the one you just signed up)
SELECT c.id, c.user_id, p.full_name, c.created_at
FROM clients c
LEFT JOIN profiles p ON p.id = c.user_id
ORDER BY c.created_at DESC
LIMIT 3;
-- Expected: You should see the newly signed up client at the top

-- 2. Check if that client was linked to ANY coach
SELECT 
    ccl.id,
    ccl.coach_id,
    ccl.client_id,
    p.full_name as client_name,
    ccl.created_at
FROM coach_client_links ccl
JOIN clients c ON c.id = ccl.client_id
LEFT JOIN profiles p ON p.id = c.user_id
ORDER BY ccl.created_at DESC
LIMIT 5;
-- Expected: You should see the new client linked to a coach
-- If EMPTY: The trigger didn't fire!

-- 3. Check if you have any active coaches
SELECT id, user_id, is_active, created_at
FROM coaches
WHERE is_active = true
ORDER BY created_at ASC;
-- Expected: At least one row with your coach account
-- If EMPTY: No active coaches exist, so trigger can't link!

-- 4. Check your specific coach ID
SELECT id, user_id, is_active
FROM coaches
WHERE id = 'd770a4db-bf7a-4759-be4e-1166bd044383';
-- Expected: One row
-- If EMPTY: The coach object in your app has wrong ID!

-- 5. MANUAL TEST: Trigger the function directly
-- Replace CLIENT_ID with the actual ID from query #1
-- SELECT auto_link_client_to_coach_manual('PASTE_CLIENT_ID_HERE');
