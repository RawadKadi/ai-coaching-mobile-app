-- ============================================================================
-- DEBUGGING QUERIES FOR CHALLENGE ASSIGNMENT ISSUE
-- Run these queries in Supabase SQL Editor to diagnose the problem
-- ============================================================================

-- 1. Get coach and client IDs
SELECT 
    'Coach Info' as type,
    c.id as coach_id,
    p.id as user_id,
    au.email,
    p.full_name
FROM coaches c
JOIN profiles p ON c.user_id = p.id
JOIN auth.users au ON p.id = au.id
WHERE au.email = 'rawad182002@hotmail.com'

UNION ALL

SELECT 
    'Client Info' as type,
    cl.id as client_id,
    p.id as user_id,
    au.email,
    p.full_name
FROM clients cl
JOIN profiles p ON cl.user_id = p.id
JOIN auth.users au ON p.id = au.id
WHERE au.email = 'rawadkady@gmail.com';

-- ============================================================================
-- 2. Check coach-client relationship
SELECT 
    ccl.*,
    coach_au.email as coach_email,
    client_au.email as client_email
FROM coach_client_links ccl
JOIN coaches c ON ccl.coach_id = c.id
JOIN profiles coach_profile ON c.user_id = coach_profile.id
JOIN auth.users coach_au ON coach_profile.id = coach_au.id
JOIN clients cl ON ccl.client_id = cl.id
JOIN profiles client_profile ON cl.user_id = client_profile.id
JOIN auth.users client_au ON client_profile.id = client_au.id
WHERE coach_au.email = 'rawad182002@hotmail.com'
AND client_au.email = 'rawadkady@gmail.com';

-- ============================================================================
-- 3. Check all challenges for this client
SELECT 
    mc.id,
    mc.name,
    mc.status,
    mc.start_date,
    mc.end_date,
    mc.mode,
    mc.created_at,
    coach_au.email as coach_email,
    client_au.email as client_email,
    COUNT(sc.id) as sub_challenge_count
FROM mother_challenges mc
JOIN coaches c ON mc.coach_id = c.id
JOIN profiles coach_profile ON c.user_id = coach_profile.id
JOIN auth.users coach_au ON coach_profile.id = coach_au.id
JOIN clients cl ON mc.client_id = cl.id
JOIN profiles client_profile ON cl.user_id = client_profile.id
JOIN auth.users client_au ON client_profile.id = client_au.id
LEFT JOIN sub_challenges sc ON mc.id = sc.mother_challenge_id
WHERE client_au.email = 'rawadkady@gmail.com'
GROUP BY mc.id, coach_au.email, client_au.email
ORDER BY mc.created_at DESC;

-- ============================================================================
-- 4. Check today's sub-challenges for this client (what the client should see)
SELECT 
    sc.id,
    sc.name,
    sc.assigned_date,
    sc.completed,
    mc.id as mother_id,
    mc.name as mother_name,
    mc.status as mother_status,
    mc.start_date,
    mc.end_date,
    mc.mode
FROM sub_challenges sc
JOIN mother_challenges mc ON sc.mother_challenge_id = mc.id
JOIN clients cl ON mc.client_id = cl.id
JOIN profiles p ON cl.user_id = p.id
JOIN auth.users au ON p.id = au.id
WHERE au.email = 'rawadkady@gmail.com'
AND sc.assigned_date = CURRENT_DATE
ORDER BY sc.created_at;

-- ============================================================================
-- 5. Test the RPC function directly
-- Replace CLIENT_ID_HERE with the actual client ID from query #1
SELECT * FROM get_todays_sub_challenges(
    'CLIENT_ID_HERE'::uuid,  -- Replace with actual client ID
    CURRENT_DATE
);

-- ============================================================================
-- 6. Check if mode column exists and has values
SELECT 
    column_name,
    data_type,
    column_default
FROM information_schema.columns
WHERE table_name = 'mother_challenges'
AND column_name = 'mode';

-- ============================================================================
-- 7. Check for any RLS policy issues (run as authenticated user)
-- This shows what the actual RPC would return
SELECT count(*) as total_challenges
FROM mother_challenges mc
JOIN clients cl ON mc.client_id = cl.id
JOIN profiles p ON cl.user_id = p.id
JOIN auth.users au ON p.id = au.id
WHERE au.email = 'rawadkady@gmail.com';
