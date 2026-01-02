# CHALLENGE COMPLETION MESSAGE UI

## Update 1: Message Content Format

In `app/(client)/(tabs)/activity.tsx`, update the message sending (around line 127):

```typescript
if (coachData?.user_id) {
  const now = new Date();
  const completionTime = now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  const messageContent = JSON.stringify({
    type: 'challenge_completed',
    title: 'Client finished this task',
    taskName: challenge.name,
    taskDescription: challenge.description || '',
    completedAt: completionTime,
    focusType: challenge.focus_type,
    intensity: challenge.intensity,
  });

  await supabase.from('messages').insert({
    sender_id: client!.user_id,
    recipient_id: coachData.user_id,
    content: messageContent,
    ai_generated: true,
    message_type: 'system',
  });
}
```

## Update 2: Coach Chat Message Component

Find the coach chat message display component (likely in `app/(coach)/chat/[id].tsx` or similar).

Add this component before the message list:

```typescript
const ChallengeCompletionMessage = ({ message }: { message: any }) => {
  const [expanded, setExpanded] = useState(false);
  
  try {
    const data = JSON.parse(message.content);
    
    if (data.type !== 'challenge_completed') return null;

    return (
      <View style={styles.challengeCompletionCard}>
        <View style={styles.challengeHeader}>
          <Text style={styles.challengeHeaderText}>{data.title}</Text>
        </View>
        
        <View style={styles.challengeBody}>
          <Text style={styles.challengeTaskName}>{data.taskName}</Text>
          <Text style={styles.challengeCompletedAt}>
            Completed at: {data.completedAt}
          </Text>
          
          <TouchableOpacity 
            style={styles.viewDetailsButton}
            onPress={() => setExpanded(!expanded)}
          >
            <Text style={styles.viewDetailsText}>View Details</Text>
            <ChevronDown 
              size={16} 
              color="#059669"
              style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}
            />
          </TouchableOpacity>

          {expanded && (
            <View style={styles.expandedDetails}>
              <Text style={styles.detailLabel}>Description:</Text>
              <Text style={styles.detailText}>
                {data.taskDescription || 'No description provided'}
              </Text>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Focus: </Text>
                <Text style={styles.detailText}>{data.focusType}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Intensity: </Text>
                <Text style={styles.detailText}>{data.intensity}</Text>
              </View>
            </View>
          )}
        </View>
      </View>
    );
  } catch (e) {
    return null;
  }
};

// Styles to add:
const challengeCompletionCard = {
  backgroundColor: '#d1fae5',
  borderRadius: 12,
  borderWidth: 2,
  borderColor: '#6ee7b7',
  marginVertical: 8,
  overflow: 'hidden',
};

const challengeHeader = {
  backgroundColor: '#a7f3d0',
  padding: 12,
  borderBottomWidth: 1,
  borderBottomColor: '#6ee7b7',
};

const challengeHeaderText = {
  fontSize: 14,
  fontWeight: '600',
  color: '#065f46',
};

const challengeBody = {
  padding: 16,
};

const challengeTaskName = {
  fontSize: 20,
  fontWeight: 'bold',
  color: '#064e3b',
  marginBottom: 4,
};

const challengeCompletedAt = {
  fontSize: 14,
  color: '#059669',
  marginBottom: 12,
};

const viewDetailsButton = {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 4,
};

const viewDetailsText = {
  fontSize: 14,
  fontWeight: '600',
  color: '#059669',
};

const expandedDetails = {
  marginTop: 16,
  paddingTop: 16,
  borderTopWidth: 1,
  borderTopColor: '#6ee7b7',
};

const detailLabel = {
  fontSize: 13,
  fontWeight: '600',
  color: '#065f46',
};

const detailText = {
  fontSize: 13,
  color: '#047857',
  marginBottom: 8,
};

const detailRow = {
  flexDirection: 'row',
  alignItems: 'center',
};
```

## Update 3: Use in Message List

In the message rendering loop, check for challenge completion messages:

```typescript
{messages.map((message) => {
  // Check if it's a challenge completion message
  try {
    const content = JSON.parse(message.content);
    if (content.type === 'challenge_completed') {
      return <ChallengeCompletionMessage key={message.id} message={message} />;
    }
  } catch (e) {
    // Not JSON, render normally
  }

  // Normal message rendering
  return <MessageBubble key={message.id} message={message} />;
})}
```

This creates the exact green card UI from the image with expandable details!
