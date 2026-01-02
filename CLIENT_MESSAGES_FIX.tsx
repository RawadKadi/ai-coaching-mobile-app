/**
 * COMPLETE CLIENT MESSAGES GREEN CARD FIX
 * 
 * Add this code to app/(client)/(tabs)/messages.tsx
 */

// ========================================
// STEP 1: Add component between line 247 and 249
// After: };
// Before: const SessionInviteMessage = ...
// ========================================

const ChallengeCompletionMessage = ({ content, isOwn }: { content: any, isOwn: boolean }) => {
  const [expanded, setExpanded] = useState(false);
  
  let data;
  try {
    data = typeof content === 'string' ? JSON.parse(content) : content;
  } catch (e) {
    return null;
  }

  if (!data || !data.taskName) {
    return null;
  }

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };

  return (
    <View style={{ width: '100%', alignItems: isOwn ? 'flex-end' : 'flex-start', marginVertical: 4 }}>
      <View style={[challengeStyles.container]}>
        <View style={challengeStyles.header}>
          <Text style={challengeStyles.headerText}>{data.title || 'Client finished this task'}</Text>
        </View>
        
        <View style={challengeStyles.body}>
          <Text style={challengeStyles.taskName}>{data.taskName}</Text>
          <Text style={challengeStyles.completedAt}>
            Completed at: {data.completedAt}
          </Text>
          
          <TouchableOpacity 
            style={challengeStyles.viewDetailsButton}
            onPress={toggleExpand}
          >
            <Text style={challengeStyles.viewDetailsText}>View Details</Text>
            {expanded ? (
              <ChevronUp size={16} color="#059669" />
            ) : (
              <ChevronDown size={16} color="#059669" />
            )}
          </TouchableOpacity>

          {expanded && (
            <View style={challengeStyles.expandedDetails}>
              {data.taskDescription && (
                <>
                  <Text style={challengeStyles.detailLabel}>Description:</Text>
                  <Text style={challengeStyles.detailText}>{data.taskDescription}</Text>
                </>
              )}
              <View style={challengeStyles.detailRow}>
                <Text style={challengeStyles.detailLabel}>Focus: </Text>
                <Text style={challengeStyles.detailText}>{data.focusType}</Text>
              </View>
              <View style={challengeStyles.detailRow}>
                <Text style={challengeStyles.detailLabel}>Intensity: </Text>
                <Text style={challengeStyles.detailText}>{data.intensity}</Text>
              </View>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

const challengeStyles = StyleSheet.create({
  container: {
    width: '85%',
    backgroundColor: '#d1fae5',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#6ee7b7',
    marginVertical: 4,
    overflow: 'hidden',
  },
  header: {
    backgroundColor: '#a7f3d0',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#6ee7b7',
  },
  headerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#065f46',
  },
  body: {
    padding: 16,
  },
  taskName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#064e3b',
    marginBottom: 4,
  },
  completedAt: {
    fontSize: 14,
    color: '#059669',
    marginBottom: 12,
  },
  viewDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewDetailsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
  },
  expandedDetails: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#6ee7b7',
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#065f46',
  },
  detailText: {
    fontSize: 13,
    color: '#047857',
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

// ========================================
// STEP 2: Add rendering logic around line 735
// After the TaskCompletionMessage check,
// Before the Session Invite Logic comment
// ========================================

      // Challenge Completion Logic
      let isChallengeMessage = false;
      try {
        const parsed = JSON.parse(item.content);
        if (parsed && parsed.type === 'challenge_completed') {
          isChallengeMessage = true;
        }
      } catch (e) {}

      if (isChallengeMessage) {
        return <ChallengeCompletionMessage content={item.content} isOwn={isMe} />;
      }
