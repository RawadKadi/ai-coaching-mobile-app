# In-App Notification System - Implementation Status

## ✅ Completed Components

### 1. UnreadContext (`/contexts/UnreadContext.tsx`)
- Tracks unread message count
- Real-time subscription to messages table
- Updates when new messages arrive or messages are marked as read
- Provides `unreadCount` and `refreshUnreadCount()`

### 2. NotificationToast Component (`/components/NotificationToast.tsx`)
- Animated slide-in from top
- Shows sender name, message preview, "Tap to view"
- Auto-dismisses after 5 seconds
- Click to navigate and dismiss
- Beautiful modern design

### 3. Notification Sound (`/lib/notification-sound.ts`)
- Sound loading and playback functions
- Uses expo-av
- Graceful fallback if sound file missing
- **Note:** Need to add `notification.mp3` to `/assets/sounds/`

### 4. NotificationContext (`/contexts/NotificationContext.tsx`)
- Global message listener
- Checks if user is on messages page
- Shows toast only when NOT on messages
- Plays notification sound
- Fetches sender info for display

## 📋 Next Steps

### Step 5: Wrap App with Providers
Update `/app/_layout.tsx` to include:
```tsx
import { UnreadProvider } from '@/contexts/UnreadContext';
import { NotificationProvider } from '@/contexts/NotificationContext';

// Wrap existing providers:
<UnreadProvider>
  <NotificationProvider>
    {/* existing app */}
  </NotificationProvider>
</UnreadProvider>
```

### Step 6: Add Toast to Root Layout
Add to `/app/_layout.tsx` or create a `ToastContainer`:
```tsx
import { useNotification } from '@/contexts/NotificationContext';
import NotificationToast from '@/components/NotificationToast';
import { useRouter } from 'expo-router';

// In component:
const { activeToast, dismissToast } = useNotification();
const router = useRouter();

{activeToast && (
  <NotificationToast
    senderName={activeToast.senderName}
    message={activeToast.message}
    onPress={() => router.push(activeToast.navigateTo)}
    onDismiss={dismissToast}
  />
)}
```

### Step 7: Add Badges to Tab Bars
**Client Tab Bar** (`/app/(client)/(tabs)/_layout.tsx`):
```tsx
import { useUnread } from '@/contexts/UnreadContext';

const { unreadCount } = useUnread();

<Tabs.Screen
  name="messages"
  options={{
    tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
  }}
/>
```

**Coach Tab Bar** (`/app/(coach)/_layout.tsx`):
- Same approach for coach layout

### Step 8: Load Sound on App Start
In `/app/_layout.tsx`:
```tsx
import { loadNotificationSound, unloadNotificationSound } from '@/lib/notification-sound';

useEffect(() => {
  loadNotificationSound();
  
  return () => {
    unloadNotificationSound();
  };
}, []);
```

### Step 9: Coach Messages List Enhancement
Create or update `/app/(coach)/messages/index.tsx`:
- List all clients with latest message
- Sort by most recent
- Show unread count per client
- Show message preview
- Highlight unread conversations

**RPC Function Needed:**
```sql
CREATE OR REPLACE FUNCTION get_coach_client_conversations(p_coach_user_id uuid)
RETURNS TABLE (
  client_id uuid,
  client_name text,
  client_user_id uuid,
  latest_message text,
  latest_message_time timestamptz,
  unread_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH latest_msgs AS (
    SELECT DISTINCT ON (
      CASE 
        WHEN m.sender_id = p_coach_user_id THEN m.recipient_id
        ELSE m.sender_id
      END
    )
      CASE 
        WHEN m.sender_id = p_coach_user_id THEN m.recipient_id
        ELSE m.sender_id
      END as other_user_id,
      m.content,
      m.created_at
    FROM messages m
    WHERE m.sender_id = p_coach_user_id OR m.recipient_id = p_coach_user_id
    ORDER BY 
      CASE 
        WHEN m.sender_id = p_coach_user_id THEN m.recipient_id
        ELSE m.sender_id
      END,
      m.created_at DESC
  ),
  unread_counts AS (
    SELECT 
      m.sender_id as other_user_id,
      COUNT(*) as unread
    FROM messages m
    WHERE m.recipient_id = p_coach_user_id
      AND m.read = false
    GROUP BY m.sender_id
  )
  SELECT 
    c.id as client_id,
    p.full_name as client_name,
    c.user_id as client_user_id,
    lm.content as latest_message,
    lm.created_at as latest_message_time,
    COALESCE(uc.unread, 0) as unread_count
  FROM clients c
  INNER JOIN profiles p ON p.id = c.user_id
  INNER JOIN coach_client_links ccl ON ccl.client_id = c.id
  LEFT JOIN latest_msgs lm ON lm.other_user_id = c.user_id
  LEFT JOIN unread_counts uc ON uc.other_user_id = c.user_id
  WHERE ccl.coach_id = (
    SELECT id FROM coaches WHERE user_id = p_coach_user_id
  )
  AND ccl.status = 'active'
  ORDER BY lm.created_at DESC NULLS LAST;
END;
$$;
```

### Step 10: Install expo-av
```bash
npx expo install expo-av
```

## 🎯 Features Implemented

✅ Unread count tracking
✅ Real-time updates
✅ Toast notification component
✅ Notification sound support
✅ Global message listener
✅ Smart page detection (don't show on messages page)

## 🔨 Pending Integration

⏳ Wrap app with providers
⏳ Add toast to root layout
⏳ Add badges to tab bars
⏳ Load sound on app start
⏳ Install expo-av
⏳ Add notification sound file
⏳ Create coach messages list view
⏳ Create RPC for coach conversations

## 📝 Notes

- Sound file needs to be added manually to `/assets/sounds/notification.mp3`
- Can use any short notification sound (0.5-1 second)
- System will work without sound, it just won't play
- Toast auto-dismisses after 5 seconds
- Badge shows on tab when unread messages exist
