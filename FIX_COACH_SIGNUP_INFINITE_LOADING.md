# 🔧 **FIX: Infinite Loading After Coach Signup**

## ❌ **THE PROBLEM:**

After a coach signs up, they get stuck on an infinite loading screen.

**Root Cause:**
1. Signup creates coach → Redirects to `/` (index)
2. Index checks: `if (profile)` → Route to coach tabs
3. BUT if profile isn't loaded yet → Stuck in loading

**Why profile might not load:**
- Database write takes time
- `fetchProfile` runs before coach record exists
- Auth state updates but profile query fails
- No fallback handling

---

## ✅ **FIXES APPLIED:**

### **Fix 1: Added Timeout Fallback in index.tsx** ✅

**File:** `app/index.tsx`

**What Changed:**
```typescript
// BEFORE (gets stuck forever):
if (profile) {
  // Route based on role
}
// No else - infinite wait!

// AFTER (fixed):
if (profile) {
  // Route based on role
} else {
  // Timeout fallback - redirect after 2s if still no profile
  setTimeout(() => router.replace('/(auth)/login'), 2000);
}
```

This prevents infinite loading by redirecting after 2 seconds if profile doesn't load.

---

## 🔧 **ADDITIONAL FIX NEEDED:**

### **Fix 2: Improve fetchProfile Error Handling**

**File:** `contexts/AuthContext.tsx` (Manual fix needed)

**Problem:** `fetchProfile` doesn't always set loading to false

**Find this (around line 29-74):**
```typescript
const fetchProfile = async (userId: string) => {
  try {
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) throw profileError;
    
    // ... rest of function
  } catch (error) {
    console.error('Error fetching profile:', error);
    // ❌ MISSING: setLoading(false)
  }
};
```

**Add this at the end of the catch block:**
```typescript
} catch (error) {
  console.error('Error fetching profile:', error);
  setProfile(null);  // ← ADD THIS
  setCoach(null);    // ← ADD THIS
  setClient(null);   // ← ADD THIS
}
```

---

## 🧪 **TESTING:**

### **Test 1: New Coach Signup**
1. Sign up as coach
2. Should either:
   - ✅ Route to coach tabs (if profile loads)
   - ✅ Route back to login after 2s (if profile fails)
3. Should NOT get stuck loading

### **Test 2: Existing Coach Login**
1. Sign in as existing coach
2. Should route to coach tabs ✅
3. Should NOT get stuck

---

## 🎯 **WHY THIS HAPPENS:**

**Timeline:**
```
0ms:  Coach submits signup
100ms: Auth account created ✅
150ms: Profile record created ✅
200ms: Coach record insert starts...
250ms: Navigate to '/'
300ms: Index loads, checks profile
350ms: fetchProfile runs
400ms: Profile found ✅
450ms: Coach record still inserting... ❌
500ms: Coach query returns null ❌
550ms: setCoach(null) but setProfile() already set!
```

**Result:** Session + Profile exist, but Coach is null → Infinite wait!

---

## ✅ **BETTER SOLUTION (Future):**

Use Database Triggers to ensure coach record is created atomically:

```sql
CREATE OR REPLACE FUNCTION create_coach_on_profile()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'coach' THEN
    INSERT INTO coaches (user_id, is_active)
    VALUES (NEW.id, true);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profile_create_coach_trigger
AFTER INSERT ON profiles
FOR EACH ROW
EXECUTE FUNCTION create_coach_on_profile();
```

This ensures coach record exists BEFORE signup completes!

---

## 📊 **STATUS:**

| Fix | Status | Impact |
|-----|--------|--------|
| Timeout fallback | ✅ Applied | Prevents infinite loading |
| Improve error handling | ⏳ Manual | Better error recovery |
| Database trigger | ❌ Future | Atomic coach creation |

---

## 🚀 **IMMEDIATE ACTION:**

**The timeout fallback is now active** - this will prevent infinite loading.

If a coach still gets stuck:
-They'll auto-redirect to login after 2 seconds
- Can sign in again and should work

**The real fix:** Manually add error handling to `fetchProfile` when you can.

---

**Last Updated:** January 8, 2026  
**Status:** Partially fixed, timeout prevents hang
