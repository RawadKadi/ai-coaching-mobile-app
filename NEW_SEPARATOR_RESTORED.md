# ✅ "NEW" MESSAGE SEPARATOR RESTORED

## What Was Fixed

### 1. Client Messages (`/app/(client)/(tabs)/messages.tsx`)
- ✅ Added `firstUnreadIndex` calculation in `loadMessages()`
- ✅ Finds first unread message that's NOT from the client (from coach)
- ✅ Shows "X NEW MESSAGES" separator above first unread message

### 2. Coach Chat (`/app/(coach)/chat/[id].tsx`)
- ✅ Added `firstUnreadIndex` calculation in `loadChatData()`
- ✅ Finds first unread message from the client
- ✅ Shows "X NEW MESSAGES" separator above first unread message

## How It Works

### Client Side:
```typescript
// In loadMessages()
const firstUnread = data.findIndex(m => !m.read && m.sender_id !== client?.user_id);
setFirstUnreadIndex(firstUnread);
```

### Coach Side:
```typescript
// In loadChatData()
const firstUnread = data.findIndex(m => !m.read && m.sender_id === clientUserId);
setFirstUnreadIndex(firstUnread);
```

## UI Display

The separator shows:
```
━━━━━━━ ⬤ X NEW MESSAGES ⬤ ━━━━━━━
```

Where:
- ━━━ = Horizontal line
- ⬤ = Badge with text
- X = Number of new messages from that point down

## When It Shows

- ✅ Opens when there are unread messages
- ✅ Positioned above the first unread message
- ✅ Disappears after messages are marked as read
- ✅ Updates when new unread messages arrive

## Reset Behavior

Messages are automatically marked as read when:
1. Page is opened (via `useFocusEffect` with 500ms delay)
2. Messages are scrolled to bottom
3. New messages arrive while viewing

This causes:
- Badge count to reset
- "NEW" separator to disappear on next load
- Clean slate for next unread messages

## Files Modified
- `/app/(client)/(tabs)/messages.tsx` - Line ~712
- `/app/(coach)/chat/[id].tsx` - Line ~1437

## Status: ✅ COMPLETE

Both client and coach now have the WhatsApp-style "NEW" separator working!
