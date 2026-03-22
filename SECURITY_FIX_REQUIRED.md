# 🚨 **CRITICAL: API KEY WAS EXPOSED - IMMEDIATE ACTION REQUIRED**

## ❌ **WHAT HAPPENED:**

Your Brevo API key was accidentally committed to git history.

**GitHub blocked push to protect you!** 🔒

---

## ⚡ **IMMEDIATE ACTIONS (DO THIS NOW):**

### **1. Rotate Your API Key (HIGHEST PRIORITY!)**

**Go to Brevo NOW:**
1. Visit: https://app.brevo.com/settings/keys/api
2. **DELETE** your current API key
3. **Generate** a new API key
4. **Copy** the new key

### **2. Update Your `.env` File**

```env
EXPO_PUBLIC_BREVO_API_KEY=YOUR_NEW_KEY_HERE
```

Replace `YOUR_NEW_KEY_HERE` with your new Brevo API key.

---

## 🔧 **FIX GIT HISTORY:**

The API key is in previous commits. You need to completely rewrite history:

### **Option 1: Interactive Rebase (Clean Solution)**

```bash
# Go back 2 commits
git rebase -i HEAD~2

# In the editor that opens:
# - Change 'pick' to 'drop' for both commits with the key
# - Save and close

# Force push
git push origin version-2-test --force
```

### **Option 2: Hard Reset (Nuclear Option)**

```bash
# Reset to before the problematic commits
git log --oneline  # Find the last good commit hash

# Reset to it
git reset --hard <last-good-commit-hash>

# Add all files fresh
git add .

# Commit without the keys
git commit -m "Add sub-coach invite system (secure)"

# Force push
git push origin version-2-test --force
```

### **Option 3: Use GitHub's Bypass (Temporary)**

1. Click the GitHub link from the error message
2. Choose "I'll fix this later"
3. This allows the push BUT key is still exposed in history!
4. **Still rotate your key!**

---

## ✅ **WHAT WE FIXED IN CODE:**

- ✅ Removed hardcoded API key from `lib/brevo-service.ts`
- ✅ Now uses environment variable `process.env.EXPO_PUBLIC_BREVO_API_KEY`
- ✅ Created `.env` file (gitignored)
- ✅ Removed API key from documentation

---

## 🔒 **SECURITY CHECKLIST:**

- [ ] Rotated Brevo API key
- [ ] Updated `.env` with new key
- [ ] Removed old commits with exposed key from git history
- [ ] Verified no keys in code: `grep -r "xkeysib" --exclude-dir=node_modules .`
- [ ] Pushed clean code to GitHub

---

## 📋 **RECOMMENDED STEPS:**

1. **Rotate API key** (5 minutes)
2. **Choose git fix option** (Option 1 or 2)
3. **Test the app** with new key
4. **Push to GitHub**

---

**ROTATE YOUR API KEY FIRST, THEN FIX GIT HISTORY!** 🚀

Once key is rotated, the old exposed key is useless anyway! 🔒
