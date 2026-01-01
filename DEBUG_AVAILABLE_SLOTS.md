# DEBUG: Available Slots Showing Occupied Times

## To Debug This Issue:

1. Create a conflict (e.g., try to schedule Monday 1pm when it's already taken)
2. Open the browser console
3. Click "Request Resolution" → Choose Option 1
4. Look for logs starting with `[SlotFinder]`

## What to Look For:

The console should show something like:

```
[SlotFinder] 12:00:00 PM - AVAILABLE ✓
[SlotFinder] 12:30:00 PM - AVAILABLE ✓
[SlotFinder] 1:00:00 PM - OVERLAP with session at 1:00:00 PM (client: xxx, status: scheduled)
[SlotFinder] 1:30:00 PM - OVERLAP with session at 1:00:00 PM (client: xxx, status: scheduled)
[SlotFinder] 2:00:00 PM - AVAILABLE ✓
```

**If you see 1:00 PM marked as AVAILABLE**, that's the problem!

## Possible Causes:

1. **existingSessions is empty** - Check if `allCoachSessions` is being loaded correctly
2. **Date mismatch** - The session might be on a different day
3. **Status filtering** - The session might have a status that's being filtered out

## What To Check:

### Check 1: Are sessions being loaded?
Add this log in `/app/(coach)/clients/[id].tsx` around line 584:
```typescript
existingSessions={allCoachSessions}
console.log('[ClientDetails] Passing', allCoachSessions.length, 'sessions to scheduler');
```

### Check 2: Is the occupied session included?
Look at the logs and find the session that's at 1pm. Check:
- Is it in `allCoachSessions`?
- What is its `status`?
- What is its `scheduled_at` time?

### Check 3: Are dates matching?
The slot finder uses `isSameDay()` to check if sessions are on the same day. If there's a timezone issue, the dates might not match even though they should.

## Quick Fix Test:

Try this: Comment out line 61-63 in `time-slot-finder.ts` temporarily:
```typescript
// Must be same day
// if (!isSameDay(slotStart, sessionStart)) {
//     return false;
// }
```

If this makes the overlaps work, then there's a timezone/date matching issue.

---

**Paste the console logs here and I'll help debug!**
