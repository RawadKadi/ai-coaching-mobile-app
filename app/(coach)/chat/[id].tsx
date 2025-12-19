import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ProposedSession } from '@/lib/ai-scheduling-service';
import SchedulerModal from '@/components/SchedulerModal';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, LayoutAnimation, UIManager, Image, Modal, Pressable, Dimensions, Linking, Alert, Animated } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Send, ArrowLeft, ChevronDown, ChevronUp, Check, CheckCheck, ChevronLeft, X, Calendar, Video, ArrowDown } from 'lucide-react-native';
import MealMessageCard from '@/components/MealMessageCard';
import RescheduleProposalMessage from '@/components/RescheduleProposalMessage';
import { PinchGestureHandler, PanGestureHandler, State } from 'react-native-gesture-handler';

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
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 24,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    fontSize: 20,
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
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 4,
  },
  sentTimestamp: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  receivedTimestamp: {
    color: '#9CA3AF',
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
  scheduleButton: {
    marginLeft: 'auto',
    padding: 8,
  },
  sessionBanner: {
    backgroundColor: '#3B82F6',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  bannerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  joinButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  joinButtonText: {
    color: '#3B82F6',
    fontSize: 12,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: '#111827',
  },
  submitButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#93C5FD',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 24,
    textAlign: 'center',
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
  inviteCancelButton: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#F3F4F6',
  },
  inviteCancelText: {
    color: '#EF4444',
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
              resizeMode="cover"
              onLoadStart={() => setImageLoading(true)}
              onLoadEnd={() => setImageLoading(false)}
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

      {/* Full Screen Image Modal */}
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
          
          <Image 
            source={{ uri: data.imageUrl }} 
            style={styles.fullScreenImage} 
            resizeMode="contain"
            onLoadStart={() => setModalImageLoading(true)}
            onLoadEnd={() => setModalImageLoading(false)}
          />
        </View>
      </Modal>
    </View>
  );
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
    if (event.nativeEvent.oldState === State.ACTIVE) {
      lastScale.current *= event.nativeEvent.scale;
      scale.setValue(lastScale.current);
    }
  };

  const onPanEvent = Animated.event(
    [{ nativeEvent: { translationY: translateY } }],
    { useNativeDriver: true }
  );

  const onPanStateChange = (event: any) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      const { translationY } = event.nativeEvent;
      
      if (Math.abs(translationY) > 150) {
        onClose();
      } else {
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      }
      lastTranslateY.current = 0;
    }
  };

  return (
    <PanGestureHandler
      ref={panRef}
      onGestureEvent={onPanEvent}
      onHandlerStateChange={onPanStateChange}
      enabled={lastScale.current <= 1}
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
const SessionInviteMessage = ({ content, isOwn, status, onJoin, onCancel }: { content: any, isOwn: boolean, status?: string, onJoin: () => void, onCancel: () => void }) => {
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
          resizeMode="contain"
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
          <TouchableOpacity style={styles.inviteCancelButton} onPress={onCancel}>
            <Text style={styles.inviteCancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.inviteJoinButton} onPress={onJoin}>
            <Text style={styles.inviteJoinText}>Join Now</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const SessionInviteMessageWrapper = ({ 
  item, 
  parsed, 
  isOwn, 
  loadNextSession 
}: { 
  item: Message, 
  parsed: any, 
  isOwn: boolean,
  loadNextSession: () => void
}) => {
  // Fetch real-time session status from sessions table
  const [sessionStatus, setSessionStatus] = React.useState(parsed.status);
  const [cancellationReason, setCancellationReason] = React.useState(parsed.cancellationReason);
  
  // Sync state with props when they change (e.g. after local update)
  React.useEffect(() => {
    if (parsed.status) {
      setSessionStatus(parsed.status);
    }
    if (parsed.cancellationReason) {
      setCancellationReason(parsed.cancellationReason);
    }
  }, [parsed.status, parsed.cancellationReason]);

  React.useEffect(() => {
    const fetchSessionStatus = async () => {
      // Only fetch if we don't already have status from props
      if (!parsed.status) {
        const { data: session } = await supabase
          .from('sessions')
          .select('status, cancellation_reason')
          .eq('id', parsed.sessionId)
          .single();
        
        if (session) {
          setSessionStatus(session.status);
          setCancellationReason(session.cancellation_reason);
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
  }, [parsed.sessionId, parsed.status]);
  
  return (
    <SessionInviteMessage 
      content={{ ...parsed, cancellationReason }}
      isOwn={isOwn}
      status={sessionStatus}
      onJoin={() => {
        Linking.openURL(parsed.link);
        // If coach, update joined time
        if (isOwn) {
           supabase
            .from('sessions')
            .update({ coach_joined_at: new Date().toISOString() })
            .eq('id', parsed.sessionId)
            .then();
        }
      }}
      onCancel={() => {
        // Only coach can cancel via this button for now
        if (isOwn) {
           Alert.alert('Cancel Session', 'Are you sure?', [
             { text: 'No', style: 'cancel' },
             { text: 'Yes', onPress: async () => {
                try {
                  console.log('[CoachChat] Cancelling session:', parsed.sessionId);
                  
                  // Update session status in database
                  const { error: sessionError } = await supabase
                    .from('sessions')
                    .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
                    .eq('id', parsed.sessionId);
                  
                  if (sessionError) {
                    console.error('[CoachChat] ❌ Session update failed:', sessionError);
                    Alert.alert('Error', 'Failed to cancel session: ' + sessionError.message);
                    return;
                  }
                  
                  console.log('[CoachChat] ✅ Session cancelled in database');
                  
                  // Update local state immediately
                  setSessionStatus('cancelled');
                  loadNextSession();
                  
                  Alert.alert('Success', 'Session cancelled successfully');
                } catch (error: any) {
                  console.error('[CoachChat] ❌ Unexpected error:', error);
                  Alert.alert('Error', 'An unexpected error occurred: ' + error.message);
                }
             }}
           ]);
        } else {
          alert('Only the coach can cancel this session.');
        }
      }}
    />
  );
};



export default function CoachChat() {
  const { id, suggestedMessage } = useLocalSearchParams();
  const router = useRouter();
  const { user: profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState(suggestedMessage as string || '');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [clientProfile, setClientProfile] = useState<any>(null);
  const [coach, setCoach] = useState<any>(null);
  const [nextSession, setNextSession] = useState<any>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false); // Kept for backward compat if needed, but we'll use schedulerVisible
  const [schedulerVisible, setSchedulerVisible] = useState(false);
  const [allCoachSessions, setAllCoachSessions] = useState<any[]>([]);
  const [scheduling, setScheduling] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [modalImageLoading, setModalImageLoading] = useState(false);
  const [lastReadMessageId, setLastReadMessageId] = useState<string | null>(null);
  const [firstUnreadIndex, setFirstUnreadIndex] = useState<number>(-1);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (suggestedMessage) {
      setNewMessage(suggestedMessage as string);
    }
  }, [suggestedMessage]);

  useEffect(() => {
    if (profile && id) {
      loadChatData();
      loadNextSession();
    }
  }, [profile, id]);

  // Reload chat when screen comes into focus (fallback/ensure up-to-date)
  useFocusEffect(
    React.useCallback(() => {
      if (profile && id) {
        console.log('[CoachChat] Screen focused, reloading chat');
        loadChatData();
        loadNextSession();
      }
    }, [profile, id])
  );

  const loadAllCoachSessions = async () => {
      if (!coach) return;
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('coach_id', coach.id)
        .gte('scheduled_at', new Date().toISOString());
        
      if (!error && data) {
          setAllCoachSessions(data);
      }
  };

  const loadNextSession = async () => {
    try {
      if (!coach?.id) return;

      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('client_id', id)
        .eq('coach_id', coach.id)
        .eq('status', 'scheduled')
        .gt('scheduled_at', new Date().toISOString())
        .order('scheduled_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading next session:', error);
      }
      
      setNextSession(data);
    } catch (error) {
      console.error('Error loading next session:', error);
    }
  };

  const joinSession = async () => {
    if (!nextSession) return;
    
    try {
      // Mark coach as joined
      await supabase
        .from('sessions')
        .update({ coach_joined_at: new Date().toISOString() })
        .eq('id', nextSession.id);
        
      // Open link
      Linking.openURL(nextSession.meet_link);
      loadNextSession();
    } catch (error) {
      console.error('Error joining session:', error);
    }
  };

  const cancelSession = async () => {
    if (!nextSession) return;
    
    // Simple confirmation (in a real app use Alert.alert)
    if (!confirm('Are you sure you want to cancel this session?')) return;

    try {
      await supabase
        .from('sessions')
        .update({ 
          status: 'cancelled',
          cancelled_at: new Date().toISOString()
        })
        .eq('id', nextSession.id);

      // Send system message
      await supabase.from('messages').insert({
        sender_id: profile?.id,
        recipient_id: clientProfile.user_id,
        content: `❌ Session cancelled`,
        read: false,
        ai_generated: false
      });
        
      loadNextSession();
    } catch (error) {
      console.error('Error cancelling session:', error);
    }
  };

  const handleSaveSessions = async (proposedSessions: ProposedSession[]) => {
    if (!coach || !clientProfile) return;

    try {
      // Expand recurring sessions
      const sessionsToInsert: any[] = [];
      const WEEKS_TO_SCHEDULE = 4;

      proposedSessions.forEach(session => {
        if (session.recurrence === 'weekly') {
          // Generate 4 weeks of sessions
          const startDate = new Date(session.scheduled_at);
          for (let i = 0; i < WEEKS_TO_SCHEDULE; i++) {
            const nextDate = new Date(startDate);
            nextDate.setDate(startDate.getDate() + (i * 7));
            
            sessionsToInsert.push({
              coach_id: coach.id,
              client_id: clientProfile.id, // Use clientProfile.id here
              scheduled_at: nextDate.toISOString(),
              duration_minutes: session.duration_minutes,
              session_type: session.session_type,
              notes: session.notes,
              status: 'scheduled',
              is_locked: true,
              ai_generated: true,
              meet_link: `https://meet.jit.si/${coach.id}-${clientProfile.id}-${Date.now()}-${i}`,
            });
          }
        } else {
          // Single session
          sessionsToInsert.push({
            coach_id: coach.id,
            client_id: clientProfile.id, // Use clientProfile.id here
            scheduled_at: session.scheduled_at,
            duration_minutes: session.duration_minutes,
            session_type: session.session_type,
            notes: session.notes,
            status: 'scheduled',
            is_locked: true,
            ai_generated: true,
            meet_link: `https://meet.jit.si/${coach.id}-${clientProfile.id}-${Date.now()}`,
          });
        }
      });

      const { data: insertedSessions, error } = await supabase
        .from('sessions')
        .insert(sessionsToInsert)
        .select();

      if (error) throw error;
      
      // Send invite messages for the first session(s)
      // For simplicity, let's send for all created sessions or just the first one?
      // User said "replace instant schedule", so maybe just the first one is enough notification?
      // But if multiple are created, we should probably notify.
      // Let's send a message for each inserted session.
      
      if (insertedSessions) {
          for (const session of insertedSessions) {
              // Only send message for sessions in the near future (e.g. next 24h) or all?
              // User said "no need to send an instant message... only when it's time".
              // So I will NOT send a message here.
          }
      }

      Alert.alert('Success', 'Sessions scheduled successfully');
      loadNextSession();
      loadAllCoachSessions();
      setSchedulerVisible(false); // Close the scheduler modal
    } catch (error) {
      console.error('Error saving sessions:', error);
      Alert.alert('Error', 'Failed to save sessions');
    }
  };

  const scheduleSession = () => {
      setSchedulerVisible(true);
  };

  const loadChatData = async () => {
    try {
      setLoading(true);

      // 1. Get client's profile info
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('user_id, profiles:user_id(full_name)')
        .eq('id', id)
        .single();

      if (clientError) throw clientError;
      setClientProfile(clientData);

      const clientUserId = clientData.user_id;

      // 2. Load messages
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${profile?.id},recipient_id.eq.${clientUserId}),and(sender_id.eq.${clientUserId},recipient_id.eq.${profile?.id})`)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      setMessages(data || []);

      // Calculate first unread message
      if (data && data.length > 0) {
        const lastRead = lastReadMessageId;
        if (lastRead) {
          const lastReadIdx = data.findIndex(m => m.id === lastRead);
          const firstUnread = lastReadIdx + 1;
          if (firstUnread < data.length && !data[firstUnread].read) {
            setFirstUnreadIndex(firstUnread);
            // Auto-scroll to first unread on load
            setTimeout(() => {
              flatListRef.current?.scrollToIndex({
                index: firstUnread,
                animated: true,
                viewPosition: 0.1 // Show near top
              });
            }, 300);
          } else {
            setFirstUnreadIndex(-1);
          }
        } else {
          // Find first unread message from client
          const firstUnreadIdx = data.findIndex(m => !m.read && m.sender_id === clientUserId);
          setFirstUnreadIndex(firstUnreadIdx);
          if (firstUnreadIdx >= 0) {
            setTimeout(() => {
              flatListRef.current?.scrollToIndex({
                index: firstUnreadIdx,
                animated: true,
                viewPosition: 0.1
              });
            }, 300);
          }
        }
      }
      // Log session invite messages to verify cancelled status
      data?.forEach(msg => {
        try {
          const parsed = JSON.parse(msg.content);
          if (parsed.type === 'session_invite') {
            console.log('[CoachChat] Session invite message:', {
              id: msg.id,
              status: parsed.status,
              sessionId: parsed.sessionId
            });
          }
        } catch (e) {
          // Not JSON, skip
        }
      });
      
      setMessages(data || []);

      // 3. Subscribe to new messages
      console.log('[CoachChat] Setting up subscription for coach:', profile?.id);
      
      // Use unique channel ID
      loadNextSession();
      loadAllCoachSessions();
      
      const channel = supabase
        .channel(`chat:${id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
          },
          (payload) => {
            const newMessage = payload.new as Message;
            console.log('[CoachChat] Realtime event received:', newMessage);
            
            // Check if message belongs to this conversation
            // Either sent by client to coach, or sent by coach to client
            const isFromClient = newMessage.sender_id === clientUserId && newMessage.recipient_id === profile?.id;
            const isFromMe = newMessage.sender_id === profile?.id && newMessage.recipient_id === clientUserId;
            
            if (isFromClient || isFromMe) {
              console.log('[CoachChat] Adding relevant message to list');
              setMessages((current) => {
                if (current.find(m => m.id === newMessage.id)) return current;
                return [...current, newMessage];
              });
              
              if (isFromClient) {
                markAsRead(newMessage.id);
              }
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
            console.log('[CoachChat] UPDATE event received:', updatedMessage);
            
            const isFromClient = updatedMessage.sender_id === clientUserId && updatedMessage.recipient_id === profile?.id;
            const isFromMe = updatedMessage.sender_id === profile?.id && updatedMessage.recipient_id === clientUserId;
            
            if (isFromClient || isFromMe) {
              console.log('[CoachChat] Updating message in list');
              setMessages((current) => 
                current.map(msg => 
                  msg.id === updatedMessage.id ? updatedMessage : msg
                )
              );
            }
          }
        )
        .subscribe((status) => {
          console.log(`[CoachChat] Subscription status (chat:${id}):`, status);
        });

      return () => {
        console.log(`[CoachChat] Cleaning up subscription (chat:${id})`);
        supabase.removeChannel(channel);
      };

    } catch (error) {
      console.error('Error loading chat:', error);
    } finally {
      setLoading(false);
    }
  };

  const markMessagesAsRead = async () => {
    if (!messages.length || !profile?.id) return;
    
    const lastMessage = messages[messages.length - 1];
    setLastReadMessageId(lastMessage.id);
    setFirstUnreadIndex(-1);
    
    // Mark all unread messages from client as read in database
    const unreadIds = messages
      .filter(m => !m.read && m.sender_id === clientProfile?.user_id)
      .map(m => m.id);
    
    if (unreadIds.length > 0) {
      await supabase
        .from('messages')
        .update({ read: true })
        .in('id', unreadIds);
    }
  };

  const handleScroll = (event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const isAtBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - 50;
    setShowScrollButton(!isAtBottom);
    
    // Mark as read when scrolled to bottom
    if (isAtBottom && messages.length > 0) {
      markMessagesAsRead();
    }
  };

  const scrollToBottom = () => {
    flatListRef.current?.scrollToEnd({ animated: true });
    markMessagesAsRead();
  };

  const markAsRead = async (messageId: string) => {
    await supabase.from('messages').update({ read: true }).eq('id', messageId);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !profile || !clientProfile) return;

    try {
      setSending(true);

      const message = {
        sender_id: profile.id,
        recipient_id: clientProfile.user_id,
        content: newMessage.trim(),
        read: false,
        ai_generated: false,
      };

      const { data, error } = await supabase
        .from('messages')
        .insert(message)
        .select()
        .single();

      if (error) throw error;

      setMessages([...messages, data]);
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item, index }: { item: Message, index: number }) => {
    const isOwn = item.sender_id === profile?.id;
    const showUnreadSeparator = index === firstUnreadIndex;
    
    const renderContent = () => {
      let parsed: any = null;
      try {
        if (typeof item.content === 'object' && item.content !== null) {
          parsed = item.content;
        } else if (typeof item.content === 'string' && (item.content.trim().startsWith('{') || item.content.trim().startsWith('['))) {
          parsed = JSON.parse(item.content);
          if (typeof parsed === 'string') {
            parsed = JSON.parse(parsed);
          }
        }
      } catch (e) {
        // Not JSON
      }

      if (parsed && parsed.type) {
        if (parsed.type === 'task_completion') {
          return <TaskCompletionMessage content={item.content} isOwn={isOwn} />;
        }
        if (parsed.type === 'session_invite') {
          return (
            <SessionInviteMessageWrapper 
              item={item}
              parsed={parsed}
              isOwn={isOwn}
              loadNextSession={loadNextSession}
            />
          );
        }
        if (parsed.type === 'reschedule_proposal') {
          return (
            <RescheduleProposalMessage 
              messageId={item.id}
              metadata={parsed}
              isOwn={isOwn}
            />
          );
        }
        if (parsed.type === 'meal_log') {
          return <MealMessageCard content={item.content} isOwn={isOwn} />;
        }
      }

      return (
        <View style={[styles.messageContainer, isOwn ? styles.myMessage : styles.theirMessage]}>
          <Text style={[styles.messageText, isOwn ? styles.myMessageText : styles.theirMessageText]}>
            {item.content}
          </Text>
          <View style={styles.messageFooter}>
            <Text style={[styles.timestamp, isOwn ? styles.sentTimestamp : styles.receivedTimestamp]}>
              {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            {isOwn && (
              item.read ? 
                <CheckCheck size={14} color="rgba(255, 255, 255, 0.7)" /> : 
                <Check size={14} color="rgba(255, 255, 255, 0.7)" />
            )}
          </View>
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>
          {clientProfile?.profiles?.full_name || 'Chat'}
        </Text>
        <TouchableOpacity onPress={() => setShowScheduleModal(true)} style={styles.scheduleButton}>
          <Calendar size={24} color="#3B82F6" />
        </TouchableOpacity>
      </View>

      {nextSession && (
        <View style={styles.sessionBanner}>
          <View style={styles.sessionInfo}>
            <Video size={20} color="#FFFFFF" />
            <View>
              <Text style={styles.sessionTitle}>Next Session</Text>
              <Text style={styles.sessionTime}>
                {new Date(nextSession.scheduled_at).toLocaleDateString()} at {new Date(nextSession.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          </View>
          <View style={styles.bannerActions}>
            <TouchableOpacity style={styles.actionButton} onPress={cancelSession}>
              <Text style={styles.actionButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.joinButton} onPress={joinSession}>
              <Text style={styles.joinButtonText}>Join Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messageList}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          onScrollToIndexFailed={(info) => {
            const wait = new Promise(resolve => setTimeout(resolve, 500));
            wait.then(() => {
              flatListRef.current?.scrollToIndex({ index: info.index, animated: true });
            });
          }}
        />
      )}

      {showScrollButton && (
        <TouchableOpacity 
          style={styles.scrollButton} 
          onPress={scrollToBottom}
          activeOpacity={0.8}
        >
          <ArrowDown size={20} color="#3B82F6" />
          {firstUnreadIndex !== -1 && (
            <View style={styles.scrollButtonBadge}>
              <Text style={styles.scrollButtonBadgeText}>
                {messages.length - firstUnreadIndex}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        style={styles.inputContainer}
      >
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
          disabled={!newMessage.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Send size={20} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      </KeyboardAvoidingView>

      {/* Scheduler Modal */}
      {clientProfile && (
        <SchedulerModal
          visible={schedulerVisible}
          onClose={() => setSchedulerVisible(false)}
          onConfirm={handleSaveSessions}
          clientContext={{
            name: clientProfile.profiles?.full_name || 'Client',
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          }}
          existingSessions={allCoachSessions}
          targetClientId={clientProfile.id}
        />
      )}
    </View>
  );
}

