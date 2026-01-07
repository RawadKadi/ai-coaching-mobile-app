# 🎯 **AI COACHING APP - LANDING PAGE BUILD INSTRUCTIONS**

## 📌 **PROJECT OVERVIEW**

You are building a **landing page** for a mobile coaching app's invite system. This landing page serves as a bridge between coaches sharing invite links and clients downloading the mobile app.

---

## 🎯 **PRIMARY OBJECTIVE**

Create a simple, mobile-responsive landing page that:
1. Receives invite codes via URL parameters
2. Detects user's device (iOS/Android/Desktop)
3. Provides download links to App Store / Play Store
4. Preserves the invite code through the download→install→open flow
5. Handles cases where app is already installed vs not installed

---

## 📱 **THE MOBILE APP (Context)**

### **What It Is:**
- React Native mobile app built with Expo
- iOS + Android coaching/fitness app
- Coaches invite clients via unique codes
- Clients sign up and get automatically linked to their coach

### **Current State:**
- ✅ Fully functional invite system
- ✅ Can generate invite codes in app
- ✅ Can validate codes
- ✅ Links clients to coaches automatically
- ✅ Expects deep links in format: `coachingapp://signup?invite=CODE`

### **What Mobile App Expects:**
```
Deep Link Format: coachingapp://signup?invite=ABC123
                                         ↑↑↑↑↑↑
                                    The invite code
```

When the app receives this deep link:
1. Opens to signup screen
2. Auto-fills invite code: ABC123
3. Validates the code against database
4. Shows green banner: "✓ Valid Invite Code"
5. After signup, links client to coach automatically

---

## 🌐 **LANDING PAGE REQUIREMENTS**

### **URL Structure:**
```
https://your-domain.vercel.app/join/ABC123
                               ↑↑↑↑ ↑↑↑↑↑↑
                               Path  Invite Code
```

### **How It Works:**

**Step 1: Extract Invite Code**
```javascript
// From URL: https://your-domain.vercel.app/join/ABC123
const code = window.location.pathname.split('/').pop();
// code = "ABC123"
```

**Step 2: Detect Device**
```javascript
const userAgent = navigator.userAgent.toLowerCase();
const isIOS = /iphone|ipad|ipod/.test(userAgent);
const isAndroid = /android/.test(userAgent);
const isDesktop = !isIOS && !isAndroid;
```

**Step 3: Attempt Deep Link (If App Installed)**
```javascript
// Try to open the app
window.location.href = `coachingapp://signup?invite=${code}`;

// If app doesn't open in 1 second, redirect to store
setTimeout(() => {
  if (isIOS) {
    window.location.href = `https://apps.apple.com/app/your-app-id`;
  } else if (isAndroid) {
    window.location.href = `https://play.google.com/store/apps/details?id=com.coaching.app`;
  }
}, 1000);
```

---

## 📂 **FILE STRUCTURE**

Create a landing page with this structure:

```
coaching-app-landing/
├── public/
│   ├── index.html           ← Main landing page
│   ├── styles.css           ← Styling
│   ├── script.js            ← Logic for device detection & redirects
│   ├── assets/
│   │   ├── app-icon.png     ← App icon (512x512)
│   │   ├── logo.png         ← Brand logo
│   │   └── screenshots/     ← App screenshots (optional)
│   └── favicon.ico
├── .well-known/
│   ├── apple-app-site-association    ← iOS Universal Links
│   └── assetlinks.json               ← Android App Links
├── vercel.json              ← Deployment config
└── README.md
```

---

## 🎨 **LANDING PAGE DESIGN**

### **Requirements:**

1. **Mobile-First Responsive**
   - Must look perfect on phones (primary use case)
   - Support iPad/tablets
   - Desktop fallback (show QR code)

2. **Fast Loading**
   - No framework overhead (vanilla HTML/CSS/JS)
   - Optimized images
   - Inline critical CSS

3. **Clear Call-to-Action**
   - Large, prominent download button
   - Device-specific (auto-detect iOS vs Android)
   - Show both if unknown device

4. **Professional Branding**
   - Clean, modern design
   - Trust indicators
   - Coach/gym branding (if possible)

### **Visual Elements:**

**Header:**
- App logo/icon
- Coach's brand name (if available)
- Tagline: "Join [Coach Name]'s Coaching Program"

**Main Content:**
- Hero message: "You've Been Invited!"
- Brief description (2-3 sentences)
- Download buttons (iOS/Android)

**Footer:**
- Privacy policy link (optional)
- Contact info (optional)

---

## 💻 **CODE IMPLEMENTATION**

### **1. index.html**

**Requirements:**
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Join Coaching Program</title>
  
  <!-- SEO -->
  <meta name="description" content="Download the coaching app to join your program">
  <meta name="robots" content="noindex"> <!-- Don't index invite pages -->
  
  <!-- iOS Smart Banner (Optional) -->
  <meta name="apple-itunes-app" content="app-id=YOUR_APP_ID">
  
  <!-- Inline critical CSS for fast load -->
  <style>
    /* Critical styles here */
  </style>
  
  <link rel="stylesheet" href="styles.css">
  <link rel="icon" href="favicon.ico">
</head>
<body>
  <!-- Loading Indicator -->
  <div id="loading">
    <div class="spinner"></div>
    <p>Opening app...</p>
  </div>

  <!-- Main Content -->
  <div id="content" class="hidden">
    <div class="container">
      <!-- Logo -->
      <img src="assets/app-icon.png" alt="App Icon" class="app-icon">
      
      <!-- Headline -->
      <h1>You've Been Invited! 🎉</h1>
      <p class="subtitle">Download the app to join your coach's program</p>
      
      <!-- Invite Code Display -->
      <div class="code-display">
        <span class="label">Your Invite Code:</span>
        <span class="code" id="inviteCode">ABC123</span>
      </div>
      
      <!-- Download Buttons -->
      <div class="buttons">
        <a href="#" id="ios-button" class="btn btn-ios">
          <svg><!-- App Store Icon --></svg>
          Download for iPhone
        </a>
        
        <a href="#" id="android-button" class="btn btn-android">
          <svg><!-- Play Store Icon --></svg>
          Download for Android
        </a>
      </div>
      
      <!-- Desktop Message -->
      <div id="desktop-message" class="hidden">
        <p>Scan this QR code with your phone:</p>
        <div id="qr-code"></div>
        <p class="small">Or send yourself the link</p>
      </div>
      
      <!-- How It Works -->
      <div class="how-it-works">
        <h2>How It Works:</h2>
        <ol>
          <li>Download the app</li>
          <li>Open and create your account</li>
          <li>Your invite code will be pre-filled</li>
          <li>Complete signup to join!</li>
        </ol>
      </div>
    </div>
  </div>

  <script src="script.js"></script>
</body>
</html>
```

---

### **2. script.js**

**CRITICAL IMPLEMENTATION:**

```javascript
// ==========================================
// CONFIGURATION
// ==========================================

const CONFIG = {
  // Mobile App Deep Link Scheme
  APP_SCHEME: 'coachingapp://',
  
  // Store URLs (UPDATE THESE BEFORE PRODUCTION!)
  IOS_APP_STORE: 'https://apps.apple.com/app/your-app-id',
  ANDROID_PLAY_STORE: 'https://play.google.com/store/apps/details?id=com.coaching.app',
  
  // Fallback timeout (ms)
  DEEP_LINK_TIMEOUT: 1500,
};

// ==========================================
// MAIN LOGIC
// ==========================================

// Extract invite code from URL
function getInviteCodeFromURL() {
  const pathSegments = window.location.pathname.split('/');
  const code = pathSegments[pathSegments.length - 1];
  
  // Validate code format (alphanumeric, 10-20 chars)
  if (code && /^[a-z0-9]{10,20}$/i.test(code)) {
    return code;
  }
  
  return null;
}

// Detect device type
function detectDevice() {
  const ua = navigator.userAgent.toLowerCase();
  
  return {
    isIOS: /iphone|ipad|ipod/.test(ua),
    isAndroid: /android/.test(ua),
    isMobile: /iphone|ipad|ipod|android/.test(ua),
    isDesktop: !/iphone|ipad|ipod|android/.test(ua)
  };
}

// Attempt to open app via deep link
function attemptDeepLink(inviteCode, device) {
  const deepLinkURL = `${CONFIG.APP_SCHEME}signup?invite=${inviteCode}`;
  
  console.log('[Landing] Attempting deep link:', deepLinkURL);
  
  // Try to open the app
  window.location.href = deepLinkURL;
  
  // Set timeout to redirect to store if app doesn't open
  setTimeout(() => {
    console.log('[Landing] Deep link timeout, redirecting to store');
    redirectToStore(device);
  }, CONFIG.DEEP_LINK_TIMEOUT);
}

// Redirect to appropriate app store
function redirectToStore(device) {
  if (device.isIOS) {
    window.location.href = CONFIG.IOS_APP_STORE;
  } else if (device.isAndroid) {
    window.location.href = CONFIG.ANDROID_PLAY_STORE;
  } else {
    // Desktop: Don't redirect, show instructions
    showDesktopInstructions();
  }
}

// Show desktop-specific UI
function showDesktopInstructions() {
  document.getElementById('loading').classList.add('hidden');
  document.getElementById('content').classList.remove('hidden');
  document.getElementById('desktop-message').classList.remove('hidden');
  
  // Hide mobile buttons
  document.getElementById('ios-button').style.display = 'none';
  document.getElementById('android-button').style.display = 'none';
}

// Setup download buttons
function setupDownloadButtons(inviteCode, device) {
  const iosButton = document.getElementById('ios-button');
  const androidButton = document.getElementById('android-button');
  
  // iOS Button
  iosButton.href = CONFIG.IOS_APP_STORE;
  iosButton.onclick = (e) => {
    e.preventDefault();
    attemptDeepLink(inviteCode, { isIOS: true });
  };
  
  // Android Button
  androidButton.href = CONFIG.ANDROID_PLAY_STORE;
  androidButton.onclick = (e) => {
    e.preventDefault();
    attemptDeepLink(inviteCode, { isAndroid: true });
  };
  
  // Show/hide buttons based on device
  if (device.isIOS) {
    androidButton.style.display = 'none';
  } else if (device.isAndroid) {
    iosButton.style.display = 'none';
  }
}

// Main initialization
function init() {
  // Get invite code
  const inviteCode = getInviteCodeFromURL();
  
  if (!inviteCode) {
    // Invalid URL, show error
    document.getElementById('loading').innerHTML = `
      <h1>Invalid Invite Link</h1>
      <p>Please check your invite link and try again.</p>
    `;
    return;
  }
  
  // Display invite code
  document.getElementById('inviteCode').textContent = inviteCode;
  
  // Detect device
  const device = detectDevice();
  
  console.log('[Landing] Device:', device);
  console.log('[Landing] Invite Code:', inviteCode);
  
  // Setup buttons
  setupDownloadButtons(inviteCode, device);
  
  // Auto-attempt deep link for mobile
  if (device.isMobile) {
    attemptDeepLink(inviteCode, device);
  } else {
    // Desktop: Show content immediately
    showDesktopInstructions();
  }
}

// Run on page load
document.addEventListener('DOMContentLoaded', init);

// ==========================================
// OPTIONAL: Analytics
// ==========================================

function trackEvent(eventName, data) {
  // Add your analytics here (Google Analytics, Mixpanel, etc.)
  console.log('[Analytics]', eventName, data);
  
  // Example with Google Analytics:
  // if (window.gtag) {
  //   gtag('event', eventName, data);
  // }
}

// Track page view
trackEvent('landing_page_view', {
  invite_code: getInviteCodeFromURL(),
  device: detectDevice()
});
```

---

### **3. styles.css**

**Requirements:**
- Mobile-first responsive design
- Modern, clean aesthetic
- Fast-loading (<20KB)
- Accessibility compliant

```css
/* Reset & Base */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.container {
  max-width: 500px;
  width: 100%;
  text-align: center;
}

/* App Icon */
.app-icon {
  width: 120px;
  height: 120px;
  border-radius: 24px;
  margin-bottom: 24px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.3);
}

/* Typography */
h1 {
  font-size: 32px;
  font-weight: 700;
  margin-bottom: 12px;
  line-height: 1.2;
}

.subtitle {
  font-size: 18px;
  opacity: 0.9;
  margin-bottom: 32px;
}

/* Invite Code Display */
.code-display {
  background: rgba(255,255,255,0.2);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 32px;
}

.code-display .label {
  display: block;
  font-size: 14px;
  opacity: 0.8;
  margin-bottom: 8px;
}

.code-display .code {
  font-size: 24px;
  font-weight: 700;
  font-family: 'Courier New', monospace;
  letter-spacing: 2px;
}

/* Buttons */
.buttons {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 40px;
}

.btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 16px 24px;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  text-decoration: none;
  transition: transform 0.2s, box-shadow 0.2s;
}

.btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 25px rgba(0,0,0,0.2);
}

.btn-ios {
  background: #000;
  color: #fff;
}

.btn-android {
  background: #3DDC84;
  color: #000;
}

/* Loading */
#loading {
  text-align: center;
}

.spinner {
  width: 50px;
  height: 50px;
  border: 4px solid rgba(255,255,255,0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Utilities */
.hidden {
  display: none !important;
}

/* Responsive */
@media (max-width: 480px) {
  h1 { font-size: 28px; }
  .subtitle { font-size: 16px; }
  .app-icon { width: 100px; height: 100px; }
}
```

---

## 🔗 **UNIVERSAL LINKS CONFIGURATION**

### **For iOS: apple-app-site-association**

Create file: `.well-known/apple-app-site-association` (NO file extension!)

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

**IMPORTANT:**
- Replace `TEAM_ID` with actual Apple Team ID
- Replace `com.coaching.app` with actual bundle ID
- Host at: `https://your-domain.com/.well-known/apple-app-site-association`
- Must be served with `Content-Type: application/json`
- NO file extension

---

### **For Android: assetlinks.json**

Create file: `.well-known/assetlinks.json`

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.coaching.app",
    "sha256_cert_fingerprints": [
      "XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX"
    ]
  }
}]
```

**IMPORTANT:**
- Replace `com.coaching.app` with actual package name
- Replace fingerprint with actual SHA256 from Play Console
- Host at: `https://your-domain.com/.well-known/assetlinks.json`
- Must be served with `Content-Type: application/json`

---

## 🚀 **DEPLOYMENT TO VERCEL**

### **vercel.json Configuration:**

```json
{
  "cleanUrls": true,
  "trailingSlash": false,
  "redirects": [
    {
      "source": "/",
      "destination": "/join/example",
      "statusCode": 302
    }
  ],
  "headers": [
    {
      "source": "/.well-known/(.*)",
      "headers": [
        {
          "key": "Content-Type",
          "value": "application/json"
        },
        {
          "key": "Cache-Control",
          "value": "public, max-age=3600"
        }
      ]
    }
  ]
}
```

### **Deployment Steps:**

1. **Create Vercel Account** (free)
   - Go to vercel.com
   - Sign up with GitHub

2. **Push to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial landing page"
   git remote add origin https://github.com/yourusername/coaching-landing
   git push -u origin main
   ```

3. **Deploy:**
   - Import project in Vercel dashboard
   - Auto-deploys on every push
   - You get: `your-project.vercel.app`

4. **Custom Domain (Later):**
   - Buy domain (Namecheap, Google Domains, etc.)
   - Add to Vercel project
   - Point DNS records
   - Done!

---

## 🧪 **TESTING CHECKLIST**

### **Before Going Live:**

- [ ] Test on iOS (Safari)
- [ ] Test on Android (Chrome)
- [ ] Test on Desktop
- [ ] Verify invite code extraction
- [ ] Test deep link attempts
- [ ] Verify store redirects
- [ ] Check Universal Links (iOS)
- [ ] Check App Links (Android)
- [ ] Test with app installed
- [ ] Test without app installed
- [ ] Verify responsive design
- [ ] Check load speed (<2s)
- [ ] Test with different codes
- [ ] Verify analytics tracking

---

## 📊 **COMMUNICATION WITH MOBILE APP**

### **How Data Flows:**

```
┌─────────────────────────────────────────────────────────────┐
│  1. COACH GENERATES INVITE IN MOBILE APP                    │
│     → Creates code in Supabase: coach_invites table         │
│     → Code: ABC123, Coach ID: uuid-1234                     │
│     → Link: https://your-domain.vercel.app/join/ABC123      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  2. COACH SHARES LINK                                        │
│     → WhatsApp, Email, SMS, etc.                            │
│     → Link contains invite code                             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  3. CLIENT CLICKS LINK → LANDS ON YOUR PAGE                 │
│     → URL: https://your-domain.vercel.app/join/ABC123       │
│     → Your JavaScript extracts: ABC123                      │
│     → Detects device: iOS/Android/Desktop                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  4. YOUR PAGE ATTEMPTS DEEP LINK                            │
│     → Tries: coachingapp://signup?invite=ABC123             │
│                                                              │
│     IF APP INSTALLED:                                        │
│     → App opens ✅                                           │
│     → Goes to signup with code=ABC123                       │
│                                                              │
│     IF APP NOT INSTALLED:                                    │
│     → Timeout (1.5s) ⏱                                      │
│     → Redirect to App Store/Play Store                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  5. CLIENT DOWNLOADS & OPENS APP                            │
│     → Opens app for first time                              │
│     → App checks for invite code (multiple methods)         │
│     → Navigates to signup with code                         │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  6. CLIENT SIGNS UP IN MOBILE APP                           │
│     → Sees pre-filled code: ABC123                          │
│     → Validates against Supabase                            │
│     → Banner: "✓ Valid Invite Code"                         │
│     → Fills form and signs up                               │
│     → App calls: use_invite_code(ABC123)                    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  7. SUPABASE LINKS CLIENT TO COACH                          │
│     → Finds invite: SELECT * WHERE code = 'ABC123'          │
│     → Gets coach_id from invite                             │
│     → Updates client: invited_by = coach_id                 │
│     → Creates link: coach_client_links                      │
│     → Increments: invite usage counter                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  8. CLIENT IS NOW LINKED! ✅                                 │
│     → Client sees in coach's client list                    │
│     → Coach can assign challenges                           │
│     → Client sees coach's branding                          │
└─────────────────────────────────────────────────────────────┘
```

### **Critical Points:**

1. **Your landing page does NOT talk to Supabase**
   - You only extract and preserve the code
   - The mobile app validates the code
   - Supabase linking happens in the app

2. **The code is the ONLY connection**
   - Landing page → Passes code to app
   - App → Validates code with database
   - Database → Links client to coach

3. **You are a pass-through**
   - Input: URL with code
   - Process: Extract code, detect device, redirect
   - Output: User in app with code

---

## ⚠️ **IMPORTANT NOTES**

### **DO:**
- ✅ Keep it simple (vanilla HTML/CSS/JS)
- ✅ Make it FAST (<2s load time)
- ✅ Test on real devices
- ✅ Handle all edge cases
- ✅ Add loading states
- ✅ Make it mobile-responsive
- ✅ Use HTTPS (required for deep links)

### **DON'T:**
- ❌ Connect to Supabase (mobile app does this)
- ❌ Validate codes yourself (mobile app does this)
- ❌ Store user data
- ❌ Use heavy frameworks (React, Vue, etc.)
- ❌ Make it slow or complex
- ❌ Forget Universal Links files

---

## 📦 **DELIVERABLES**

When you're done, you should have:

1. ✅ `index.html` - Main landing page
2. ✅ `styles.css` - Styling
3. ✅ `script.js` - Logic
4. ✅ `.well-known/apple-app-site-association`
5. ✅ `.well-known/assetlinks.json`
6. ✅ `vercel.json` - Deployment config
7. ✅ `README.md` - Documentation
8. ✅ Assets folder (icons, images)

**Deployed to:**
- Vercel: `your-project.vercel.app`
- Works with `/join/CODE` URLs
- Ready for custom domain later

---

## 🎯 **SUCCESS CRITERIA**

Landing page is successful if:

1. ✅ Loads in <2 seconds
2. ✅ Extracts invite code correctly
3. ✅ Detects device accurately
4. ✅ Attempts deep link on mobile
5. ✅ Redirects to correct store
6. ✅ Mobile app receives code
7. ✅ Client can complete signup
8. ✅ Client links to correct coach
9. ✅ Works on iOS, Android, Desktop
10. ✅ Professional, branded appearance

---

## 🔧 **PRODUCTION CHECKLIST**

Before going live:

- [ ] Update `IOS_APP_STORE` URL (when app is in App Store)
- [ ] Update `ANDROID_PLAY_STORE` URL (when app is in Play Store)
- [ ] Update `TEAM_ID` in AASA file
- [ ] Update package name in assetlinks
- [ ] Add actual SHA256 fingerprint
- [ ] Add analytics tracking
- [ ] Test on multiple devices
- [ ] Verify SSL certificate (HTTPS)
- [ ] Test Universal Links work
- [ ] Add custom domain (optional)
- [ ] Monitor error logs

---

## 📞 **SUPPORT & UPDATES**

### **When Mobile App Updates:**

If the mobile app changes the deep link format, you need to update:
```javascript
// In script.js, line ~35
const deepLinkURL = `${CONFIG.APP_SCHEME}signup?invite=${inviteCode}`;
//                                         ↑↑↑↑↑↑
//                      Update this if mobile app changes routes
```

### **When Store URLs Change:**

Update these in script.js:
```javascript
IOS_APP_STORE: 'https://apps.apple.com/app/your-app-id',
ANDROID_PLAY_STORE: 'https://play.google.com/store/apps/details?id=com.coaching.app',
```

---

## ✅ **FINAL NOTES**

- This is a **simple bridge** between web and mobile
- Keep it **lightweight and fast**
- Focus on **mobile experience** (primary use case)
- **Test extensively** on real devices
- The mobile app handles all the **complex logic**
- You just **preserve and pass** the invite code

**Your job:** Get the user from web link → mobile app with code intact!

---

## 🚀 **LET'S BUILD!**

You have everything you need. Create a simple, fast, mobile-responsive landing page that:
1. Extracts invite code from URL
2. Detects device
3. Tries to open app
4. Redirects to store if needed
5. Looks professional

**Keep it simple. Make it fast. Test thoroughly.**

**End of Instructions** ✅
