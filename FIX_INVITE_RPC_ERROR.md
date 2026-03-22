# 🔧 **QUICK FIX: RPC Parameter Mismatch**

## ❌ **THE PROBLEM:**
```
Error: Could not find the function public.use_invite_code(p_invite_code)
Hint: Perhaps you meant to call public.use_invite_code(p_client_id, p_code)
```

The RPC function expects **2 parameters** but the app is only sending **1**.

---

## ✅ **SOLUTION (2-Step Fix):**

### **Step 1: Create/Fix RPC Function in Supabase**

1. Open **Supabase Dashboard**
2. Go to **SQL Editor**
3. Run the script: `CREATE_USE_INVITE_CODE_RPC.sql`
4. This creates the correct `use_invite_code(p_client_id, p_code)` function

---

### **Step 2: Update App Code**

**File:** `app/(auth)/signup.tsx`

**Find this (around line 115-119):**
```typescript
const { data, error } = await supabase.rpc('use_invite_code', {
  p_invite_code: inviteCode  // ❌ WRONG - only 1 parameter
});
```

**Replace with:**
```typescript
// Get the current user
const { data: { user } } = await supabase.auth.getUser();

if (!user) {
  throw new Error('User not found after signup');
}

// Get the client ID
const { data: clientData, error: clientError } = await supabase
  .from('clients')
  .select('id')
  .eq('user_id', user.id)
  .single();

if (clientError || !clientData) {
  throw new Error('Client record not found');
}

// ✅ CORRECT - 2 parameters
const { data, error } = await supabase.rpc('use_invite_code', {
  p_client_id: clientData.id,  // Client UUID
  p_code: inviteCode           // Invite code
});
```

---

## 🚀 **QUICK START:**

### **Right Now (Database Fix):**
1. Run `CREATE_USE_INVITE_CODE_RPC.sql` in Supabase
2. This fixes the database side immediately

### **Then (App Fix - Manual):**
Since auto-edit failed, manually update `signup.tsx`:
1. Open `app/(auth)/signup.tsx`
2. Go to line ~115
3. Replace the RPC call with the code above
4. Save

---

## 🧪 **TEST AGAIN:**

After both fixes:
1. Generate new invite code
2. Sign up new client with that code
3. Should see: **"Welcome! 🎉"**
4. Client should appear in coach's list ✅

---

## 📝 **WHAT THE FIX DOES:**

**Before:**
```
App sends: { p_invite_code: "ABC123" }
RPC expects: (p_client_id UUID, p_code TEXT)
Result: ❌ Parameter mismatch error
```

**After:**
```
App fetches client ID from database
App sends: { p_client_id: "uuid-123", p_code: "ABC123" }
RPC receives both parameters
Result: ✅ Client linked to coach!
```

---

**Start with the SQL script - that's the critical fix!** 🚀

Then manually update the TypeScript code when you can.
