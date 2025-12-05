# Real-time Diagnostics Checklist

## Test Procedure

### Step 1: Verify Database Trigger
Run this in Supabase SQL Editor:
```sql
-- Check recent clients
SELECT c.id, c.user_id, p.full_name, c.created_at
FROM clients c
LEFT JOIN profiles p ON p.id = c.user_id
ORDER BY c.created_at DESC
LIMIT 3;
```
✅ **Expected:** You should see your newly signed up client

```sql
-- Check if they were auto-linked to a coach
SELECT 
    ccl.coach_id,
    ccl.client_id,
    p.full_name as client_name,
    ccl.created_at
FROM coach_client_links ccl
JOIN clients c ON c.id = ccl.client_id
LEFT JOIN profiles p ON p.id = c.user_id
ORDER BY ccl.created_at DESC
LIMIT 3;
```
✅ **Expected:** You should see a row with the new client linked to a coach
❌ **If empty:** The trigger didn't fire - check Step 2

### Step 2: Check Trigger Existence
```sql
SELECT tgname, tgrelid::regclass
FROM pg_trigger
WHERE tgname = 'trigger_auto_link_client';
```
✅ **Expected:** One row showing `trigger_auto_link_client | clients`
❌ **If empty:** Re-run the migration file

### Step 3: Check Coach ID
Open coach dashboard → Open browser console → Look for:
```
[Coach Dashboard] Setting up real-time subscription for coach: <SOME_UUID>
```
✅ **Expected:** You see a UUID
❌ **If you see `undefined`:** Coach object isn't loading properly

### Step 4: Check Subscription Status
In browser console, look for:
```
[Real-time] Subscription status: SUBSCRIBED
[Real-time] ✅ Successfully subscribed to new client notifications
```
✅ **Expected:** Both messages appear
❌ **If you see `CHANNEL_ERROR`:** Realtime isn't enabled on the table

### Step 5: Test Real-time Event
With coach dashboard open (console visible):
1. Sign up a new client on another device
2. **Look for in console:**
```
[Real-time] ✅ New client assigned! { ... }
[Real-time] Client ID: <UUID>
[Real-time] Client data fetched: { ... }
[Real-time] Showing modal for: <Client Name>
[Real-time] Refreshing dashboard stats...
```

### Common Issues & Fixes

**Issue:** No subscription status message
**Fix:** Check Supabase → Database → Replication → Ensure `coach_client_links` is enabled

**Issue:** Trigger exists but no rows in `coach_client_links`
**Fix:** Check if there are any active coaches:
```sql
SELECT id, user_id, is_active FROM coaches WHERE is_active = true LIMIT 5;
```
If empty, the trigger can't link to anyone.

**Issue:** Subscription says SUBSCRIBED but no events
**Fix:** The filter might be wrong. Check the coach_id in the database:
```sql
SELECT ccl.coach_id, ccl.client_id, c.user_id as coach_user_id
FROM coach_client_links ccl
JOIN coaches c ON c.id = ccl.coach_id
ORDER BY ccl.created_at DESC
LIMIT 3;
```
Compare the `coach_id` with the UUID in the console log.

**Issue:** Stats not updating
**Fix:** After you see the real-time event, manually refresh the page. If stats update then, it's a reactivity issue.
