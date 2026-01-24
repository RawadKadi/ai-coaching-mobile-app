# 🚀 **PRODUCTION INVITE LINKS - COMPLETE GUIDE**

## 🎯 **GOAL:**

Create invite links that:
1. ✅ Work even if app isn't installed
2. ✅ Direct to App Store/Play Store if needed
3. ✅ Open app with invite code after install
4. ✅ Auto-assign client to coach

---

## 📱 **PRODUCTION LINK FORMAT:**

### **Instead of:**
```
coachingapp://signup?invite=ABC123  ← Only works if app installed
```

### **Use:**
```
https://yourcoachingapp.com/join/ABC123  ← Works always!
```

---

## 🏗️ **IMPLEMENTATION STEPS:**

### **STEP 1: Get a Domain (Required)**

You need a domain for your app:
- Option A: Buy domain (e.g., `joincoachapp.com`, `mycoaching.app`)
- Option B: Use subdomain (e.g., `invite.yoursite.com`)

**Cost:** $10-15/year

---

### **STEP 2: Create Landing Page (Web)**

Create a simple web page at `https://yourcoachingapp.com/join/:code`

**What it does:**
- Detects if user is on mobile
- Shows "Download App" button
- Links to App Store (iOS) or Play Store (Android)
- Preserves invite code in URL
- After install, opens app with code

**Tech Stack Options:**
- **Simple:** Vercel + Next.js (free hosting)
- **Easier:** Firebase Hosting + HTML page
- **Easiest:** Any static site host

---

### **STEP 3: Configure Universal Links**

#### **For iOS (Apple App Site Association):**

1. **Create file:** `apple-app-site-association` (no extension)
   ```json
   {
     "applinks": {
       "apps": [],
       "details": [
         {
           "appID": "TEAM_ID.com.coaching.app",
           "paths": ["/join/*"]
         }
       ]
     }
   }
   ```

2. **Host it at:**
   ```
   https://yourcoachingapp.com/.well-known/apple-app-site-association
   ```

3. **Update `app.json`:**
   ```json
   {
     "expo": {
       "ios": {
        "associatedDomains": ["applinks:yourcoachingapp.com"]
       }
     }
   }
   ```

---

#### **For Android (App Links):**

1. **Create file:** `assetlinks.json`
   ```json
   [{
     "relation": ["delegate_permission/common.handle_all_urls"],
     "target": {
       "namespace": "android_app",
       "package_name": "com.coaching.app",
       "sha256_cert_fingerprints": ["YOUR_SHA256"]
     }
   }]
   ```

2. **Host it at:**
   ```
   https://yourcoachingapp.com/.well-known/assetlinks.json
   ```

3. **Update `app.json`:**
   ```json
   {
     "expo": {
       "android": {
         "intentFilters": [{
           "action": "VIEW",
           "autoVerify": true,
           "data": [{
             "scheme": "https",
             "host": "yourcoachingapp.com",
             "pathPrefix": "/join"
           }]
         }]
       }
     }
   }
   ```

---

### **STEP 4: Update Invite Link Generation**

Update the code to generate HTTPS links instead of `coachingapp://`:

```typescript
// In invite-client.tsx
const getInviteLink = () => {
  if (__DEV__) {
    // Development: Use custom scheme
    return `coachingapp://signup?invite=${inviteCode}`;
  } else {
    // Production: Use Universal Link
    return `https://yourcoachingapp.com/join/${inviteCode}`;
  }
};
```

---

### **STEP 5: Handle Invite in App**

Update signup to handle both URL patterns:

```typescript
// In signup.tsx
useEffect(() => {
  // Handle: coachingapp://signup?invite=CODE
  if (params.invite) {
    setInviteCode(params.invite as string);
  }
  
  // Handle: https://yourcoachingapp.com/join/CODE
  const pathSegments = router.pathname.split('/');
  if (pathSegments.includes('join') && pathSegments[pathSegments.length - 1]) {
    setInviteCode(pathSegments[pathSegments.length - 1]);
  }
}, [params, router.pathname]);
```

---

## 🌐 **EXAMPLE LANDING PAGE:**

```html
<!DOCTYPE html>
<html>
<head>
  <title>Join [Coach Name]'s Coaching Program</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      text-align: center;
      padding: 40px 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
    }
    .container {
      max-width: 400px;
    }
    h1 { font-size: 32px; margin-bottom: 16px; }
    p { font-size: 18px; margin-bottom: 32px; opacity: 0.9; }
    .button {
      display: inline-block;
      padding: 16px 32px;
      background: white;
      color: #667eea;
      text-decoration: none;
      border-radius: 12px;
      font-weight: 600;
      font-size: 18px;
      margin: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    }
    .button:hover { transform: translateY(-2px); }
  </style>
</head>
<body>
  <div class="container">
    <h1>🏋️ You're Invited!</h1>
    <p>Download the app to join your coach's program</p>
    
    <a href="https://apps.apple.com/app/your-app" class="button" id="ios-button">
      📱 Download for iPhone
    </a>
    
    <a href="https://play.google.com/store/apps/details?id=com.coaching.app" class="button" id="android-button">
      🤖 Download for Android
    </a>
  </div>

  <script>
    // Get invite code from URL
    const code = window.location.pathname.split('/').pop();
    
    // Auto-redirect based on device
    const userAgent = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(userAgent);
    const isAndroid = /android/.test(userAgent);
    
    if (isIOS) {
      // Try to open app, fallback to App Store
      window.location.href = `coachingapp://signup?invite=${code}`;
      setTimeout(() => {
        window.location.href = `https://apps.apple.com/app/your-app?invite=${code}`;
      }, 1000);
    } else if (isAndroid) {
      // Try to open app, fallback to Play Store
      window.location.href = `coachingapp://signup?invite=${code}`;
      setTimeout(() => {
        window.location.href = `https://play.google.com/store/apps/details?id=com.coaching.app&invite=${code}`;
      }, 1000);
    }
    
    // Show appropriate button
    if (isIOS) {
      document.getElementById('android-button').style.display = 'none';
    } else if (isAndroid) {
      document.getElementById('ios-button').style.display = 'none';
    }
  </script>
</body>
</html>
```

---

## 🔄 **COMPLETE USER FLOW:**

### **Scenario 1: App Already Installed**
```
1. User clicks: https://yourcoachingapp.com/join/ABC123
2. iOS/Android recognizes domain
3. Opens app immediately
4. App navigates to: /signup with invite=ABC123
5. User signs up
6. Auto-assigned to coach ✅
```

### **Scenario 2: App NOT Installed**
```
1. User clicks: https://yourcoachingapp.com/join/ABC123
2. Opens web browser to landing page
3. Landing page shows:
   - "Download the app to join!"
   - App Store / Play Store button
4. User taps button → Installs app
5. User opens app
6. App receives invite code (from URL or deferred deep link)
7. Opens signup with invite=ABC123
8. User signs up
9. Auto-assigned to coach ✅
```

---

## 📊 **IMPLEMENTATION TIMELINE:**

### **Phase 1: MVP (Current - Works for Testing)**
- ✅ Custom scheme: `coachingapp://`
- ✅ Works if app installed
- ⚠️  Doesn't work if app not installed

### **Phase 2: Production (Before Launch)**
- ✅ Domain purchased
- ✅ Landing page created
- ✅ Universal Links configured
- ✅ Works with OR without app installed

### **Phase 3: Advanced (Post-Launch)**
- ✅ Deferred deep linking (Firebase Dynamic Links)
- ✅ Analytics tracking
- ✅ Smart banner on web page
- ✅ Branch.io or similar service

---

## 💰 **COSTS:**

| Item | Cost | Required? |
|------|------|-----------|
| Domain name | $10-15/year | ✅ Yes |
| Hosting (Vercel/Netlify) | Free | ✅ Yes |
| Apple Developer Account | $99/year | ✅ Yes (for App Store) |
| Google Play Account | $25 one-time | ✅ Yes (for Play Store) |
| Firebase Dynamic Links | Free | ❌ Optional |
| Branch.io | $0-299/month | ❌ Optional |

**Total Minimum:** ~$135/year

---

## 🚀 **QUICK START (Production):**

### **Week 1:**
1. Buy domain
2. Deploy landing page to Vercel
3. Test landing page works

### **Week 2:**
1. Create AASA file
2. Create assetlinks.json
3. Update app.json
4. Build production app
5. Submit to App Store / Play Store

### **Week 3:**
1. Test Universal Links
2. Verify invite flow end-to-end
3. Launch! 🎉

---

## 🎯 **RECOMMENDED APPROACH:**

For now (MVP):
- ✅ Keep `coachingapp://` for development
- ✅ Test with test screen
- ✅ Verify invite logic works

Before launch (Production):
- ✅ Set up domain + landing page
- ✅ Configure Universal Links
- ✅ Update link generation code
- ✅ Test with TestFlight / Internal Testing

---

## 📝 **SUMMARY:**

**Question:** Will link work if app not installed?

**Answer:**
- **Current (Dev):** ❌ No - `coachingapp://` only works if installed
- **Production (Universal Links):** ✅ Yes - Shows landing page → Install → Opens with invite

**To make it work:**
1. Get domain
2. Create landing page
3. Configure Universal Links
4. Update link generation

**Timeline:** 1-2 weeks before launch
**Cost:** ~$135/year
**Worth it:** ✅ Absolutely! Essential for growth.

---

**Want me to create the landing page template for you?** 🌐
