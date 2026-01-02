/* 
 * COMPLETE FIX FOR CHALLENGE COMPLETION MESSAGE
 * 
 * REPLACE the ChallengeCompletionMessage component (around line 699-762)
 * with this version:
 */

const ChallengeCompletionMessage = ({ content, isOwn }: { content: any, isOwn: boolean }) => {
  const [expanded, setExpanded] = useState(false);
  
  console.log('[ChallengeCompletionMessage] Rendering with content:', content);
  
  let data;
  try {
    data = typeof content === 'string' ? JSON.parse(content) : content;
    console.log('[ChallengeCompletionMessage] Parsed data:', data);
  } catch (e) {
    console.error('[ChallengeCompletionMessage] Parse error:', e);
    return null;
  }

  if (!data || !data.taskName) {
    console.log('[ChallengeCompletionMessage] Invalid data structure');
    return null;
  }

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };

  return (
    <View style={[challengeStyles.container, { alignSelf: isOwn ? 'flex-end' : 'flex-start', width: '100%', maxWidth: '85%' }]}>
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
  );
};
