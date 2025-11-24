# Quick Start Guide

Get your AI-powered coaching platform running in 5 minutes.

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- Supabase account (free tier works)
- Anthropic API key

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Configure Environment Variables

Create a `.env` file in the project root:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### Where to Find These Values

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **Settings** → **API**
4. Copy:
   - **Project URL** → `EXPO_PUBLIC_SUPABASE_URL`
   - **anon/public key** → `EXPO_PUBLIC_SUPABASE_ANON_KEY`

## Step 3: Verify Database Setup

The database migrations have already been applied. Verify tables exist:

1. Go to **Table Editor** in Supabase Dashboard
2. You should see tables like:
   - profiles
   - coaches
   - clients
   - check_ins
   - meals
   - workouts
   - messages
   - etc.

## Step 4: Configure Anthropic API Key

The Edge Functions need an Anthropic API key:

1. Get your API key from [Anthropic Console](https://console.anthropic.com/)
2. In Supabase Dashboard, go to **Edge Functions** → **Settings**
3. Add secret: `ANTHROPIC_API_KEY` with your key

## Step 5: Start Development Server

```bash
npm run dev
```

This will start the Expo development server.

## Step 6: Open the App

Choose one of these options:

### Web Browser (Easiest)
- Press `w` in the terminal
- Opens in your default browser at http://localhost:8081

### Physical Device
- Install **Expo Go** app (iOS/Android)
- Scan the QR code shown in terminal
- Works on same network as your computer

### iOS Simulator (Mac only)
- Press `i` in the terminal
- Requires Xcode installed

### Android Emulator
- Press `a` in the terminal
- Requires Android Studio installed

## First Time Setup

### Create a Test Coach Account

1. Click "Sign Up"
2. Select "I'm a Coach"
3. Fill in:
   - Full Name: Test Coach
   - Email: coach@test.com
   - Password: password123
4. Submit

### Create a Test Client Account

1. Sign out
2. Click "Sign Up"
3. Select "I'm a Client"
4. Fill in:
   - Full Name: Test Client
   - Email: client@test.com
   - Password: password123
4. Submit

## Testing AI Features

### Generate Meal Plan

As a client or coach, call the Edge Function:

```typescript
const { data, error } = await supabase.functions.invoke('generate-meal-plan', {
  body: {
    clientId: 'your-client-id',
    dailyCalories: 2000,
    restrictions: ['vegetarian'],
    preferences: ['high-protein'],
    durationDays: 7,
  },
});
```

### Analyze Check-in

Create a check-in first, then:

```typescript
const { data, error } = await supabase.functions.invoke('analyze-checkin', {
  body: {
    checkInId: 'your-checkin-id',
  },
});
```

## Troubleshooting

### "Cannot connect to Supabase"
- Check your `.env` file has correct values
- Ensure no trailing spaces in environment variables
- Restart the dev server after changing `.env`

### "Unauthorized" errors
- Make sure you're logged in
- Check JWT token is being sent in requests
- Verify RLS policies allow the operation

### Edge Functions not working
- Verify `ANTHROPIC_API_KEY` is set in Supabase
- Check Edge Function logs in Supabase Dashboard
- Ensure you're authenticated when calling functions

### TypeScript errors
```bash
npm run typecheck
```

### Can't see app on phone
- Ensure phone and computer are on same WiFi
- Try running `npm run dev` with `--tunnel` flag
- Check firewall isn't blocking port 8081

## Common Commands

```bash
# Start development server
npm run dev

# Type checking
npm run typecheck

# Build for web
npm run build:web

# Lint code
npm run lint
```

## Next Steps

### For Development

1. **Read the Architecture:** Check `ARCHITECTURE.md` for system design
2. **Explore API:** See `API_DOCUMENTATION.md` for all endpoints
3. **Understand Database:** Review table structures in Supabase Dashboard
4. **Customize UI:** Edit components in `/app` directory

### For Production

1. **Configure Domain:** Set up custom domain in Supabase
2. **Set up CI/CD:** Configure automated deployments
3. **Enable Analytics:** Set up monitoring and logging
4. **Configure Backups:** Ensure automatic backups are enabled
5. **Set up Stripe:** For payment processing (optional)

## Getting Help

### Check Logs

**Client-side errors:**
- Open browser console (F12)
- Check Expo dev tools in terminal

**Server-side errors:**
- Supabase Dashboard → **Logs**
- Edge Functions → **Logs** tab
- Database → **Query Performance**

### Common Issues

**Issue:** App won't start
**Solution:** Delete `node_modules` and run `npm install` again

**Issue:** Database queries fail
**Solution:** Check RLS policies allow your operation

**Issue:** AI functions timeout
**Solution:** Claude Haiku is fast; check network connection

## Architecture Overview

```
Mobile App (React Native Expo)
        ↓
Supabase Auth (JWT)
        ↓
Supabase PostgreSQL Database
        ↓
Edge Functions (AI Processing)
        ↓
Anthropic Claude API
```

## Key Features to Explore

### Client Features
- ✅ Daily check-ins with AI analysis
- ✅ Habit tracking
- ✅ Meal logging
- ✅ Workout logging
- ✅ Progress dashboard

### Coach Features
- ✅ Client management
- ✅ AI brain configuration
- ✅ View client progress
- ✅ Approve AI-generated plans

### AI Features
- ✅ Meal plan generation
- ✅ Workout plan generation
- ✅ Check-in analysis
- ✅ Weekly summaries

## Resources

- [Expo Documentation](https://docs.expo.dev)
- [Supabase Documentation](https://supabase.com/docs)
- [Anthropic API Documentation](https://docs.anthropic.com)
- [React Native Documentation](https://reactnative.dev)

## Support

For issues or questions:
1. Check this guide first
2. Review `ARCHITECTURE.md` for system design
3. Check `API_DOCUMENTATION.md` for endpoints
4. Inspect Supabase logs
5. Review browser/mobile console logs

---

**Ready to build something amazing!** 🚀
