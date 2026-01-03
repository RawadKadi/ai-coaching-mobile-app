## Critical Messaging Fixes - Manual Application Required

Due to encoding issues with automated replacement, please manually apply these changes:

### CLIENT MESSAGES (`/app/(client)/(tabs)/messages.tsx`):

#### 1. Add style for scroll button (line ~1502, AFTER the closing brace before `scrollButtonBadge`):

```typescript
  scrollToBottomButton: {
    position: 'absolute',
    right: 20,
    bottom: 100,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
```

#### 2. Fix loadMessages (line ~677) - Replace entire function:

```typescript
const loadMessages = async () => {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(`sender_id.eq.${client?.user_id},recipient_id.eq.${client?.user_id}`)
      .order('created_at', { ascending: true });

    if (error) throw error;
    setMessages(data || []);
    
    // Always scroll to bottom on load
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: false });
      markMessagesAsRead();
    }, 100);
  } catch (error) {
    console.error('Error loading messages:', error);
  } finally {
    setLoading(false);
  }
};
```

#### 3. Add auto-scroll in real-time subscription (find the subscription onCreate event):

In the `useEffect` that sets up the subscription, find the `INSERT` event handler and update it:

```typescript
.on('postgres_changes', {
  event: 'INSERT',
  schema: 'public',
  table: 'messages',
  filter: `...your existing filter...`
}, (payload) => {
  setMessages(current => [...current, payload.new as Message]);
  // Auto-scroll to new message
  setTimeout(() => {
    flatListRef.current?.scrollToEnd({ animated: true });
  }, 100);
})
```

---

### COACH CHAT (`/app/(coach)/chat/[id].tsx`):

#### 1. Fix sendMessage to auto-scroll (find sendMessage function around line 1480):

After `setMessages([...messages, data]);` add:

```typescript
// Auto-scroll to new message
setTimeout(() => {
  flatListRef.current?.scrollToEnd({ animated: true });
}, 100);
```

#### 2. Fix scrollToBottom function for coach (around line 1506):

Replace with:

```typescript
const scrollToBottom = () => {
  // Use longer timeout to ensure all messages are loaded
  setTimeout(() => {
    flatListRef.current?.scrollToEnd({ animated: true });
  }, 300);
  setShowScrollButton(false);
};
```

#### 3. Fix initial load scroll (in loadMessages):

Add after `setMessages(data || []);`:

```typescript
// Scroll to bottom after loading
setTimeout(() => {
  flatListRef.current?.scrollToEnd({ animated: false });
}, 100);
```

#### 4. Add auto-scroll in real-time subscription:

In the subscription INSERT handler, add:

```typescript
setTimeout(() => {
  flatListRef.current?.scrollToEnd({ animated: true });
}, 100);
```

---

## Summary of What These Fixes Do:

✅ Client messages now open at bottom (most recent)
✅ Client has scroll-to-bottom button  
✅ Both client & coach auto-scroll when sending messages
✅ Both auto-scroll when receiving new messages
✅ Coach scroll button now scrolls to actual latest message

Apply these changes manually and test!
