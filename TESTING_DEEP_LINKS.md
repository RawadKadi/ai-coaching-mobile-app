# 🧪 **TESTING DEEP LINK INVITES IN EXPO**

## ✅ **WHAT WE JUST SET UP:**

1. ✅ Configured Expo deep linking (scheme: `coachingapp://`)
2. ✅ Updated invite links to use: `coachingapp://signup?invite=CODE`
3. ✅ Added invite code handling in signup screen
4. ✅ Auto-validates invite when opened via link
5. ✅ Shows invite banner with validation status

---

## 🧪 **HOW TO TEST (STEP-BY-STEP)**

### **Step 1: Restart Expo** ⚠️ **IMPORTANT!**

The deep linking configuration requires a restart:

```bash
# Kill current process
Ctrl+C

# Restart Expo
npm run dev
```

Press `r` in terminal after it starts to reload.

---

### **Step 2: Generate an Invite**

1. Open your app
2. Go to: **Profile → Invite Client**
3. Set: Max uses = **Unlimited**
4. Set: Expires = **7** days
5. Tap **"Generate Invite Code"**
6. You'll see a code like: `ABC123XYZ`
7. **COPY THE LINK** (it should be: `coachingapp://signup?invite=ABC123XYZ`)

---

### **Step 3: Test the Deep Link**

#### **Option A: iOS Simulator**
```bash
# In a NEW terminal window (keep Expo running):
xcrun simctl openurl booted "coachingapp://signup?invite=ABC123XYZ"

# Replace ABC123XYZ with your actual code
```

#### **Option B: Android Emulator**
```bash
# In a NEW terminal:
adb shell am start -W -a android.intent.action.VIEW -d "coachingapp://signup?invite=ABC123XYZ"

# Replace ABC123XYZ with your actual code
```

#### **Option C: Physical Device**
1. Open Notes or Messages on your phone
2. Type or paste: `coachingapp://signup?invite=ABC123XYZ`
3. The link should become clickable (blue/underlined)
4. Tap it!

---

### **Step 4: What Should Happen**

When you click/open the link:

1. ✅ **App opens** (or switches if already open)
2. ✅ **Navigates to Signup screen**
3. ✅ **Shows invite banner** at top:
   - Green border if valid ✅
   - Red border if invalid ❌
4. ✅ **Displays invite code**
5. ✅ **Hides role selector** (client only for invites)
6. ✅ Alert pops up saying "Valid Invite!"

---

## 📝 **EXAMPLE TEST FLOW:**

```
1. Coach generates invite: ABC123
   Link: coachingapp://signup?invite=ABC123

2. Open link on simulator:
   xcrun simctl openurl booted "coachingapp://signup?invite=ABC123"

3. App opens → Signup screen
4. Banner shows:
   ┌─────────────────────────┐
   │ ✓ Valid Invite Code     │
   │ ABC123                  │
   └─────────────────────────┘

5. Alert: "Valid Invite! This invite code is valid..."

6. Fill in signup form (no role selector)

7. Complete signup

8. [Future] Auto-assigned to coach
```

---

## 🔧 **TROUBLESHOOTING:**

### **Link doesn't open app:**
```bash
# Restart Expo completely
Ctrl+C
npm run dev

# Try the link command again
```

### **"Invalid Invite" error:**
- Check the code was generated in database:
  ```sql
  SELECT * FROM coach_invites 
  WHERE code = 'YOUR_CODE'  
  ORDER BY created_at DESC;
  ```

### **App opens but doesn't navigate:**
- Check terminal logs for:
  ```
  [Signup] Invite code from deep link: ABC123
  ```
- If missing, deep link not working

### **Deep link opens Safari instead:**
For iOS:
- This is normal in simulator first time
- The next opens will go to app
- On real device it works immediately

---

## 📋 **TESTING CHECKLIST:**

- [ ] Generate invite code in app
- [ ] Copy the `coachingapp://` link
- [ ] Open link via terminal command
- [ ] App opens to signup screen
- [ ] Invite banner shows (green if valid)
- [ ] Alert confirms "Valid Invite!"
- [ ] Role selector is hidden
- [ ] Can complete signup
- [ ] Check terminal logs show invite code

---

## 🎯 **CURRENT LIMITATIONS (V2.0 MVP):**

1. **Auto-assignment NOT implemented yet**
   - Client signs up but isn't auto-linked to coach
   - This is Phase 2 (future work)

2. **Brand NOT auto-applied**
   - Client doesn't see coach's branding yet
   - This is Phase 2 (future work)

3. **Invite usage NOT tracked**
   - Code validates but doesn't increment usage
   - Need to add `use_invite_code` RPC call on signup
   - This is Phase 2 (future work)

---

## 🚀 **WHAT WORKS NOW:**

✅ Deep links open the app  
✅ Navigate to signup with invite parameter  
✅ Validate invite code  
✅ Show valid/invalid status  
✅ Pre-fill invite code  
✅ Lock role to client  

---

## 📱 **SHARE LINKS FOR TESTING:**

You can test sharing by:

1. **WhatsApp:** Share button → Choose WhatsApp → Sends link
2. **SMS:** Share button → Choose Messages → Sends link
3. **Email:** Share button → Choose Mail → Sends link
4. **Copy:** Copy button → Paste in Notes → Tap link

All should open the app with the invite code!

---

## 🔗 **DEEP LINK FORMAT:**

```
coachingapp://signup?invite=CODE

Where:
 - coachingapp:// = Your app scheme
 - signup = Route to open
 - ?invite=CODE = Query parameter with code
```

This is parsed by:
```typescript
const params = useLocalSearchParams();
const invite = params.invite; // Gets "CODE"
```

---

## ✅ **NEXT STEPS (Phase 2 - Future):**

To make invites FULLY work:

1. **Update signup to use invite:**
   ```typescript
   // After successful signup
   if (inviteCode) {
     await useInviteCode(inviteCode);
     // Links client to coach
     // Applies brand
   }
   ```

2. **Add universal links** (production):
   - https://yourapp.com/join/CODE
   - Works even if app not installed
   - Redirects to App Store/Play Store

3. **QR codes:**
   - Generate QR from invite link
   - Print for gyms/events
   - Scan → Opens app → Signup

But for now, **test with the deep link!** 🚀

---

**Try it now and let me know what happens!** 📱
