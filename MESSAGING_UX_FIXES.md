# Messaging UX Fixes

## Issues to Fix:

### Client Messages Page (`/app/(client)/(tabs)/messages.tsx`):
1. ❌ Doesn't scroll to bottom on initial load
2. ❌ Missing scroll-to-bottom button
3. ❌ Doesn't auto-scroll when sending a message  
4. ❌ Doesn't auto-scroll when receiving a new message

### Coach Chat Page (`/app/(coach)/chat/[id].tsx`):
1. ❌ Scroll-to-bottom button doesn't scroll to actual latest message (scrolls to last loaded)
2. ❌ Doesn't auto-scroll when sending a message
3. ❌ Doesn't auto-scroll when receiving a new message

## Solutions:

### For Client Messages:
1. Change initial scroll logic in `loadMessages()` - scroll to bottom instead of first unread
2. Add scroll-to-bottom button (floating button like coach has)
3. Add `scrollToEnd()` call after sending message
4. Add `scrollTo End()` in real-time subscription handler

### For Coach Chat:
1. Fix `scrollToEnd()` to use proper timeout to ensure all messages loaded
2. Add `scrollToEnd()` call after sending message
3. Add `scrollToEnd()` in real-time subscription handler

## Implementation:
- Add floating scroll button to client page
- Update all send message handlers to auto-scroll
- Update real-time subscriptions to auto-scroll on new messages
- Fix initial load to scroll to bottom (not first unread)
