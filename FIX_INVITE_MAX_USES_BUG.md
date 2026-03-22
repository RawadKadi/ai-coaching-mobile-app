# 🔧 **FIX: Invite Code Max Uses Race Condition**

## ❌ **THE BUG:**

**Problem:** Two users can sign up with the same invite code even when `max_uses = 1`

**Why:** Race condition between validation and usage:
```
User 1: Validates (uses: 0/1) ✅ → Fills form → Signs up → Increments (uses: 1/1) ✅
User 2: Validates (uses: 0/1) ✅ → Fills form → Signs up → Increments (uses: 2/1) ❌ SHOULD FAIL!
         ↑ Validates BEFORE User 1 increments!
```

---

## ✅ **THE FIX:**

### **Step 1: Run SQL Script** (Critical!)

1. Open **Supabase → SQL Editor**
2. Run: `FIX_INVITE_RACE_CONDITION.sql`

**What it does:**
- Makes increment **atomic** (check + increment in ONE query)
- Returns specific error codes: `max_uses_reached`, `expired`, `inactive`
- Prevents race conditions with `WHERE current_uses < max_uses`

---

### **Step 2: Update App Code** (Manual)

**File:** `app/(auth)/signup.tsx`

**Find lines ~143-158** (the invite code error handling):

```typescript
if (error) {
  console.error('[SignUpScreen] Invite code usage error:', error);
  Alert.alert(
    'Account Created',
    'Your account was created but there was an issue with the invite code. Please contact your coach.',
    [{ text: 'OK' }]
  );
} else {
  console.log('[SignUpScreen] Invite code used successfully:', data);
  Alert.alert(
    'Welcome! 🎉',
    'Your account has been created and you\'ve been added to your coach\'s program!',
    [{ text: 'Get Started' }]
  );
}
```

**Replace with:**

```typescript
if (error) {
  console.error('[SignUpScreen] Invite code usage error:', error);
  Alert.alert(
    'Account Created',
    'Your account was created but there was an issue with the invite code. Please contact your coach.',
    [{ text: 'OK' }]
  );
} else if (data && !data.success) {
  // RPC returned an error in the data
  console.error('[SignUpScreen] Invite code failed:', data);
  
  let errorTitle = 'Invite Code Error';
  let errorMessage = data.message || 'Could not use this invite code.';
  
  // Specific error handling
  if (data.error === 'max_uses_reached') {
    errorTitle = 'Code Already Used';
    errorMessage = 'This invite code has already been used the maximum number of times. Please ask your coach to generate a new invite code for you.';
  } else if (data.error === 'expired') {
    errorTitle = 'Code Expired';
    errorMessage = 'This invite code has expired. Please ask your coach for a new code.';
  } else if (data.error === 'inactive') {
    errorTitle = 'Code Inactive';
    errorMessage = 'This invite code has been deactivated. Please contact your coach.';
  }
  
  Alert.alert(errorTitle, errorMessage, [{ text: 'OK' }]);
} else {
  console.log('[SignUpScreen] Invite code used successfully:', data);
  Alert.alert(
    'Welcome! 🎉',
    'Your account has been created and you\'ve been added to your coach\'s program!',
    [{ text: 'Get Started' }]
  );
}
```

---

## 🧪 **HOW TO TEST:**

### **Test 1: Single Use Limit**
1. Generate invite with `max_uses = 1`
2. Copy the code
3. Sign up User 1 → Should succeed ✅
4. Try to sign up User 2 with SAME code → Should show error:
   ```
   "Code Already Used"
   "This invite code has already been used the maximum number of times..."
   ```

### **Test 2: Multiple Users (Race Condition)**
1. Generate invite with `max_uses = 1`
2. Open signup on TWO devices/browsers
3. Enter same code on BOTH at same time
4. Fill forms on BOTH
5. Submit BOTH
6. Result:
   - First to submit: ✅ Success
   - Second to submit: ❌ "Code Already Used"

---

## 📊 **WHAT CHANGED:**

### **Before (Broken):**
```sql
-- Validation
SELECT * FROM coach_invites WHERE code = 'ABC' AND current_uses < max_uses;
-- ✅ Returns valid (0 < 1)

... time passes, user fills form ...

-- Usage (much later)
UPDATE coach_invites SET current_uses = current_uses + 1 WHERE code = 'ABC';
-- ❌ Just increments, doesn't check limit!
```

**Problem:** Multiple users pass validation before ANY increment!

---

### **After (Fixed):**
```sql
-- Atomically check AND increment in ONE query
UPDATE coach_invites 
SET current_uses = current_uses + 1
WHERE code = 'ABC' 
  AND current_uses < max_uses  -- ← Only updates if under limit
RETURNING *;

-- If ROW_COUNT = 0, it means limit was reached!
```

**Solution:** Check and increment are atomic - only one can succeed!

---

## ✅ **SUCCESS CRITERIA:**

After the fix:
- [ ] Max uses = 1 → Only 1 client can sign up
- [ ] 2nd client gets clear error message
- [ ] Error says "ask your coach for new code"
- [ ] No race condition even with simultaneous signups

---

## 🎯 **PRIORITY:**

**HIGH** - This is a critical bug that affects invite system integrity!

Run the SQL fix ASAP, then update the app code when possible.

---

**Last Updated:** January 8, 2026
**Status:** Fix ready, needs deployment
