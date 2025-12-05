# Quick Fix for Duplicate Link Issue

## What Happened
The trigger fired but failed because the client was already linked to a coach (probably from a previous test). This caused:
1. The trigger to error out
2. The real-time subscription to close
3. Stats not updating

## Fix It Now

### Step 1: Run the Improved Trigger
1. Open Supabase SQL Editor
2. Run the entire file: `20241204_auto_link_clients_v2.sql`
3. This version handles duplicates gracefully

### Step 2: Clean Up Existing Bad Links (Optional)
Run this to see all coach-client links:
```sql
SELECT ccl.*, p.full_name as client_name
FROM coach_client_links ccl
JOIN clients c ON c.id = ccl.client_id
LEFT JOIN profiles p ON p.id = c.user_id
ORDER BY ccl.created_at DESC;
```

If you see duplicate or test links, delete them:
```sql
DELETE FROM coach_client_links 
WHERE id = 'PASTE_BAD_LINK_ID_HERE';
```

### Step 3: Test with a FRESH Client
1. **Use a completely new email** (not one you've tried before)
2. Sign up as a client
3. Watch the coach dashboard console
4. You should see:
   - `[Real-time] ✅ New client assigned!`
   - Modal pops up

### Why It Failed Before
- Client ID `150250e4-7e6a-466e-a196-c549032fcb94` was already in `coach_client_links`
- Trigger tried to insert duplicate → Error → Subscription closed
- New trigger checks for existing links first
