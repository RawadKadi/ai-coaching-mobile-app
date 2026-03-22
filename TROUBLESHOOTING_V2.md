# 🔧 TROUBLESHOOTING - WHY YOU DON'T SEE V2 CHANGES

## ❌ **Problem:**
You can't see any of the V2 changes (Brand Settings, Team Management, etc.) in your app.

## ✅ **Solution:**

Your coach account needs V2 database fields initialized. Here's how to fix it:

---

## **STEP 1: Initialize Your Coach for V2**

### **Option A: Using Supabase Dashboard (RECOMMENDED)**

1. **Open Supabase Dashboard**
   - Go to your project
   - Click "SQL Editor"
   - Click "New Query"

2. **Run Setup Script:**
   ```sql
   -- Find your coach email first
   SELECT id, email, full_name, role FROM profiles WHERE role = 'coach';
   ```
   
   Copy your email, then run:

   ```sql
   -- Replace YOUR_EMAIL with your actual email
   DO $$
   DECLARE
     v_coach_id UUID;
     v_brand_id UUID;
     v_user_id UUID;
   BEGIN
     -- Get user_id from email
     SELECT id INTO v_user_id
     FROM profiles
     WHERE email = 'YOUR_EMAIL@example.com' AND role = 'coach';
     
     -- Get coach_id
     SELECT id INTO v_coach_id
     FROM coaches
     WHERE user_id = v_user_id;
     
     -- Create brand
     INSERT INTO brands (name, logo_url, primary_color, secondary_color)
     VALUES ('My Coaching Brand', NULL, '#3B82F6', '#10B981')
     RETURNING id INTO v_brand_id;
     
     -- Update coach
     UPDATE coaches
     SET 
       brand_id = v_brand_id,
       is_parent_coach = TRUE,
       can_manage_brand = TRUE
     WHERE id = v_coach_id;
     
     RAISE NOTICE 'SUCCESS! Coach initialized for V2';
   END $$;
   ```

3. **Verify Setup:**
   ```sql
   SELECT 
     p.email,
     c.brand_id,
     c.is_parent_coach,
     c.can_manage_brand,
     b.name as brand_name
   FROM coaches c
   JOIN profiles p ON p.id = c.user_id
   LEFT JOIN brands b ON b.id = c.brand_id
   WHERE p.email = 'YOUR_EMAIL@example.com';
   ```

   **Expected Result:**
   - ✅ `brand_id`: UUID (not null)
   - ✅ `is_parent_coach`: TRUE
   - ✅ `can_manage_brand`: TRUE
   - ✅ `brand_name`: "My Coaching Brand"

---

### **Option B: Use Pre-Made Script**

1. Open `SETUP_V2_COACH.sql`
2. Replace `'YOUR_COACH_EMAIL@example.com'` with your actual email
3. Run the entire script in Supabase SQL Editor

---

## **STEP 2: Restart the App**

After running the setup script:

1. **Force reload the app:**
   - In your Expo app, shake device (or press Cmd+D on iOS simulator)
   - Tap "Reload"
   
   OR
   
   - In terminal, press `r` to reload
   
2. **Sign out and sign back in:**
   - Go to Profile tab
   - Tap "Sign Out"
   - Sign back in with your coach account

---

## **STEP 3: Verify V2 Features Appear**

After reloading, you should see:

✅ **In Profile Menu:**
- "Brand Settings" menu item (with yellow palette icon)
- "Team Management" menu item (with green users icon and "Parent" badge)

✅ **In Brand Settings:**
- Brand name input
- Logo upload button
- Color pickers
- Save button

✅ **In Team Management:**
- Brand statistics card
- "Add Sub-Coach" button
- Empty state (since you have no sub-coaches yet)

---

## **STEP 4: Still Not Working?**

### Check Terminal for Errors:

Look for:
- ❌ TypeScript errors
- ❌ Import errors
- ❌ Supabase connection errors

### Common Issues:

**1. "Brand Settings" not showing:**
- Coach doesn't have `brand_id` set
- Run setup script again

**2. "Team Management" not showing:**
- Coach doesn't have `is_parent_coach = TRUE`
- Run setup script again

**3. App crashes when opening Brand Settings:**
- Check terminal for errors
- Verify `BrandContext.tsx` exists
- Verify `app/_layout.tsx` has `<BrandProvider>`

**4. TypeScript errors:**
- Run: `npx expo start --clear`
- Delete `.expo` folder and restart

---

## **QUICK VERIFICATION CHECKLIST**

Run these queries to verify everything is set up:

```sql
-- 1. Check your coach record
SELECT 
  p.email,
  c.id as coach_id,
  c.brand_id,
  c.is_parent_coach,
  c.can_manage_brand
FROM coaches c
JOIN profiles p ON p.id = c.user_id
WHERE p.email = 'YOUR_EMAIL';

-- Expected: brand_id (UUID), is_parent_coach (TRUE), can_manage_brand (TRUE)

-- 2. Check your brand
SELECT * FROM brands WHERE id = (
  SELECT brand_id FROM coaches 
  WHERE user_id = (SELECT id FROM profiles WHERE email = 'YOUR_EMAIL')
);

-- Expected: One row with your brand details

-- 3. Verify RPC functions exist
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name IN (
  'create_brand',
  'update_brand',
  'add_sub_coach',
  'generate_invite_code',
  'get_sub_coaches'
);

-- Expected: 5 rows
```

---

## **DEBUGGING STEPS**

If still not working, run these commands:

```bash
# 1. Clear Expo cache
npx expo start --clear

# 2. Reinstall node modules (if needed)
rm -rf node_modules
npm install

# 3. Check for TypeScript errors
npx tsc --noEmit
```

---

## **WHAT YOU SHOULD SEE AFTER SETUP**

### **Profile Menu:**
```
┌─────────────────────────┐
│ Settings                │ ← Existing
├─────────────────────────┤
│ 🎨 Brand Settings       │ ← NEW!
│    • Manage             │
├─────────────────────────┤
│ 👥 Team Management      │ ← NEW!
│    • Parent             │
├─────────────────────────┤
│ AI Brain                │ ← Existing
├─────────────────────────┤
│ Sign Out                │ ← Existing
└─────────────────────────┘
```

### **Brand Settings Screen:**
- Upload logo button
- Brand name field
- Primary color picker
- Secondary color picker
- Preview section
- Save button

### **Team Management Screen:**
- Brand stats (0 sub-coaches, 0 clients)
- Empty state message
- "Add Sub-Coach" button

---

## **STILL HAVING ISSUES?**

Share:
1. What you see in the Profile menu
2. Any errors in terminal/console
3. Result of the verification query

I'll help debug further! 🔧
