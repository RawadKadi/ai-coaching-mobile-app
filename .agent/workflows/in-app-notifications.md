---
description: In-App Message Notification System
---

# In-App Message Notification System

## Overview
Implement a complete in-app notification system for messages with badges, toast notifications, sounds, and smart message list sorting.

## Requirements

### 1. Tab Bar Badge (Unread Count)
- Show number of unread messages on Messages tab icon
- Client: Single badge (all unread from coach)
- Coach: Total unread from all clients
- Update in real-time
- Clear when viewing messages

### 2. Toast Notification (In-App Banner)
- Trigger: New message arrives when NOT on messages page
- Content: "[Client Name/Coach] sent a message - click to view"
- Position: Top of screen, slides down
- Duration: 5 seconds or until clicked
- Click action: Navigate to messages
- Auto-dismiss or click to dismiss

### 3. Notification Sound
- Play sound when new message arrives
- Only if user is NOT on messages page
- Use expo-av for sound playback
- Short, pleasant notification sound

### 4. Coach Messages Tab Improvements
- Sort clients by most recent message (newest first)
- Show unread count badge per client
- Show latest message preview (first 50 chars)
- Highlight unread conversations

## Technical Implementation

### Components Needed

1. **NotificationToast Component** (`/components/NotificationToast.tsx`)
   - Animated slide-in from top
   - Click handler for navigation
   - Auto-dismiss timer
   - Avatar, name, message preview

2. **UnreadBadge Component** (Built-in or custom)
   - Red circular badge with count
   - Position on tab icon

3. **Sound Manager** (`/lib/notification-sound.ts`)
   - Load notification sound asset
   - Play function
   - Mute check

### State Management

1. **Global Unread Count Context** (`/contexts/UnreadContext.tsx`)
   - Track total unread messages
   - Provider wraps app
   - Updates from real-time subscription

2. **Toast State** (React Context or Zustand)
   - Active toast messages
   - Queue system for multiple toasts

### Database Schema
Already exists:
- `messages.read` (boolean)
- `messages.recipient_id` (who should be notified)

### Implementation Steps

#### Step 1: Create UnreadContext
```typescript
// /contexts/UnreadContext.tsx
- Track unread count
- Subscribe to messages table
- Expose: unreadCount, markAsRead()
```

#### Step 2: Add Badge to Tab Bar
```typescript
// /app/(client)/(tabs)/_layout.tsx
// /app/(coach)/_layout.tsx
- Add tabBarBadge prop to Messages tab
- Use unread count from context
```

#### Step 3: Create Toast Notification Component
```typescript
// /components/NotificationToast.tsx
- Animated.View slide-in animation
- Avatar, sender name, message preview
- Click to navigate
- Auto-dismiss after 5s
```

#### Step 4: Add Notification Sound
```bash
# Add sound file to assets
mkdir -p assets/sounds
# Add notification.mp3 or .wav
```

```typescript
// /lib/notification-sound.ts
import { Audio } from 'expo-av';
- Load sound on app start
- playNotificationSound() function
```

#### Step 5: Global Message Listener
```typescript
// /contexts/NotificationContext.tsx
- Subscribe to new messages
- Check if user is on messages page
- Show toast if not on messages
- Play sound
- Update unread count
```

#### Step 6: Coach Client List Enhancements
```typescript
// /app/(coach)/messages/index.tsx (new or update existing)
- Fetch clients with latest message timestamp
- Order by most recent
- Show unread count per client
- Show message preview
- Highlight unread
```

### RPC Functions Needed

```sql
-- Get coach's clients with latest message info
CREATE OR REPLACE FUNCTION get_coach_client_conversations(p_coach_id uuid)
RETURNS TABLE (
  client_id uuid,
  client_name text,
  latest_message text,
  latest_message_time timestamptz,
  unread_count bigint
)
```

### File Structure
```
/contexts/
  UnreadContext.tsx          - Unread count management
  NotificationContext.tsx    - Toast notifications

/components/
  NotificationToast.tsx      - Toast UI component
  
/lib/
  notification-sound.ts      - Sound playback

/assets/sounds/
  notification.mp3           - Notification sound

/app/(coach)/messages/
  index.tsx                  - Client list with unread
  
/app/(client)/(tabs)/
  _layout.tsx                - Client tab bar with badge
  
/app/(coach)/
  _layout.tsx                - Coach tab bar with badge
```

## Features Summary

✅ Badge on Messages tab (unread count)
✅ Toast notification when message arrives
✅ Notification sound
✅ Click toast to open messages
✅ Coach: Clients sorted by recent
✅ Coach: Unread count per client
✅ Coach: Latest message preview
✅ Real-time updates

## Next Steps

1. Create UnreadContext
2. Add tab bar badges
3. Create toast component
4. Add notification sound
5. Implement global listener
6. Update coach messages list
7. Test all flows
