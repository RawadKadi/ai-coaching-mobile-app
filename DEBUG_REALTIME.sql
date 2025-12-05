-- Debug Script: Run these queries in Supabase SQL Editor to diagnose issues

-- 1. Check if the trigger function exists
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname = 'auto_link_client_to_coach';
-- Expected: You should see the function

-- 2. Check if the trigger is attached to the clients table
SELECT tgname, tgrelid::regclass, tgfoid::regproc
FROM pg_trigger
WHERE tgname = 'trigger_auto_link_client';
-- Expected: You should see the trigger

-- 3. Check recent coach_client_links (to see if trigger fired)
SELECT * FROM coach_client_links
ORDER BY created_at DESC
LIMIT 5;
-- Expected: You should see recent links if clients signed up

-- 4. Check recent clients
SELECT c.id, c.user_id, p.full_name, c.created_at
FROM clients c
LEFT JOIN profiles p ON p.id = c.user_id
ORDER BY c.created_at DESC
LIMIT 5;
-- Expected: You should see the new client

-- 5. Check if clients are linked to coaches
SELECT 
    ccl.id,
    ccl.coach_id,
    ccl.client_id,
    c.user_id as client_user_id,
    p.full_name as client_name,
    ccl.created_at
FROM coach_client_links ccl
JOIN clients c ON c.id = ccl.client_id
LEFT JOIN profiles p ON p.id = c.user_id
ORDER BY ccl.created_at DESC
LIMIT 5;
-- Expected: Recent links with client names

-- 6. Check notifications table
SELECT * FROM notifications
ORDER BY created_at DESC
LIMIT 5;
-- Expected: You should see "New Client!" notifications

-- 7. Test the trigger manually (creates a test client)
-- UNCOMMENT TO RUN:
-- INSERT INTO clients (user_id) VALUES ('00000000-0000-0000-0000-000000000000');
-- Then check coach_client_links to see if a link was created
