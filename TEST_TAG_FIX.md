# TEST PROCEDURE - Tag Update Fix

## What Was Fixed

1. Removed optimistic updates (they were causing race conditions)
2. Added comprehensive console logging
3. Ensured `loadClientData()` is called after EVERY database update
4. Database update now explicitly sets: `invite_sent: true` AND `status: 'proposed'`

## How to Test

### Test 1: Option 1 (Propose New Time)
1. Open a client with a conflict
2. Click "Resolve" → Choose Option 1
3. Click "Send"
4. **Watch the console** - You should see:
   ```
   [ConflictResolution] onResolve called with: {action: 'propose_new_time_for_incoming'}
   [ConflictResolution] Option 1: updating session <session_id>
   [ConflictResolution] Option 1 success - invite_sent=true, status=proposed
   [ConflictResolution] Refreshing data...
   [ClientDetails] Fetched sessions: X
   [ClientDetails] Pending resolutions: Y
     - Session <session_id>: status=proposed, invite_sent=true, reason=null
   [PendingModal] Checking session <session_id>: status=proposed, invite_sent=true, reason=null
     -> Pending (Option 1 or general proposal)
   ```
5. **Expected Result**: Tag changes from "Not Yet Sent" to "Pending" (Yellow)

### Test 2: Option 2 (Ask Client to Reschedule)
1. Open a client with a conflict
2. Click "Resolve" → Choose Option 2
3. Click "Send"
4. **Watch the console** - You should see:
   ```
   [ConflictResolution] Option 2: updating session <session_id>
   [ConflictResolution] Option 2 success - invite_sent=true, cancellation_reason set
   [PendingModal] Checking session <session_id>: status=scheduled, invite_sent=true, reason=pending_reschedule_for_...
     -> Pending (Option 2)
   ```
5. **Expected Result**: Tag shows "Pending" (Yellow)

## If Tag Still Shows "Not Yet Sent"

Look at the console logs and check:

1. **Is the database update successful?**
   - Look for: `[ConflictResolution] Option X success`
   - If you see an error instead, the database update failed

2. **Is invite_sent being set?**
   - Look for: `invite_sent=true` in the ClientDetails logs
   - If you see `invite_sent=false` or `invite_sent=null`, the column doesn't exist (run the SQL!)

3. **Is the modal receiving the updated data?**
   - Look for: `[PendingModal] Checking session...`
   - Compare the values in ClientDetails vs PendingModal
   - They should match exactly

## Common Issues

### Issue: invite_sent is null/undefined
**Cause**: SQL script wasn't run
**Fix**: Run `RUN_THIS_IN_SUPABASE.sql` in Supabase SQL Editor

### Issue: Status is pending_resolution instead of proposed
**Cause**: Database update is failing silently
**Fix**: Check for error in console: `[ConflictResolution] Error updating session:`

### Issue: Modal doesn't refresh
**Cause**: Real-time subscription not working or loadClientData not being called
**Fix**: Check console for `[ConflictResolution] Refreshing data...`
