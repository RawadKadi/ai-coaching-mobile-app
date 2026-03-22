# ✅ V2 ISSUES FIXED

## **Fixed Issues:**

### **1. RPC 400 Error** ✅
**Problem:** `get_sub_coaches` was returning 400 Bad Request

**Fix Applied:**
- Added null check for `coach.id` before calling RPC
- Improved error logging to show actual error messages
- Added better error handling

**File:** `app/(coach)/team/index.tsx`

---

### **2. iPhone Notch Overlap** ✅
**Problem:** UI elements were overlapping with iPhone camera/notch

**Fix Applied:**
All new V2 screens now wrapped in `SafeAreaView`:

✅ **Team Management** - `app/(coach)/team/index.tsx`  
✅ **Add Sub-Coach** - `app/(coach)/team/add.tsx`  
✅ **Brand Settings** - `app/(coach)/settings/branding.tsx`

---

## **What To Do Now:**

### **1. Run Setup Script**
Open `QUICK_V2_SETUP.sql` and run it in Supabase to initialize your coach account.

### **2. Reload App**
- Shake device → "Reload"
- OR press `r` in terminal
- OR sign out and back in

### **3. Check Terminal**
Look for these log messages when you open Team Management:
```
[TeamManagement] Loading sub-coaches for coach: <UUID>
[TeamManagement] Sub-coaches loaded: []
```

If you see an error instead, share the full error message!

---

## **Expected Behavior:**

✅ **Profile Menu Shows:**
- 🎨 Brand Settings
- 👥 Team Management (with "Parent" badge)

✅ **Team Management Screen:**
- No more notch overlap
- Shows "0 Sub-Coaches" (empty state)
- "Add Sub-Coach" button works
- No 400 error

✅ **Brand Settings:**
- No notch overlap
- All inputs work
- Logo upload functional
- Colors update preview

---

## **Still Getting Errors?**

Share:
1. The exact error message from terminal
2. What screen you're on
3. Screenshot if possible

I'll help debug! 🔧
