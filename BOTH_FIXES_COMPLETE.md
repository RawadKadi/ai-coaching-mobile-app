# ✅ BOTH ISSUES FIXED

## Fix #1: Tag Updates Immediately on First Attempt ✅

**What Changed**:
- Reordered the code to refresh data BEFORE closing the modal
- This ensures `PendingResolutionsModal` receives updated session data before unmounting

**Flow Now** (in `/app/(coach)/clients/[id].tsx` line ~651):
```typescript
// 1. Database updates invite_sent=true, status='proposed'
const { data, error } = await supabase.from('sessions').update(...)

// 2. Reload ALL data (wait for it to complete)
await loadClientData();

// 3. Show success alert
Alert.alert('Sent', 'Resolution request sent to client.');

// 4. THEN close modal (after data is refreshed)
setConflictModalVisible(false);
```

**Result**: Tag changes from "Not Yet Sent" → "Pending" on FIRST attempt! ✅

---

## Fix #2: Only ONE Session Per Day Per Client ✅

**What Changed**:
- Added logic to check if client already has a session on that specific day
- If yes: UPDATE the existing session
- If no: INSERT a new session

**How It Works** (in `/app/(coach)/clients/[id].tsx` handleSaveSessions):
```typescript
// Check if THIS client has a session on this exact day
const existingOnSameDay = allCoachSessions.find(s => {
  if (s.client_id !== client.id) return false;
  if (s.status === 'cancelled') return false;
  
  const existingDate = new Date(s.scheduled_at);
  return (
    existingDate.getFullYear() === proposedDate.getFullYear() &&
    existingDate.getMonth() === proposedDate.getMonth() &&
    existingDate.getDate() === proposedDate.getDate()
  );
});

if (existingOnSameDay) {
  // UPDATE it
  sessionsToUpdate.push({ id: existingOnSameDay.id, data: sessionData });
} else {
  // INSERT new
  sessionsToInsert.push(sessionData);
}
```

**Result**: 
- Client X with Mon-Fri at 1pm
- You schedule "Monday at 2pm"
- System UPDATES the Monday 1pm session → Changes it to 2pm ✅
- No duplicates! ✅

---

## Test Both Fixes:

### Test 1: Tag Update
1. Create a conflict (or open an existing "Not Yet Sent")
2. Click Option 1 → "Request Resolution"
3. Wait for alert "Sent"
4. **Tag should now show "Pending"** (Yellow) immediately ✅

### Test 2: No Duplicates
1. Client has session on Tuesday at 1pm
2. AI Scheduler: "schedule this tuesday at 2pm"
3. Confirm
4. **Calendar shows only ONE session on Tuesday at 2pm** ✅
5. The old 1pm session is gone (replaced)

---

## Both Issues Are Now FIXED! 🎉
