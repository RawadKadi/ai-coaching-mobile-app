# Real-time Setup Instructions

## Step 1: Run the Database Migration

1. Open your Supabase Dashboard: https://ieqccstmunvlmxsohhsa.supabase.co
2. Navigate to **SQL Editor** (left sidebar)
3. Click **New Query**
4. Copy the entire contents of `supabase/migrations/20241204_auto_link_clients.sql`
5. Paste it into the SQL editor
6. Click **Run** (or press Cmd/Ctrl + Enter)
7. **Expected Result:** "Success. No rows returned"

## Step 2: Enable Realtime on Tables

1. In Supabase Dashboard, go to **Database → Replication** (left sidebar)
2. Find the table `coach_client_links`
3. Toggle **ON** the switch next to it
4. Scroll to find `clients` table
5. Toggle **ON** the switch next to it

## Step 3: Verify the Setup

Run this query in SQL Editor to check if the trigger exists:
```sql
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname = 'auto_link_client_to_coach';
```

**Expected:** You should see a row with the function code.

## Step 4: Test Real-time

1. Open coach dashboard (Device 1)
2. Open browser console (F12 → Console tab)
3. Sign up a new client (Device 2 / Incognito)
4. **Look for logs in Device 1 console:**
   - `[Real-time] New client assigned!`
   - `Clients data: [...]`
5. **Expected:** Modal should pop up automatically

## Debugging

If still not working, check console for errors:
- ❌ `Error: relation "coach_client_links" does not exist` → Realtime not enabled
- ❌ `function auto_link_client_to_coach() does not exist` → Migration not run
- ✅ `[Real-time] New client assigned!` → Working!
