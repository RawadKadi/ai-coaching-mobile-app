# ✅ **FIXED: Sub-Coach Email Lookup**

## ❌ **THE PROBLEM:**

Searching for sub-coach by email showed "Not Found" even though the coach account exists.

**Root Cause:** Email is stored in `auth.users` table, NOT in `profiles` or `coaches` tables!

The old code was:
```typescript
// ❌ WRONG - profiles table doesn't have email column!
await supabase
  .from('profiles')
  .select('id, full_name, email')  
  .eq('email', email)
```

---

## ✅ **THE FIX:**

### **Step 1: Create RPC Function** (REQUIRED!)

1. Open **Supabase → SQL Editor**
2. Run the script: `CREATE_FIND_COACH_BY_EMAIL_RPC.sql`

This creates a function that:
- Queries `auth.users` to find the email
- Gets the profile and coach records
- Returns all necessary data in one call

### **Step 2: Update App Code** ✅ (DONE!)

**File:** `app/(coach)/team/add.tsx`

**Changed to:**
```typescript
// ✅ CORRECT - Use RPC to search auth.users
const { data: searchResult } = await supabase
  .rpc('find_coach_by_email', { p_email: email });

if (searchResult.found) {
  // Coach found! ✅
}
```

---

## 🧪 **TEST IT:**

1. **Run SQL script in Supabase first!** (Critical!)
2. Reload your app
3. Try adding sub-coach with `sub2@hotmail.com`
4. Should find the coach now! ✅

---

## 📊 **WHY THIS HAPPENED:**

**Supabase Auth Structure:**
```
auth.users (hidden table)
├── id
├── email ← EMAIL IS HERE!
└── ...

profiles (public)
├── id (references auth.users.id)
├── full_name
├── role
└── NO EMAIL COLUMN! ❌

coaches
├── id
├── user_id (references auth.users.id)
└── NO EMAIL COLUMN! ❌
```

**Solution:** Use RPC with `SECURITY DEFINER` to query `auth.users` safely!

---

## ✅ **AFTER FIX:**

**Flow:**
```
1. Mother coach enters: sub2@hotmail.com
2. App calls: find_coach_by_email RPC
3. RPC queries: auth.users WHERE email = 'sub2@hotmail.com'
4. RPC returns: coach_id, user_id, brand_id, full_name
5. App shows: "Coach Found! ✅"
6. Add to team → Works! ✅
```

---

**RUN THE SQL SCRIPT NOW!** That's the critical fix! 🚀
