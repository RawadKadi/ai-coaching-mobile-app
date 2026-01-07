# ⚠️ **IMPORTANT: BEFORE PUBLISHING TO APP STORE**

## 🔴 **ACTION REQUIRED**

Before you publish your app to the App Store/Play Store, you MUST re-enable the development mode check!

---

## 📝 **WHAT TO DO:**

### **File:** `app/(coach)/invite-client.tsx`

**CURRENT (Testing Mode):**
```typescript
const getInviteLink = () => {
  const PRODUCTION_DOMAIN = 'https://ai-coach-app-landing-page.vercel.app';
  
  // 🧪 TEMPORARILY DISABLED FOR TESTING
  // if (__DEV__) {
  //   return `coachingapp://signup?invite=${inviteCode}`;
  // }
  
  // Always use HTTPS link for testing
  return `${PRODUCTION_DOMAIN}/join/${inviteCode}`;
};
```

**CHANGE TO (Production Mode):**
```typescript
const getInviteLink = () => {
  const PRODUCTION_DOMAIN = 'https://ai-coach-app-landing-page.vercel.app';
  
  if (__DEV__) {
    // Development: Use custom scheme (works in dev builds)
    return `coachingapp://signup?invite=${inviteCode}`;
  } else {
    // Production: Use HTTPS link (works always!)
    return `${PRODUCTION_DOMAIN}/join/${inviteCode}`;
  }
};
```

---

## 🎯 **WHY THIS MATTERS:**

### **Current Setup (For Testing):**
- ✅ Always generates HTTPS links
- ✅ Easy to test with landing page
- ✅ Works in development (`npm run dev`)
- ❌ Will use HTTPS in development too (which is fine for now)

### **Production Setup (What You Need):**
- ✅ Development uses `coachingapp://` (for local testing)
- ✅ Production uses HTTPS (when published)
- ✅ Automatic switching based on environment

---

## 📋 **PRE-PUBLISH CHECKLIST:**

Before submitting to stores:

- [ ] Uncomment the `if (__DEV__)` block
- [ ] Verify HTTPS domain is correct
- [ ] Test that production link works
- [ ] Build production version
- [ ] Test on real device
- [ ] Verify invite flow works end-to-end
- [ ] Submit to App Store / Play Store

---

## 🧪 **FOR NOW (Testing):**

**You can keep it as is!** The current setup works perfectly for testing:
- Generates HTTPS links in development
- Easy to test with your landing page
- No issues for testing phase

---

## ⏰ **WHEN TO CHANGE:**

Change it back when:
1. You're ready to publish to stores
2. You want to test local development with custom schemes
3. You're building a production version for TestFlight

---

**REMEMBER:** Before publishing, restore the `__DEV__` check! ✅
