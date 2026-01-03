# Client Messages - Complete Fix

## Apply these changes to `/app/(client)/(tabs)/messages.tsx`:

### 1. Update loadMessages function (around line 677):
Replace the entire loadMessages function with:

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
    
    // Always scroll to bottom after loading
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

### 2. Update sendMessage function (around line 808):
Add scroll after setting messages:

```typescript
setMessages([...messages, data]);
setNewMessage('');

// Auto-scroll to new message
setTimeout(() => {
  flatListRef.current?.scrollToEnd({ animated: true });
}, 100);
```

### 3. Add scroll button UI (before `{/* Input Area */}` around line1005):

```typescript
{/* Scroll to bottom button */}
{showScrollButton && (
  <TouchableOpacity
    style={styles.scrollToBottomButton}
    onPress={scrollToBottom}
  >
    <ArrowDown size={24} color="#FFF" />
  </TouchableOpacity>
)}
```

### 4. Add scroll button styles (in StyleSheet around line 1400):

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

### 5. Update real-time subscription (find the subscription handler):
Add `scrollToEnd` after new message arrives:

```typescript
.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' },
  (payload) => {
    setMessages(current => [...current, payload.new as Message]);
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }
)
```

### 6. Remove the `onLayout` scroll logic from FlatList (line 998-1002):
Remove this entire block as we scroll in loadMessages now:
```typescript
onLayout={() => {
    if (firstUnreadIndex === -1) {
        flatListRef.current?.scrollToEnd({ animated: false });
    }
}}
```
