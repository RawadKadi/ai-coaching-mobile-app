# 🔧 **DEBUGGING TEAM WELCOME SCREEN**

## 🐛 **ISSUE:**
Sub-coach was added but welcome screen didn't appear.

## ✅ **FIXES APPLIED:**

1. **Added extensive console logging** - Check Metro console
2. **Added timing delays** - Ensures router is ready
3. **Better error handling** - Shows what's failing

---

## 🧪 **HOW TO DEBUG:**

### **Step 1: Check Console Logs**

**Open Metro bundler console** and look for:

```
[TeamInvitationMonitor] Rendered with coach: <uuid>
[TeamInvitationMonitor] Setting up for coach: <uuid>
[TeamInvitationMonitor] Checking for pending invitations...
[TeamInvitationMonitor] Query result: { data: {...}, error: null }
```

### **Step 2: Check Database**

**In Supabase → Table Editor → `coach_hierarchy`:**

Look for a record where:
- `child_coach_id` = sub-coach's UUID
- `acknowledged_at` = NULL (should be null!)
- `parent_coach_name` = parent coach's name

**If the record doesn't exist:**
- The sub-coach wasn't actually added
- Check `add_sub_coach` RPC

**If `acknowledged_at` is NOT null:**
- It was already acknowledged
- Delete the record or set to NULL to test again

### **Step 3: Manual Test Query**

Run this in Supabase SQL Editor (replace UUID):

```sql
SELECT 
  id,
  parent_coach_name,
  child_coach_id,
  acknowledged_at,
  created_at
FROM coach_hierarchy
WHERE child_coach_id = 'sub-coach-uuid-here'
  AND acknowledged_at IS NULL;
```

**Expected:** Should return the invitation record

---

## 🔍 **COMMON ISSUES:**

### **Issue 1: SQL Migration Not Run**
**Symptom:** Column errors in console
**Fix:** Run `ADD_TEAM_ACKNOWLEDGMENT_FIELD.sql` in Supabase

### **Issue 2: Coach ID Not Available**
**Symptom:** Console shows "No coach ID yet"
**Fix:** Wait for auth to load (already handled with delay)

### **Issue 3: Already Acknowledged**
**Symptom:** No logs appear
**Fix:** Check database - `acknowledged_at` might be set

### **Issue 4: Real-Time Not Connected**
**Symptom:** "Subscription status: SUBSCRIBED" missing
**Fix:** Check internet, Supabase settings

---

## 🧪 **TESTING STEPS:**

### **Test 1: Fresh Add (Clean State)**

1. **Database:** Delete any existing records for this sub-coach
   ```sql
   DELETE FROM coach_hierarchy 
   WHERE child_coach_id = 'sub-coach-uuid';
   ```

2. **Sub-Coach App:** 
   - Open app and login
   - Check console for monitor logs

3. **Parent Coach App:**
   - Add sub-coach via email
   - Tap "Add to Team"

4. **Sub-Coach App:**
   - **SHOULD SEE:**
     - Console: "🔥 Real-time invitation detected!"
     - Screen switches to welcome page

### **Test 2: Already Added (Check on Login)**

1. **Database:** Ensure record exists with `acknowledged_at = NULL`
   ```sql
   UPDATE coach_hierarchy 
   SET acknowledged_at = NULL
   WHERE child_coach_id = 'sub-coach-uuid';
   ```

2. **Sub-Coach:** Sign out completely

3. **Sub-Coach:** Sign back in

4. **SHOULD SEE:**
   - Console: " Found unacknowledged invitation!"
   - Welcome screen appears after 1 second

---

## 📊 **CONSOLE LOG GUIDE:**

### **Normal Flow (Working):**
```
[TeamInvitationMonitor] Rendered with coach: abc-123
[TeamInvitationMonitor] Setting up for coach: abc-123
[TeamInvitationMonitor] Subscribing to real-time updates...
[TeamInvitationMonitor] Subscription status: SUBSCRIBED
[TeamInvitationMonitor] Checking for pending invitations...
[TeamInvitationMonitor] Query result: { data: {...}, error: null }
[TeamInvitationMonitor] ✅ Found unacknowledged invitation!
[TeamInvitationMonitor] Navigating to welcome screen...
```

### **No Invitation (Normal):**
```
[TeamInvitationMonitor] Rendered with coach: abc-123
[TeamInvitationMonitor] Checking for pending invitations...
[TeamInvitationMonitor] Query result: { data: null, error: null }
[TeamInvitationMonitor] No pending invitations found
```

### **Error (Something Wrong):**
```
[TeamInvitationMonitor] Error checking invitation: {...}
```

---

## 🚀 **QUICK FIX CHECKLIST:**

- [ ] Run `ADD_TEAM_ACKNOWLEDGMENT_FIELD.sql` in Supabase
- [ ] Reload app on sub-coach device
- [ ] Check Metro console for logs
- [ ] Verify database record exists
- [ ] Ensure `acknowledged_at` is NULL
- [ ] Test adding sub-coach again

---

## ⚡ **IMMEDIATE ACTIONS:**

**Right Now:**

1. **Reload the app** (shake → reload)
2. **Watch Metro console** for logs
3. **Add sub-coach again**
4. **Check console** - you should see logs!

**The extensive logging will tell us exactly what's happening!**

---

**Last Updated:** January 8, 2026 at 12:10  
**Status:** Debug version deployed with logging
