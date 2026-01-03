import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, LayoutAnimation, UIManager, Modal, Pressable, Dimensions, Linking, Alert, Animated } from 'react-native';
import { Image } from 'expo-image';
import { PinchGestureHandler, PanGestureHandler, State } from 'react-native-gesture-handler';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Send, ChevronDown, ChevronUp, X, Video, ArrowDown } from 'lucide-react-native';
import MealMessageCard from '@/components/MealMessageCard';
import RescheduleProposalMessage from '@/components/RescheduleProposalMessage';
import { useFocusEffect } from 'expo-router';

if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

type Message = {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: string;
  read: boolean;
  client_id: string;
};

const ZoomableImage = ({ imageUrl, onClose, onLoadStart, onLoadEnd }: {
  imageUrl: string;
  onClose: () => void;
  onLoadStart: () => void;
  onLoadEnd: () => void;
}) => {
  const scale = React.useRef(new Animated.Value(1)).current;
  const translateY = React.useRef(new Animated.Value(0)).current;
  const lastScale = React.useRef(1);
  const lastTranslateY = React.useRef(0);

  const pinchRef = React.useRef<any>(null);
  const panRef = React.useRef<any>(null);

  const onPinchEvent = Animated.event(
    [{ nativeEvent: { scale } }],
    { useNativeDriver: true }
  );

  const onPinchStateChange = (event: any) => {
    if (event.nativeEvent.oldState === State.ACTIVE) { // 4 = ACTIVE
      lastScale.current *= event.nativeEvent.scale;
      scale.setValue(lastScale.current);
    }
  };

  const onPanEvent = Animated.event(
    [{ nativeEvent: { translationY: translateY } }],
    { useNativeDriver: true }
  );

  const onPanStateChange = (event: any) => {
    if (event.nativeEvent.oldState === State.ACTIVE) { // ACTIVE
      const { translationY } = event.nativeEvent;
      
      // If swiped down/up more than 150px, close modal
      if (Math.abs(translationY) > 150) {
        onClose();
      } else {
        // Reset position
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      }
      lastTranslateY.current = 0;
    }
  };

  const resetZoom = () => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start();
    lastScale.current = 1;
    lastTranslateY.current = 0;
  };

  return (
    <PanGestureHandler
      ref={panRef}
      onGestureEvent={onPanEvent}
      onHandlerStateChange={onPanStateChange}
      enabled={lastScale.current <= 1} // Only allow pan when not zoomed
      simultaneousHandlers={pinchRef}
    >
      <Animated.View style={{ flex: 1 }}>
        <PinchGestureHandler
          ref={pinchRef}
          onGestureEvent={onPinchEvent}
          onHandlerStateChange={onPinchStateChange}
          simultaneousHandlers={panRef}
        >
          <Animated.View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Animated.Image
              source={{ uri: imageUrl }}
              style={{
                width: '100%',
                height: '100%',
                transform: [{ scale }, { translateY }],
              }}
              resizeMode="contain"
              onLoadStart={onLoadStart}
              onLoadEnd={onLoadEnd}
            />
          </Animated.View>
        </PinchGestureHandler>
      </Animated.View>
    </PanGestureHandler>
  );
};

const TaskCompletionMessage = ({ content, isOwn }: { content: any, isOwn: boolean }) => {
  const [expanded, setExpanded] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [modalImageLoading, setModalImageLoading] = useState(true);
  
  const data = typeof content === 'string' ? JSON.parse(content) : content;

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };

  const isCompletion = data.isCompletion !== false; // Default to true if undefined
  const isUndo = !isCompletion;

  // Colors based on type
  const containerStyle = isUndo 
    ? { backgroundColor: '#FFFBEB', borderColor: '#F59E0B' } 
    : { backgroundColor: '#ECFDF5', borderColor: '#10B981' };
    
  const headerStyle = isUndo
    ? { backgroundColor: '#FEF3C7', borderBottomColor: '#F59E0B' }
    : { backgroundColor: '#D1FAE5', borderBottomColor: '#10B981' };
    
  const titleColor = isUndo ? '#92400E' : '#065F46';
  const nameColor = isUndo ? '#92400E' : '#064E3B';
  const timeColor = isUndo ? '#B45309' : '#047857';
  const dividerColor = isUndo ? '#F59E0B' : '#10B981';
  const toggleColor = isUndo ? '#D97706' : '#059669';

  return (
    <View style={[styles.taskMessageContainer, containerStyle, { alignSelf: isOwn ? 'flex-end' : 'flex-start' }]}>
      <View style={[styles.taskHeader, headerStyle]}>
        <Text style={[styles.taskTitle, { color: titleColor }]}>
          {isUndo ? `${data.clientName} undid this task` : `${data.clientName} finished this task`}
        </Text>
      </View>
      
      {/* Image Banner */}
      {data.imageUrl && !isUndo && (
        <View style={styles.bannerContainer}>
          <Pressable 
            onPress={() => !imageLoading && setShowImageModal(true)}
            style={styles.bannerPressable}
          >
            {imageLoading && (
              <View style={styles.bannerLoading}>
                <ActivityIndicator size="small" color={toggleColor} />
              </View>
            )}
            <Image 
              source={{ uri: data.imageUrl }} 
              style={styles.bannerImage} 
              contentFit="cover"
              transition={200}
              onLoadStart={() => setImageLoading(true)}
              onLoad={() => setImageLoading(false)}
            />
            {!imageLoading && (
              <View style={styles.bannerOverlay}>
                <Text style={styles.bannerText}>Tap to view proof attached</Text>
              </View>
            )}
          </Pressable>
        </View>
      )}
      
      <View style={styles.taskContent}>
        <Text style={[styles.taskName, { color: nameColor }]}>{data.taskName}</Text>
        <Text style={[styles.taskTime, { color: timeColor }]}>
          {isUndo ? 'Undone at: ' : 'Completed at: '}
          {new Date(data.timestamp).toLocaleTimeString()}
        </Text>
        <View style={[styles.divider, { backgroundColor: dividerColor }]} />
        
        <TouchableOpacity onPress={toggleExpand} style={styles.toggleButton}>
          <Text style={[styles.toggleText, { color: toggleColor }]}>{expanded ? 'Hide Details' : 'View Details'}</Text>
          {expanded ? <ChevronUp size={16} color={toggleColor} /> : <ChevronDown size={16} color={toggleColor} />}
        </TouchableOpacity>

        {expanded && (
          <View style={[styles.taskDetails, { borderTopColor: isUndo ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)' }]}>
            {data.description && (
              <Text style={[styles.detailText, { color: timeColor }]}>Description: {data.description}</Text>
            )}
            {data.imageUrl && (
              <Text style={[styles.detailText, { color: timeColor }]}>
                Proof attached (See banner above)
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Full Screen Image Modal with Zoom and Swipe to Close */}
      <Modal
        visible={showImageModal}
        transparent={true}
        onRequestClose={() => setShowImageModal(false)}
        animationType="fade"
      >
        <View style={styles.modalContainer}>
          <Pressable style={styles.closeButton} onPress={() => setShowImageModal(false)}>
            <X size={30} color="#FFFFFF" />
          </Pressable>
          
          {modalImageLoading && (
            <ActivityIndicator size="large" color="#FFFFFF" style={styles.modalLoader} />
          )}
          
          <ZoomableImage 
            imageUrl={data.imageUrl}
            onClose={() => setShowImageModal(false)}
            onLoadStart={() => setModalImageLoading(true)}
            onLoadEnd={() => setModalImageLoading(false)}
          />
        </View>
      </Modal>
    </View>
  );
};

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
    backgroundColor: '#ecfef5ff',
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
    fontSize: 16,
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


const SessionInviteMessage = ({ content, isOwn, status, isClient, onJoin, onPostpone }: { 
  content: any, 
  isOwn: boolean, 
  status?: string, 
  isClient?: boolean,
  onJoin: () => void, 
  onPostpone: () => void 
}) => {
  const data = typeof content === 'string' ? JSON.parse(content) : content;
  const isCancelled = status === 'cancelled';
  const isPostponed = isCancelled && !!data.cancellationReason;
  
  return (
    <View style={[
      styles.inviteContainer, 
      { alignSelf: isOwn ? 'flex-end' : 'flex-start' },
      isPostponed ? styles.invitePostponed : (isCancelled ? styles.inviteCancelled : null)
    ]}>
      <View style={styles.inviteHeader}>
        <Image 
          source={{ uri: 'https://jitsi.org/wp-content/uploads/2020/03/favicon.png' }} 
          style={styles.meetLogo}
          contentFit="contain"
          transition={200}
        />
        <Text style={styles.inviteTitle}>Coaching Session</Text>
        {isCancelled && (
          <View style={isPostponed ? styles.postponedTag : styles.cancelledTag}>
            <Text style={styles.cancelledTagText}>{isPostponed ? 'Postponed' : 'Cancelled'}</Text>
          </View>
        )}
      </View>
      
      <View style={styles.inviteBody}>
        <Text style={styles.inviteDescription}>
          {data.description || 'Instant Meeting'}
        </Text>
        <Text style={styles.inviteTime}>
          {new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
        {isCancelled && data.cancellationReason && (
          <View style={styles.cancellationReasonContainer}>
            <Text style={styles.cancellationReasonLabel}>Reason:</Text>
            <Text style={styles.cancellationReasonText}>{data.cancellationReason}</Text>
          </View>
        )}
      </View>

      {!isCancelled && (
        <View style={styles.inviteActions}>
          {isClient && (
            <TouchableOpacity style={styles.invitePostponeButton} onPress={onPostpone}>
              <Text style={styles.invitePostponeText}>Postpone</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.inviteJoinButton} onPress={onJoin}>
            <Text style={styles.inviteJoinText}>Join Now</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

import PostponeModal from '@/components/PostponeModal';

// ... (previous imports)

// ... (ZoomableImage, TaskCompletionMessage components remain same)

const SessionInviteMessageWrapper = ({ 
  item, 
  parsed, 
  isOwn,
  handlePostpone 
}: { 
  item: Message, 
  parsed: any, 
  isOwn: boolean,
  handlePostpone: (sessionData: any, messageId: string) => void
}) => {
  // ... (state and effects remain same)
  const [sessionStatus, setSessionStatus] = React.useState(parsed.status);
  const [cancellationReason, setCancellationReason] = React.useState(parsed.cancellationReason);
  const [coachId, setCoachId] = React.useState(parsed.coachId);
  
  // Sync state with props when they change (e.g. after local update)
  React.useEffect(() => {
    if (parsed.status) {
      setSessionStatus(parsed.status);
    }
    if (parsed.cancellationReason) {
      setCancellationReason(parsed.cancellationReason);
    }
    if (parsed.coachId) {
      setCoachId(parsed.coachId);
    }
  }, [parsed.status, parsed.cancellationReason, parsed.coachId]);

  React.useEffect(() => {
    const fetchSessionStatus = async () => {
      // Only fetch if we don't already have status from props
      if (!parsed.status || !coachId) {
        const { data: session } = await supabase
          .from('sessions')
          .select('status, cancellation_reason, coach_id')
          .eq('id', parsed.sessionId)
          .single();
        
        if (session) {
          setSessionStatus(session.status);
          setCancellationReason(session.cancellation_reason);
          if (session.coach_id) {
            setCoachId(session.coach_id);
          }
        }
      }
    };
    
    fetchSessionStatus();
    
    // Subscribe to session updates for real-time changes
    const subscription = supabase
      .channel(`session-updates-${parsed.sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sessions',
          filter: `id=eq.${parsed.sessionId}`
        },
        (payload) => {
          const updatedSession = payload.new as any;
          if (updatedSession) {
            setSessionStatus(updatedSession.status);
            setCancellationReason(updatedSession.cancellation_reason || null);
          }
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(subscription);
    };
  }, [parsed.sessionId, parsed.status, coachId]);
  
  return (
    <SessionInviteMessage 
      content={{ ...parsed, cancellationReason }}
      isOwn={isOwn}
      status={sessionStatus}
      isClient={true}
      onJoin={() => {
        Linking.openURL(parsed.link);
      }}
      onPostpone={() => handlePostpone({ ...parsed, coachId }, item.id)}
    />
  );
};

export default function MessagesScreen() {
  const { client } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  // ... (other existing state)
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [nextSession, setNextSession] = useState<any>(null);
  const [lastReadMessageId, setLastReadMessageId] = useState<string | null>(null);
  const [firstUnreadIndex, setFirstUnreadIndex] = useState<number>(-1);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Postpone Modal State
  const [postponeModalVisible, setPostponeModalVisible] = useState(false);
  const [postponeData, setPostponeData] = useState<{sessionData: any, messageId: string, sessionId: string} | null>(null);

  useEffect(() => {
    if (client?.user_id) {
      loadMessages();
      loadNextSession();
      const cleanup = subscribeToMessages();
      return cleanup;
    }
  }, [client?.user_id]);

  // Reload messages when screen comes into focus (fallback if realtime doesn't work)
  useFocusEffect(
    React.useCallback(() => {
      if (client?.user_id) {
        console.log('[Messages] Screen focused, reloading messages');
        loadMessages();
        loadNextSession();
      }
    }, [client?.user_id])
  );

  const loadNextSession = async () => {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('client_id', client?.id)
        .eq('status', 'scheduled')
        .gt('scheduled_at', new Date().toISOString())
        .order('scheduled_at', { ascending: true })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading next session:', error);
      }
      
      setNextSession(data);
    } catch (error) {
      console.error('Error loading next session:', error);
    }
  };

  const subscribeToMessages = () => {
    if (!client?.user_id) return;
    
    // Messages Subscription
    const messageChannel = supabase
      .channel(`messages-${client.user_id}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const newMessage = payload.new as Message;
          if (newMessage.recipient_id === client.user_id || newMessage.sender_id === client.user_id) {
            setMessages((current) => {
              // Check for duplicates by ID or by content+sender (for optimistic updates)
              const existsById = current.find(m => m.id === newMessage.id);
              const existsByContent = current.find(m => 
                m.sender_id === newMessage.sender_id && 
                m.content === newMessage.content &&
                Math.abs(new Date(m.created_at).getTime() - new Date(newMessage.created_at).getTime()) < 3000
              );
              
              if (existsById || existsByContent) {
                // If it's a temp message, replace it with the real one
                if (existsByContent && existsByContent.id.startsWith('temp-')) {
                  return current.map(m => m.id === existsByContent.id ? newMessage : m);
                }
                return current;
              }
              
              return [...current, newMessage];
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const updatedMessage = payload.new as Message;
          if (updatedMessage.recipient_id === client.user_id || updatedMessage.sender_id === client.user_id) {
            setMessages((current) => 
              current.map(msg => 
                msg.id === updatedMessage.id ? updatedMessage : msg
              )
            );
          }
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          // Silently reload messages on error
          loadMessages();
        }
      });

    // Sessions Subscription (for "Wait for Coach")
    const sessionChannel = supabase
      .channel(`sessions:${client.user_id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sessions',
          filter: `client_id=eq.${client?.id}`
        },
        () => {
          console.log('[Messages] Session update received, reloading...');
          loadNextSession();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messageChannel);
      supabase.removeChannel(sessionChannel);
    };
  };

  const loadMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${client?.user_id},recipient_id.eq.${client?.user_id}`)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

 const markMessagesAsRead = async () => {
    if (!messages.length || !client?.user_id) return;
    
    const lastMessage = messages[messages.length - 1];
    setLastReadMessageId(lastMessage.id);
    setFirstUnreadIndex(-1);
    
    // Mark all unread messages as read in database
    const unreadIds = messages
      .filter(m => !m.read && m.recipient_id === client.user_id)
      .map(m => m.id);
    
    if (unreadIds.length > 0) {
      await supabase
        .from('messages')
        .update({ read: true })
        .in('id', unreadIds);
    }
  };

  const handleScroll = (event: any) => {
    const { contentOffset } = event.nativeEvent;
    // For inverted list, offset close to 0 means at bottom (newest messages)
    const isAtBottom = contentOffset.y <= 50;
    setShowScrollButton(!isAtBottom);
    
    // Mark as read when at bottom
    if (isAtBottom && messages.length > 0) {
      markMessagesAsRead();
    }
  };

  const scrollToBottom = () => {
    // For inverted lists, offset 0 is the bottom (newest messages)
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    markMessagesAsRead();
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !client) return;

    const messageText = newMessage.trim();
    
    // Optimistic update - add to UI immediately
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage = {
      id: tempId,
      sender_id: client.user_id,
      recipient_id: '', // Will be filled after we get coach
      content: messageText,
      created_at: new Date().toISOString(),
      read: false,
      client_id: client.id,
    };
    
    setMessages([...messages, optimisticMessage]);
    setNewMessage('');

    // Send to backend in background
    try {
      setSending(true);
      
      // Get active coach from coach_client_links
      const { data: coachLink, error: linkError } = await supabase
        .from('coach_client_links')
        .select('coach_id')
        .eq('client_id', client.id)
        .eq('status', 'active')
        .single();

      if (linkError || !coachLink) {
        console.error('No active coach found for client:', client.id);
        // Remove optimistic message on error
        setMessages(messages);
        setNewMessage(messageText);
        return;
      }

      const { data: coach } = await supabase
        .from('coaches')
        .select('user_id')
        .eq('id', coachLink.coach_id)
        .single();

      if (!coach) {
        setMessages(messages);
        setNewMessage(messageText);
        return;
      }

      const message = {
        sender_id: client.user_id,
        recipient_id: coach.user_id,
        content: messageText,
        read: false,
        ai_generated: false,
      };

      const { data, error } = await supabase
        .from('messages')
        .insert(message)
        .select()
        .single();

      if (error) throw error;

      // Replace temp message with real one
      setMessages((current) => 
        current.map(m => m.id === tempId ? data : m)
      );
    } catch (error) {
      console.error('Error sending message:', error);
      // Remove optimistic message on error
      setMessages((current) => current.filter(m => m.id !== tempId));
      setNewMessage(messageText);
    } finally {
      setSending(false);
    }
  };

  const handlePostpone = (sessionData: any, messageId: string) => {
    setPostponeData({
        sessionData,
        messageId,
        sessionId: sessionData.sessionId // Ensure this is passed from the message content
    });
    setPostponeModalVisible(true);
  };

  const handleConfirmPostpone = async (reason: string, newDate: string) => {
    if (!postponeData || !client) return;

    const { sessionData, messageId } = postponeData;

    try {
      // Use RPC function to securely handle the postponement transaction
      const { data, error } = await supabase.rpc('postpone_session', {
        p_old_session_id: sessionData.sessionId,
        p_old_message_id: messageId,
        p_new_scheduled_at: newDate,
        p_reason: reason
      });

      if (error) throw error;

      Alert.alert('Success', 'Session postponed successfully.');
      setPostponeModalVisible(false);
      
      // Reload messages to show the changes
      loadMessages();
      loadNextSession();

    } catch (error) {
      console.error('Error postponing session:', error);
      Alert.alert('Error', 'Failed to postpone session. Please try again.');
    }
  };

  const renderMessage = ({ item, index }: { item: Message, index: number }) => {
    // ... (isMe, showUnreadSeparator logic remains same)
    const isMe = item.sender_id === client?.user_id;
    const showUnreadSeparator = index === firstUnreadIndex;

    const renderContent = () => {
      // ... (TaskCompletionMessage logic remains same)
      let isTaskMessage = false;
      try {
        const parsed = JSON.parse(item.content);
        if (parsed && parsed.type === 'task_completion') {
          isTaskMessage = true;
        }
      } catch (e) {}

      if (isTaskMessage) {
        return <TaskCompletionMessage content={item.content} isOwn={isMe} />;
      }

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

      // Session Invite Logic
      let isSessionInvite = false;
      try {
        const parsed = JSON.parse(item.content);
        if (parsed && parsed.type === 'session_invite') {
          isSessionInvite = true;
        }
      } catch (e) {}

      if (isSessionInvite) {
        const parsed = JSON.parse(item.content);
        return (
          <SessionInviteMessageWrapper 
            item={item}
            parsed={parsed}
            isOwn={isMe}
            handlePostpone={handlePostpone}
          />
        );
      }

      // Reschedule Proposal Logic
      try {
        const parsed = JSON.parse(item.content);
        if (parsed && parsed.type === 'reschedule_proposal') {
          return (
            <RescheduleProposalMessage 
              messageId={item.id}
              metadata={parsed}
              isOwn={isMe}
            />
          );
        }
      } catch (e) {
        // Not JSON or missing type, fall through
      }

      // ... (MealLog logic remains same)
      let isMealLog = false;
      try {
        const parsed = JSON.parse(item.content);
        if (parsed && parsed.type === 'meal_log') {
          isMealLog = true;
        }
      } catch (e) {}

      if (isMealLog) {
        return <MealMessageCard content={item.content} isOwn={isMe} />;
      }

      return (
        <View style={[styles.messageContainer, isMe ? styles.myMessage : styles.theirMessage]}>
          <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.theirMessageText]}>
            {item.content}
          </Text>
          <Text style={[styles.timestamp, isMe ? styles.myTimestamp : styles.theirTimestamp]}>
            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      );
    };

    return (
      <View>
        {showUnreadSeparator && (
          <View style={styles.unreadSeparator}>
            <View style={styles.unreadSeparatorLine} />
            <View style={styles.unreadSeparatorBadge}>
              <Text style={styles.unreadSeparatorText}>{messages.length - index} NEW MESSAGES</Text>
            </View>
            <View style={styles.unreadSeparatorLine} />
          </View>
        )}
        {renderContent()}
      </View>
    );
  };

  return (
    <View style={styles.container}>
        {/* ... (Header and Message List remain same - need to ensure we don't overwrite them) */}
        {/* Since I'm replacing a large chunk, I need to be careful. 
            I'll assume the structure is standard and just wrap the return. 
            Wait, I can't see the return statement in the previous view_file. 
            I should probably view the end of the file first to be safe. 
        */}
        {/* Actually, I'll just use the existing structure and inject the modal at the end */}
        
        <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
        </View>

        <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
            style={styles.keyboardAvoidingView}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
            <FlatList
                ref={flatListRef}
                data={messages.slice().reverse()}
                keyExtractor={(item) => item.id}
                renderItem={renderMessage}
                contentContainerStyle={styles.messageList}
                inverted
                onScroll={handleScroll}
                scrollEventThrottle={16}
                onScrollToIndexFailed={(info) => {
                  const wait = new Promise(resolve => setTimeout(resolve, 500));
                  wait.then(() => {
                    flatListRef.current?.scrollToIndex({ index: info.index, animated: true });
                  });
                }}
            />
            
            {/* Scroll to bottom button */}
            {showScrollButton && (
              <TouchableOpacity
                style={styles.scrollToBottomButton}
                onPress={scrollToBottom}
              >
                <ArrowDown size={20} color="#3B82F6" />
              </TouchableOpacity>
            )}
            
            {/* Input Area */}
            <View style={styles.inputContainer}>
                <TextInput
                    style={styles.input}
                    placeholder="Type a message..."
                    value={newMessage}
                    onChangeText={setNewMessage}
                    multiline
                />
                <TouchableOpacity 
                    style={[styles.sendButton, !newMessage.trim() && styles.sendButtonDisabled]} 
                    onPress={sendMessage}
                    disabled={!newMessage.trim()}
                >
                    <Send size={20} color="#FFFFFF" />
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>

        {postponeData && (
            <PostponeModal
                visible={postponeModalVisible}
                onClose={() => setPostponeModalVisible(false)}
                onConfirm={handleConfirmPostpone}
                coachId={postponeData.sessionData.coachId} // Ensure sessionData has coachId
                clientId={client?.id}
                sessionId={postponeData.sessionId}
                initialDate={postponeData.sessionData.timestamp}
            />
        )}
    </View>
  );
}



const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageList: {
    padding: 16,
    gap: 12,
  },
  messageContainer: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 4,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#3B82F6',
    borderBottomRightRadius: 4,
  },
  theirMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 24,
  },
  myMessageText: {
    color: '#FFFFFF',
  },
  theirMessageText: {
    color: '#111827',
  },
  timestamp: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  myTimestamp: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  theirTimestamp: {
    color: '#9CA3AF',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    alignItems: 'center',
    gap: 12,
  },
  input: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#93C5FD',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 4,
  },
  sentBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#3B82F6',
    borderBottomRightRadius: 4,
  },
  receivedBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sentText: {
    color: '#FFFFFF',
  },
  receivedText: {
    color: '#111827',
  },
  taskMessageContainer: {
    width: '100%',
    marginVertical: 4,
    backgroundColor: '#ECFDF5', // Light green
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#10B981', // Green border
    overflow: 'hidden',
  },
  taskHeader: {
    padding: 12,
    backgroundColor: '#D1FAE5',
    borderBottomWidth: 1,
    borderBottomColor: '#10B981',
  },
  taskTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#065F46',
  },
  taskContent: {
    padding: 12,
  },
  taskName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#064E3B',
    marginBottom: 4,
  },
  taskTime: {
    fontSize: 12,
    color: '#047857',
    marginBottom: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#10B981',
    opacity: 0.3,
    marginBottom: 8,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleText: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '500',
  },
  taskDetails: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(16, 185, 129, 0.2)',
  },
  detailText: {
    fontSize: 12,
    color: '#047857',
    marginBottom: 4,
  },
  bannerContainer: {
    width: '100%',
    height: 150,
    backgroundColor: '#F3F4F6',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(16, 185, 129, 0.2)',
  },
  bannerPressable: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerLoading: {
    position: 'absolute',
    zIndex: 1,
  },
  bannerOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 8,
    alignItems: 'center',
  },
  bannerText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height * 0.8,
  },
  modalLoader: {
    position: 'absolute',
    zIndex: 1,
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 10,
  },
  sessionBanner: {
    backgroundColor: '#3B82F6',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sessionBannerActive: {
    backgroundColor: '#10B981', // Green when active
    borderBottomWidth: 2,
    borderBottomColor: '#059669',
  },
  sessionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sessionTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.9,
  },
  sessionTime: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  joinButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  joinButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  joinButtonText: {
    color: '#3B82F6',
    fontSize: 12,
    fontWeight: '700',
  },
  joinButtonTextDisabled: {
    color: '#FFFFFF',
  },
  inviteContainer: {
    width: 280,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    marginVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  inviteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 8,
  },
  meetLogo: {
    width: 24,
    height: 24,
  },
  inviteTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  inviteBody: {
    padding: 16,
  },
  inviteDescription: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  inviteTime: {
    fontSize: 12,
    color: '#6B7280',
  },
  inviteActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  invitePostponeButton: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#F3F4F6',
  },
  invitePostponeText: {
    color: '#F59E0B',
    fontWeight: '600',
    fontSize: 14,
  },
  inviteJoinButton: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
  },
  inviteJoinText: {
    color: '#0284C7',
    fontWeight: '700',
    fontSize: 14,
  },
  inviteCancelled: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    opacity: 0.8,
  },
  invitePostponed: {
    borderColor: '#EAB308', // Yellow-500
    backgroundColor: '#FEFCE8', // Yellow-50
    borderWidth: 1,
    opacity: 1,
  },
  cancelledTag: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 'auto',
  },
  postponedTag: {
    backgroundColor: '#EAB308', // Yellow-500
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 'auto',
  },
  cancelledTagText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  cancellationReasonContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#FDE047', // Yellow-300
  },
  cancellationReasonLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#854D0E', // Yellow-800
    marginBottom: 2,
  },
  cancellationReasonText: {
    fontSize: 12,
    color: '#A16207', // Yellow-700
    fontStyle: 'italic',
  },
  unreadSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    marginHorizontal: 16,
  },
  unreadSeparatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  unreadSeparatorBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginHorizontal: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  unreadSeparatorText: {
    color: '#3B82F6',
    fontSize: 12,
    fontWeight: '600',
  },
  scrollButton: {
    position: 'absolute',
    bottom: 80,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  scrollToBottomButton: {
    position: 'absolute',
    right: 20,
    bottom: 100,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  scrollButtonBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#EF4444',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  scrollButtonBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
});
