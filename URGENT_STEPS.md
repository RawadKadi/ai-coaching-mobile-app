# URGENT: PLEASE READ AND FOLLOW THESE STEPS

## Step 1: Run SQL Script (IF YOU HAVEN'T DONE THIS YET)

**THIS IS THE ROOT CAUSE OF YOUR TAG ISSUE!**

1. Open Supabase Dashboard
2. Go to SQL Editor
3. Open the file: `RUN_THIS_IN_SUPABASE.sql`
4. Copy the entire contents
5. Paste into SQL Editor
6. Click **RUN**

If you see an error like "column invite_sent does not exist", that confirms you haven't run the script!

## Step 2: Clean Up Duplicate Sessions

The duplicate sessions you see were created BEFORE my fix. Run this SQL to delete duplicates:

```sql
-- Find and keep only the LATEST session per day per client
WITH ranked_sessions AS (
  SELECT 
    id,
    client_id,
    DATE(scheduled_at) as session_date,
    ROW_NUMBER() OVER (
      PARTITION BY client_id, DATE(scheduled_at) 
      ORDER BY created_at DESC
    ) as rn
  FROM sessions
  WHERE status != 'cancelled'
)
DELETE FROM sessions
WHERE id IN (
  SELECT id FROM ranked_sessions WHERE rn > 1
);
```

This will delete ALL duplicate sessions, keeping only the most recently created one for each day.

## Step 3: Test the Fixes

After running both SQL scripts:

1. **Test Tag Update**:
   - Create a new conflict
   - Click "Request Resolution"
   - Check console for
: `[ConflictResolution] ✅ DATABASE UPDATE SUCCESS`
   - Tag should show "Pending"

2. **Test No Duplicates**:
   - Schedule a session for a day that already has one
   - Confirm
   - Calendar should show only ONE session (the new one replacing the old one)

## Step 4: Provide Console Output

When you click "Request Resolution", paste the ENTIRE console output here. I need to see:
- `[ConflictModal] handleResolve called`
- `[ConflictResolution] ========== OPTION 1 START ==========`
- `[ConflictResolution] ✅ DATABASE UPDATE SUCCESS`
- `[ConflictResolution] Returned data: ...`

This will tell me exactly what's failing.

---

## Quick Checklist:

- [ ] Ran `RUN_THIS_IN_SUPABASE.sql` in Supabase SQL Editor
- [ ] Ran duplicate cleanup SQL above
- [ ] Tested creating a new resolution request
- [ ] Pasted console output here
