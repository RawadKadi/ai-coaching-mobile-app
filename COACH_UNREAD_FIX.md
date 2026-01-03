# ✅ COACH UNREAD COUNT FIXED

## Issue
- Coach tab badge was showing then disappearing
- Coach messages list not showing unread count badges next to clients

## Root Cause
The unread count query in `/app/(coach)/(tabs)/messages.tsx` was missing the recipient filter:

**Before:**
```typescript
const { count } = await supabase
  .from('messages')
  .select('*', { count: 'exact', head: true })
  .eq('sender_id', client.user_id)
  .eq('read', false);
```

This counted ALL unread messages from the client to ANYONE, not just to this specific coach.

**After:**
```typescript
const { count } = await supabase
  .from('messages')
  .select('*', { count: 'exact', head: true })
  .eq('sender_id', client.user_id)
  .eq('recipient_id', user?.id)  // ← ADDED THIS
  .eq('read', false);
```

Now it only counts unread messages sent TO this coach.

## Changes Made
1. Added `user` to `useAuth()` destructuring (line 20)
2. Added `.eq('recipient_id', user?.id)` to unread count query (line 90)

## What This Fixes
✅ Coach messages list now shows correct unread count per client
✅ Badge only counts messages TO this coach
✅ Unread counts update correctly when messages are read

## Test
1. Have client send message to coach
2. Coach opens Messages tab → Should see badge number
3. Coach sees messages list → Client should have unread badge (blue number)
4. Coach opens that chat → Unread count updates
5. Badge on tab updates/disappears when all read

## Files Modified
- `/app/(coach)/(tabs)/messages.tsx`

## Status: FIXED ✅
