import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  FlatList, 
  KeyboardAvoidingView, 
  Platform, 
  ActivityIndicator, 
  UIManager, 
  Modal, 
  Pressable, 
  Dimensions, 
  Alert, 
  Animated,
  StatusBar,
  TextInput
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/BrandContext';
import { useUnread } from '@/contexts/UnreadContext';
import { useNotification } from '@/contexts/NotificationContext';
import { supabase } from '@/lib/supabase';
import { 
  ArrowLeft, 
  Check, 
  CheckCheck, 
  Calendar, 
  Activity,
  Reply,
  MoreVertical,
  ArrowDown,
  X
} from 'lucide-react-native';
import { BrandedAvatar } from '@/components/BrandedAvatar';
import { safeBack } from '@/lib/navigation-utils';
import { ChatInputBar } from '@/components/ChatInputBar';
import ChatMediaMessage from '@/components/ChatMediaMessage';
import SchedulerModal from '@/components/SchedulerModal';
import { MessageOverlay } from '@/components/MessageOverlay';
import MealMessageCard from '@/components/MealMessageCard';
import { uploadChatMedia } from '@/lib/uploadChatMedia';
import { mediaDownloadManager } from '@/lib/MediaDownloadManager';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TypingIndicator } from '@/components/TypingIndicator';
import { usePresence } from '@/contexts/PresenceContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
import { MotiView, AnimatePresence } from 'moti';
import { Swipeable } from 'react-native-gesture-handler';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Message = {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: string;
  read: boolean;
  reply_to_id?: string;
  ai_generated?: boolean;
  isUploading?: boolean;
  progress?: number;
  cid?: string;
};

// Helper to detect if a message content is a media-type or system card
function isMediaMessage(content: string): boolean {
  if (!content || typeof content !== 'string') return false;
  const s = content.trim();
  // If it starts with { and contains "type" and "url" (or just "type" for meal logs), it's media.
  const hasType = s.includes('"type"');
  const hasUrl = s.includes('"url"');
  const hasTask = s.includes('"taskName"');
  const isMeal = s.includes('"type":"meal"');
  
  return s.startsWith('{') && (hasType && (hasUrl || hasTask || isMeal));
}


export default function CoachChatScreen() {
  const { id } = useLocalSearchParams(); 
  const router = useRouter();
  const { user, profile } = useAuth();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { refreshUnreadCount } = useUnread();
  const { suppressToast } = useNotification();
  const { isUserOnline, onlineUserIds, lastSeenMap } = usePresence();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientProfile, setClientProfile] = useState<any>(null);
  const [clientUserId, setClientUserId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [schedulerVisible, setSchedulerVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [todaySession, setTodaySession] = useState<any>(null);
  const [cancellingSessionId, setCancellingSessionId] = useState<string | null>(null);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [isSubmittingCancellation, setIsSubmittingCancellation] = useState(false);
  const [reschedulingMessageId, setReschedulingMessageId] = useState<string | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [activeMessageForMenu, setActiveMessageForMenu] = useState<Message | null>(null);
  const [pressedMessageId, setPressedMessageId] = useState<string | null>(null);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [enlargedAvatar, setEnlargedAvatar] = useState<string | null>(null);
  const [editingMessage, setEditingMessage] = useState<{ id: string; text: string } | null>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const showScrollBottomRef = useRef(false);
  const [newMessagesCount, setNewMessagesCount] = useState(0);

  useEffect(() => {
    showScrollBottomRef.current = showScrollBottom;
  }, [showScrollBottom]);
  
  const scrollToBottom = () => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    setNewMessagesCount(0);
  };
  
  // Debug presence
  useEffect(() => {
    if (clientUserId) {
      console.log(`[CoachChat] Presence Debug for ${clientUserId}:`, {
        isOnline: isUserOnline(clientUserId),
        inOnlineSet: onlineUserIds.has(clientUserId.toLowerCase()),
        lastSeen: lastSeenMap[clientUserId.toLowerCase()]
      });
    }
  }, [clientUserId, onlineUserIds, lastSeenMap]);
  
  const flatListRef = useRef<FlatList>(null);
  const swipeableRefs = useRef<{ [key: string]: Swipeable | null }>({});
  // Buffer for messages that arrive before clientUserId is resolved
  const pendingBuffer = useRef<Message[]>([]);
  // Keep a stable ref to clientUserId so real-time callbacks always see latest value
  const clientUserIdRef = useRef<string | null>(null);
  // Broadcast channel for guaranteed real-time reaction delivery
  const reactionChannelRef = useRef<any>(null);

  useEffect(() => {
    clientUserIdRef.current = clientUserId;
  }, [clientUserId]);

  useEffect(() => {
    if (user && id) {
      loadChatData();
    }
  }, [user?.id, id]);

  // Real-time channel — only depends on user.id and id, NOT clientUserId.
  // This prevents the channel from being destroyed/recreated when clientUserId resolves.
  useEffect(() => {
    if (!user || !id) return;

    const channelId = `coach-chat-rt-${id}-${user.id}`;

    const channel = supabase.channel(channelId)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages',
        filter: `recipient_id=eq.${user.id}` 
      }, (p) => {
        const nm = p.new as Message;
        const cUid = clientUserIdRef.current;
        if (cUid && nm.sender_id === cUid) {
          processIncoming(nm);
        } else if (!cUid) {
          console.log('[CoachChat] Buffering incoming (clientUserId not ready):', nm.id);
          pendingBuffer.current.push(nm);
        }
      })
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages',
        filter: `sender_id=eq.${user.id}`
      }, (p) => {
        const nm = p.new as Message;
        const cUid = clientUserIdRef.current;
        if (cUid && nm.recipient_id === cUid) {
          processOutgoingEcho(nm);
        } else if (!cUid) {
          pendingBuffer.current.push(nm);
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (p) => {
        const updated = p.new as Message;
        // Use ID-based matching — sender_id/recipient_id may be absent when
        // REPLICA IDENTITY is not set to FULL on the messages table.
        setMessages(prev => {
          const exists = prev.some(m => m.id === updated.id);
          if (!exists) return prev;
          return prev.map(m => m.id === updated.id ? { ...m, ...updated } : m);
        });
      })
      .subscribe((status) => {
        console.log('[CoachChat] Channel status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, id]); // ← Stable: no clientUserId dependency

  // Broadcast channel — shared with client, used for guaranteed reaction delivery.
  // Keyed by sorted user IDs so both sides join the same channel name.
  useEffect(() => {
    if (!user || !clientUserId) return;
    const key = [user.id, clientUserId].sort().join('-');
    const ch = supabase
      .channel(`chat-reactions-${key}`)
      .on('broadcast', { event: 'reaction_update' }, ({ payload }) => {
        // Handle reactions broadcast from the other side
        setMessages(prev =>
          prev.map(m => m.id === payload.messageId ? { ...m, content: payload.content } : m)
        );
      })
      .on('broadcast', { event: 'message_edit' }, ({ payload }) => {
        // Handle message edits broadcast from the other side
        setMessages(prev =>
          prev.map(m => m.id === payload.messageId ? { ...m, content: payload.content } : m)
        );
      })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        setIsOtherTyping(payload.isTyping);
      })
      .subscribe();
    reactionChannelRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, clientUserId]); // Fixed dependency

  // Fetch today's session for this client
  useEffect(() => {
    if (!clientUserId) return;
    
    const fetchTodaySession = async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('client_id', clientUserId)
        .eq('status', 'scheduled')
        .gte('scheduled_at', today.toISOString())
        .lt('scheduled_at', tomorrow.toISOString())
        .order('scheduled_at', { ascending: true })
        .limit(1);

      if (!error && data && data.length > 0) {
        setTodaySession(data[0]);
      } else {
        setTodaySession(null);
      }
    };

    fetchTodaySession();
    
    // Subscribe to session changes
    const channel = supabase.channel(`sessions-${clientUserId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'sessions',
        filter: `client_id=eq.${clientUserId}`
      }, () => {
        fetchTodaySession();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [clientUserId]);

  // Flush buffered messages once clientUserId is known
  useEffect(() => {
    if (!clientUserId || pendingBuffer.current.length === 0) return;
    console.log('[CoachChat] Flushing', pendingBuffer.current.length, 'buffered messages');
    const toFlush = [...pendingBuffer.current];
    pendingBuffer.current = [];
    toFlush.forEach(nm => {
      if (nm.sender_id === clientUserId) processIncoming(nm);
      else if (nm.recipient_id === clientUserId) processOutgoingEcho(nm);
    });
  }, [clientUserId]);

  const processIncoming = (nm: Message) => {
    setMessages(prev => {
      if (prev.some(m => m.id === nm.id)) return prev;
      return [nm, ...prev];
    });
    markAsRead(nm.id);
    if (showScrollBottomRef.current) {
      setNewMessagesCount(prev => prev + 1);
    }
  };

  const processOutgoingEcho = (nm: Message) => {
    setMessages(prev => {
      if (prev.some(m => m.id === nm.id)) return prev;

      // Deduplicate by CID
      let echoCid: string | undefined;
      try { echoCid = JSON.parse(nm.content).cid; } catch {}

      if (echoCid) {
        // Look for the optimistic message by CID
        const existingIdx = prev.findIndex(m => m.cid === echoCid);
        if (existingIdx !== -1) {
          const updated = [...prev];
          updated[existingIdx] = nm;
          return updated;
        }
      }
      return [nm, ...prev];
    });
  };

  const loadChatData = async () => {
    try {
      setLoading(true);
      const { data: cData, error: cError } = await supabase.rpc('get_client_details', { target_client_id: id });
      if (cError) throw cError;
      
      setClientProfile(cData);
      setClientUserId(cData.user_id);
      clientUserIdRef.current = cData.user_id;
      
      // Fetch fresh last_seen_at for initial state
      const { data: pData } = await supabase
        .from('profiles')
        .select('last_seen_at')
        .eq('id', cData.user_id)
        .single();
        
      if (pData?.last_seen_at) {
        // We don't strictly need to set it here if PresenceContext handles it,
        // but it helps the UI update immediately.
        console.log('[CoachChat] Initial last_seen_at:', pData.last_seen_at);
      }

      console.log('[CoachChat] Resolved clientUserId:', cData.user_id);

      const { data: mData, error: mError } = await supabase.from('messages')
        .select('*')
        .or(`and(sender_id.eq.${user?.id},recipient_id.eq.${cData.user_id}),and(sender_id.eq.${cData.user_id},recipient_id.eq.${user?.id})`)
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (mError) throw mError;
      setMessages(mData || []);
    } catch (e) { 
        console.error('[CoachChat] Error:', e); 
    } finally { 
        setLoading(false); 
    }
  };

  const markAsRead = async (mid: string) => {
    await supabase.from('messages').update({ read: true }).eq('id', mid);
    refreshUnreadCount();
  };

  const markMessagesAsRead = async (msgs?: Message[]) => {
    const list = msgs || messages;
    if (!list.length || !user?.id) return;
    const unreadIds = list.filter(m => !m.read && m.recipient_id === user.id).map(m => m.id);
    if (unreadIds.length > 0) {
      await supabase.from('messages').update({ read: true }).in('id', unreadIds);
      refreshUnreadCount();
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (user && id) {
        markMessagesAsRead();
        if (clientUserId) {
          suppressToast(clientUserId);
        } else {
          suppressToast(true);
        }
      }
      return () => {
        suppressToast(false);
      };
    }, [user?.id, id, messages, clientUserId])
  );

  const handleSendText = async (text: string, replyId?: string) => {
    if (!profile || !clientUserId) return;
    setSending(true);
    const msg = { sender_id: user?.id, recipient_id: clientUserId, content: text, read: false, reply_to_id: replyId, ai_generated: false };
    const { error } = await supabase.from('messages').insert(msg);
    if (error) Alert.alert('Error', 'Failed to send');
    setSending(false);
    setReplyingTo(null);
    scrollToBottom();
  };

  const handleTyping = (isTyping: boolean) => {
    reactionChannelRef.current?.send({
      type: 'broadcast',
      event: 'typing',
      payload: { isTyping, userId: user?.id },
    });
  };

  const handleSendMedia = async (jsonContent: string, replyId?: string) => {
    if (!profile || !clientUserId) return;
    
    let parsedContent: any = {};
    try {
      parsedContent = JSON.parse(jsonContent);
    } catch (e) {
      console.error('[CoachChat] Failed to parse media content:', e);
      return;
    }

    const cid = `c-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const tempId = `temp-${Date.now()}`;
    
    const contentWithCid = JSON.stringify({ ...parsedContent, cid });

    const optimisticMsg: Message = {
      id: tempId,
      sender_id: user?.id || '',
      recipient_id: clientUserId,
      content: contentWithCid,
      created_at: new Date().toISOString(),
      read: false,
      reply_to_id: replyId,
      ai_generated: false,
      isUploading: true,
      progress: 0,
      cid
    };

    setMessages(prev => [optimisticMsg, ...prev]);
    scrollToBottom();

    let finalContent = contentWithCid;
    try {
      if (parsedContent.isOptimistic && parsedContent.url && !parsedContent.url.startsWith('http')) {
        const folder = 
          parsedContent.type === 'video' ? 'videos' : 
          parsedContent.type === 'audio' ? 'audio' :
          parsedContent.type === 'document' ? 'documents' : 'images';
        
        const publicUrl = await uploadChatMedia(
          parsedContent.url, 
          folder, 
          (pct) => {
            setMessages(prev => prev.map(m => m.id === tempId ? { ...m, progress: pct } : m));
          }
        );

        // Handle thumbnail upload if present (local URI)
        if (parsedContent.thumbnailUrl && !parsedContent.thumbnailUrl.startsWith('http')) {
          try {
            const thumbUrl = await uploadChatMedia(parsedContent.thumbnailUrl, 'thumbnails');
            parsedContent.thumbnailUrl = thumbUrl;
          } catch (e) {
            console.warn('Failed to upload thumbnail:', e);
          }
        }

        finalContent = JSON.stringify({ ...parsedContent, url: publicUrl, isOptimistic: false, cid });
        // Pre-warm cache so sender sees own media instantly
        mediaDownloadManager.markRemoteAvailable(publicUrl);
      }

      const { data: insertedData, error } = await supabase.from('messages').insert({ 
        sender_id: user?.id, 
        recipient_id: clientUserId, 
        content: finalContent, 
        read: false, 
        reply_to_id: replyId, 
        ai_generated: false 
      }).select().single();

      if (error) throw error;

      if (insertedData) {
        setMessages(prev => prev.map(m => m.id === tempId ? insertedData : m));
      }
    } catch (e: any) {
      console.error('[CoachChat] Media upload/send failed:', e);
      Alert.alert('Send Error', 'Failed to send media: ' + (e.message || 'Unknown error'));
      setMessages(prev => prev.filter(m => m.id !== tempId));
    } finally {
      setSending(false);
      setReplyingTo(null);
    }
  };

  const handleCancelSession = async (sessionId: string) => {
    setCancellingSessionId(sessionId);
    setSelectedReason(null);
    setCancellationReason('');
  };

  const submitCancellation = async () => {
    if (!cancellingSessionId) return;
    
    let finalReason = selectedReason;
    if (selectedReason === 'Other') {
      if (!cancellationReason.trim()) {
        Alert.alert('Reason Required', 'Please type your reason.');
        return;
      }
      finalReason = cancellationReason;
    }

    if (!finalReason) {
      Alert.alert('Reason Required', 'Please select a reason.');
      return;
    }
    
    setIsSubmittingCancellation(true);
    try {
      // 1. Update session status
      const { error: sessionError } = await supabase
        .from('sessions')
        .update({ 
          status: 'cancelled', 
          cancellation_reason: finalReason 
        })
        .eq('id', cancellingSessionId);
      
      if (sessionError) throw sessionError;

      // 2. Find and update the chat message(s) that reference this session in local state
      const messagesToUpdate = messages.filter(m => {
        try {
          const p = JSON.parse(m.content);
          return p.sessionId === cancellingSessionId;
        } catch { return false; }
      });
      
      if (messagesToUpdate.length > 0) {
        for (const msg of messagesToUpdate) {
          try {
            const p = JSON.parse(msg.content);
            const updatedContent = JSON.stringify({
              ...p,
              status: 'cancelled',
              cancellation_reason: finalReason
            });
            
            // Update DB
            await supabase.from('messages').update({ content: updatedContent }).eq('id', msg.id);
            
            // Update local state immediately for real-time feel
            setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, content: updatedContent } : m));

            // Broadcast the update
            reactionChannelRef.current?.send({
              type: 'broadcast',
              event: 'message_edit',
              payload: { messageId: msg.id, content: updatedContent }
            });
          } catch (e) {
            console.error('[CoachChat] Error updating message:', e);
          }
        }
      } else {
        // Fallback: If not found in local state, try searching DB (robustness)
        const { data: dbMessages } = await supabase
          .from('messages')
          .select('*')
          .ilike('content', `%${cancellingSessionId}%`);
        
        if (dbMessages) {
          for (const msg of dbMessages) {
            try {
              const p = JSON.parse(msg.content);
              if (p.sessionId !== cancellingSessionId) continue;

              const updatedContent = JSON.stringify({
                ...p,
                status: 'cancelled',
                cancellation_reason: finalReason
              });
              await supabase.from('messages').update({ content: updatedContent }).eq('id', msg.id);
              
              // Broadcast the update
              reactionChannelRef.current?.send({
                type: 'broadcast',
                event: 'message_edit',
                payload: { messageId: msg.id, content: updatedContent }
              });
            } catch (e) {}
          }
        }
      }

      setCancellingSessionId(null);
      setSelectedReason(null);
      setCancellationReason('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setIsSubmittingCancellation(false);
    }
  };

  const handleRescheduleSession = (sessionId: string) => {
    // Find the message associated with this session to mark it as rescheduled later
    const msg = messages.find(m => {
      try {
        const p = JSON.parse(m.content);
        return p.sessionId === sessionId;
      } catch { return false; }
    });
    
    if (msg) {
      setReschedulingMessageId(msg.id);
    } else {
      setReschedulingMessageId(null);
    }
    setSchedulerVisible(true);
  };

  const handleAction = async (action: 'reply' | 'copy' | 'delete' | 'forward' | 'edit' | 'reschedule') => {
    if (!activeMessageForMenu) return;
    
    if (action === 'edit') {
      // Only allow editing own messages
      if (activeMessageForMenu.sender_id !== user?.id) return;
      let currentText = activeMessageForMenu.content;
      try {
        const p = JSON.parse(activeMessageForMenu.content);
        if (p.text) currentText = p.text;
      } catch {}
      setEditingMessage({ id: activeMessageForMenu.id, text: currentText });
      setActiveMessageForMenu(null);
      return;
    } else if (action === 'reply') {
      setReplyingTo(activeMessageForMenu);
    } else if (action === 'copy') {
      let textToCopy = activeMessageForMenu.content;
      try {
        const p = JSON.parse(activeMessageForMenu.content);
        if (p.text) textToCopy = p.text;
      } catch {}
      await Clipboard.setStringAsync(textToCopy);
    } else if (action === 'delete') {
      if (activeMessageForMenu.sender_id !== user?.id) {
        Alert.alert('Access Denied', 'You can only delete your own messages.');
        return;
      }

      const msgId = activeMessageForMenu.id;
      const deletedContent = JSON.stringify({
        type: 'deleted',
        deleted_by: user?.id,
        original_type: 'text'
      });

      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: deletedContent } : m));
      
      const { error } = await supabase.from('messages').update({ content: deletedContent }).eq('id', msgId);
      if (error) {
        Alert.alert('Error', 'Failed to delete message: ' + error.message);
      }
    } else if (action === 'reschedule') {
      setReschedulingMessageId(activeMessageForMenu.id);
      setSchedulerVisible(true);
    }
    setActiveMessageForMenu(null);
  };

  const handleReaction = async (emoji: string) => {
    if (!activeMessageForMenu || !user) return;

    const msgId = activeMessageForMenu.id;

    // Always read from the LIVE messages state so reactions build on latest data
    const currentMsg = messages.find(m => m.id === msgId) || activeMessageForMenu;
    let currentContent: any = {};
    try {
      currentContent = JSON.parse(currentMsg.content);
    } catch {
      currentContent = { text: currentMsg.content, type: 'text' };
    }

    const reactions = currentContent.reactions || [];
    const existingIndex = reactions.findIndex((r: any) => r.user_id === user.id && r.emoji === emoji);
    let newReactions = [...reactions];
    if (existingIndex > -1) {
      newReactions.splice(existingIndex, 1);
    } else {
      newReactions.push({ emoji, user_id: user.id });
    }

    const optimisticContent = JSON.stringify({ ...currentContent, reactions: newReactions });

    // Optimistic update so the sender sees the reaction immediately
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: optimisticContent } : m));
    setActiveMessageForMenu(null);

    // Broadcast IMMEDIATELY for real-time delivery — don't wait for DB
    reactionChannelRef.current?.send({
      type: 'broadcast',
      event: 'reaction_update',
      payload: { messageId: msgId, content: optimisticContent },
    });

    // Persist to DB: try direct update first (coach is recipient for client messages)
    const { error } = await supabase
      .from('messages')
      .update({ content: optimisticContent })
      .eq('id', msgId);

    if (error) {
      // Direct update blocked by RLS — fall back to SECURITY DEFINER RPC
      const { data: savedContent, error: rpcError } = await supabase.rpc('toggle_message_reaction', {
        p_message_id: msgId,
        p_emoji: emoji,
      });
      if (rpcError) {
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: currentMsg.content } : m));
        Alert.alert('Error', 'Failed to save reaction: ' + rpcError.message);
      } else if (savedContent && savedContent !== optimisticContent) {
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: savedContent } : m));
        reactionChannelRef.current?.send({
          type: 'broadcast',
          event: 'reaction_update',
          payload: { messageId: msgId, content: savedContent },
        });
      }
    }
  };

  const handleConfirmEdit = async (newText: string, messageId: string) => {
    // Build updated content preserving existing fields (reactions, etc.)
    const currentMsg = messages.find(m => m.id === messageId);
    let currentContent: any = {};
    try {
      currentContent = JSON.parse(currentMsg?.content || '{}');
    } catch {
      currentContent = {};
    }
    const updatedContent = JSON.stringify({ ...currentContent, text: newText, type: currentContent.type || 'text', is_edited: true });

    // Optimistic update
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content: updatedContent } : m));
    setEditingMessage(null);

    const { error } = await supabase.from('messages').update({ content: updatedContent }).eq('id', messageId);
    if (error) {
      Alert.alert('Error', 'Failed to edit message: ' + error.message);
      // Revert optimistic
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content: currentMsg?.content || m.content } : m));
    } else {
      // Broadcast edit to the other side
      reactionChannelRef.current?.send({
        type: 'broadcast',
        event: 'message_edit',
        payload: { messageId, content: updatedContent },
      });
    }
  };

  const scrollToMessage = useCallback((messageId: string) => {
     const idx = messages.findIndex(m => m.id === messageId);
     if (idx !== -1) {
         flatListRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5, viewOffset: 80 });
         setHighlightedMessageId(messageId);
         setTimeout(() => setHighlightedMessageId(null), 1500);
     }
  }, [messages]);

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.sender_id === user?.id;
    const isMedia = isMediaMessage(item.content);

    const renderLeftActions = (progress: any, dragX: any) => {
        const trans = dragX.interpolate({ inputRange: [0, 100], outputRange: [0, 1], extrapolate: 'clamp' });
        return (
            <View style={{ width: 60, justifyContent: 'center', alignItems: 'center' }}>
                <Animated.View style={{ transform: [{ scale: trans }] }}><Reply size={24} color="#3B82F6" /></Animated.View>
            </View>
        );
    };

    return (
      <Swipeable
        ref={ref => { if (ref) swipeableRefs.current[item.id] = ref; }}
        renderLeftActions={renderLeftActions}
        onSwipeableWillOpen={() => { setReplyingTo(item); swipeableRefs.current[item.id]?.close(); }}
        friction={1} overshootLeft={false} containerStyle={{ marginBottom: 16 }}
      >
          <View style={{ width: '100%', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
              {isMedia ? (
                <View>
                  <ChatMediaMessage 
                    content={item.content} 
                    isOwn={isMe} 
                    createdAt={item.created_at} 
                    isRead={item.read} 
                    isUploading={item.isUploading}
                    progress={item.progress}
                    onLongPress={() => { 
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); 
                        setActiveMessageForMenu(item); 
                    }}
                    onCancelSession={handleCancelSession}
                    onRescheduleSession={handleRescheduleSession}
                    senderAvatarUrl={isMe ? profile?.avatar_url : clientProfile?.profiles?.avatar_url}
                    senderName={isMe ? profile?.full_name : clientProfile?.profiles?.full_name}
                  />
                {/* Reactions on media messages */}
                {(() => {
                  try {
                    const p = JSON.parse(item.content);
                    const reactions = p.reactions || [];
                    if (reactions.length === 0) return null;
                    return (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 4, marginLeft: isMe ? 0 : 4, alignSelf: isMe ? 'flex-end' : 'flex-start' }}>
                        {Object.entries(reactions.reduce((acc: any, r: any) => { acc[r.emoji] = (acc[r.emoji] || 0) + 1; return acc; }, {}))
                          .map(([emoji, count]: any) => (
                            <View key={emoji} style={{ backgroundColor: '#1E293B', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', flexDirection: 'row', alignItems: 'center', marginRight: 4, marginBottom: 4 }}>
                              <Text style={{ fontSize: 12 }}>{emoji}</Text>
                              {count > 1 && <Text style={{ fontSize: 10, color: 'white', marginLeft: 4, fontWeight: 'bold' }}>{count}</Text>}
                            </View>
                          ))}
                      </View>
                    );
                  } catch { return null; }
                })()}
              </View>
            ) : (
              <MessageBubble 
                item={item} 
                isMe={isMe} 
                repliedMsg={item.reply_to_id ? messages.find(m => m.id === item.reply_to_id) : null}
                isHighlighted={item.id === highlightedMessageId}
                onReplyPress={() => item.reply_to_id && scrollToMessage(item.reply_to_id)}
                theme={theme}
                user={user}
                clientName={clientProfile?.profiles?.full_name}
                clientAvatarUrl={clientProfile?.profiles?.avatar_url}
                coachName={profile?.full_name}
                coachAvatarUrl={profile?.avatar_url}
                onLongPress={() => { 
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); 
                    setActiveMessageForMenu(item); 
                }}
              />
            )}
          </View>
      </Swipeable>
    );
  };

  // For MessageOverlay: render the correct component based on message type
  const renderOverlayContent = (msg: any, isMe: boolean) => {
    // Refresh to get latest version from state (reactions)
    const liveMsg = messages.find(m => m.id === msg?.id) || msg;
    if (isMediaMessage(liveMsg.content)) {
      return (
        <ChatMediaMessage
          content={liveMsg.content}
          isOwn={isMe}
          createdAt={liveMsg.created_at}
          isRead={liveMsg.read}
          onCancelSession={handleCancelSession}
          onRescheduleSession={handleRescheduleSession}
          senderAvatarUrl={isMe ? profile?.avatar_url : clientProfile?.profiles?.avatar_url}
          senderName={isMe ? profile?.full_name : clientProfile?.profiles?.full_name}
        />
      );
    }
    return (
      <MessageBubble 
        item={msg} 
        isMe={isMe} 
        theme={theme} 
        user={user}
        clientName={clientProfile?.profiles?.full_name}
        clientAvatarUrl={clientProfile?.profiles?.avatar_url}
        coachName={profile?.full_name}
        coachAvatarUrl={profile?.avatar_url}
        repliedMsg={msg.reply_to_id ? messages.find((m: any) => m.id === msg.reply_to_id) : null}
      />
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#020617' }}>
      <StatusBar barStyle="light-content" />
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]} className="border-b border-white/5 bg-[#020617]/80">
        <View className="flex-row items-center justify-between px-4 pb-4">
          <View className="flex-row items-center gap-3">
             <TouchableOpacity onPress={() => safeBack()} className="w-10 h-10 items-center justify-center rounded-full bg-white/5">
                <ArrowLeft size={20} color="#94A3B8" />
             </TouchableOpacity>
             <View className="flex-row items-center gap-3">
                 <TouchableOpacity 
                    onPress={() => setEnlargedAvatar(clientProfile?.profiles?.avatar_url || 'default')}
                    activeOpacity={0.7}
                 >
                    <BrandedAvatar imageUrl={clientProfile?.profiles?.avatar_url} name={clientProfile?.profiles?.full_name || 'Protocol Hub'} size={40} />
                 </TouchableOpacity>
                 
                 <TouchableOpacity 
                    onPress={() => router.push(`/(coach)/clients/${id}`)}
                    className="justify-center"
                    activeOpacity={0.7}
                 >
                    <View>
                        <Text className="text-white font-bold text-base">{clientProfile?.profiles?.full_name || 'Protocol Hub'}</Text>
                        <View className="flex-row items-center gap-1.5">
                          <View className={`w-2 h-2 rounded-full ${clientUserId && isUserOnline(clientUserId) ? 'bg-emerald-500' : 'bg-slate-600'}`} />
                          <Text className="text-slate-400 text-[10px] font-medium">
                            {clientUserId && isUserOnline(clientUserId) ? 'Online' : 'Offline'}
                          </Text>
                        </View>
                    </View>
                 </TouchableOpacity>
             </View>
          </View>
          <View className="flex-row items-center gap-2">
            <TouchableOpacity 
              onPress={() => setSchedulerVisible(true)} 
              className={`w-10 h-10 items-center justify-center rounded-full ${todaySession ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-white/5'}`}
            >
              <Calendar size={20} color={todaySession ? '#10B981' : '#F8FAFC'} />
              {todaySession && <View className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#0F172A]" />}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setMenuVisible(true)} className="w-10 h-10 items-center justify-center rounded-full bg-white/5"><MoreVertical size={20} color="#94A3B8" /></TouchableOpacity>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {loading ? <View className="flex-1 items-center justify-center"><ActivityIndicator color="#3B82F6" /></View> : (
             <FlatList
                ref={flatListRef} data={messages} extraData={messages} renderItem={renderMessage} keyExtractor={item => item.id}
                inverted showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 24, paddingHorizontal: 16 }}
                initialNumToRender={15} maxToRenderPerBatch={10} windowSize={10} removeClippedSubviews={Platform.OS !== 'web'}
                onScrollToIndexFailed={(info) => { flatListRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.5 }); }}
                onScroll={(e) => {
                  const offsetY = e.nativeEvent.contentOffset.y;
                  if (offsetY > 300 && !showScrollBottom) {
                    setShowScrollBottom(true);
                  } else if (offsetY <= 300 && showScrollBottom) {
                    setShowScrollBottom(false);
                    setNewMessagesCount(0);
                  }
                }}
                scrollEventThrottle={16}
                ListHeaderComponent={isOtherTyping ? <TypingIndicator /> : null}
                delaysContentTouches={false} keyboardShouldPersistTaps="handled"
             />
        )}
        <AnimatePresence>
          {showScrollBottom && (
            <MotiView
              from={{ opacity: 0, scale: 0.8, translateY: 20 }}
              animate={{ opacity: 1, scale: 1, translateY: 0 }}
              exit={{ opacity: 0, scale: 0.8, translateY: 20 }}
              transition={{ type: 'timing', duration: 200 }}
              style={{ position: 'absolute', bottom: 100, right: 16, zIndex: 50 }}
            >
              <TouchableOpacity 
                onPress={scrollToBottom}
                activeOpacity={0.8}
                style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#1E293B', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 5 }}
              >
                <ArrowDown size={20} color="#FFFFFF" />
                {newMessagesCount > 0 && (
                  <View style={{ position: 'absolute', top: -4, right: -4, backgroundColor: '#EF4444', minWidth: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: '#0F172A' }}>
                    <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>{newMessagesCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </MotiView>
          )}
        </AnimatePresence>
        <ChatInputBar 
          onSendText={handleSendText} 
          onSendMedia={handleSendMedia} 
          replyingTo={replyingTo} 
          onCancelReply={() => setReplyingTo(null)} 
          onTyping={handleTyping}
          editingMessage={editingMessage}
          onConfirmEdit={handleConfirmEdit}
          onCancelEdit={() => setEditingMessage(null)}
        />
      </KeyboardAvoidingView>

      <SchedulerModal 
        visible={schedulerVisible} 
        onClose={() => {
          setSchedulerVisible(false);
          setReschedulingMessageId(null);
        }} 
        onConfirm={async (sessions) => {
          console.log('[CoachChat] Scheduler confirmed:', sessions);
          
          // If we were rescheduling, update the local message state
          if (reschedulingMessageId) {
            setMessages(prev => prev.map(m => {
              if (m.id === reschedulingMessageId) {
                try {
                  const p = JSON.parse(m.content);
                  const updatedContent = JSON.stringify({ ...p, status: 'rescheduled' });
                  
                  // Broadcast the reschedule status
                  reactionChannelRef.current?.send({
                    type: 'broadcast',
                    event: 'message_edit',
                    payload: { messageId: m.id, content: updatedContent }
                  });
                  
                  return { ...m, content: updatedContent };
                } catch (e) { return m; }
              }
              return m;
            }));
          }

          setSchedulerVisible(false);
          setReschedulingMessageId(null);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }}
        clientContext={{ 
          name: clientProfile?.profiles?.full_name || 'Athlete', 
          timezone: 'UTC',
          avatar_url: clientProfile?.profiles?.avatar_url
        }}
        existingSessions={[]} 
        targetClientId={clientUserId || ''}
        reschedulingMessageId={reschedulingMessageId}
      />
      
      <Modal visible={menuVisible} transparent animationType="slide">
          <Pressable className="flex-1 bg-black/60 justify-end" onPress={() => setMenuVisible(false)}>
              <MotiView from={{ translateY: 300 }} animate={{ translateY: 0 }} className="bg-slate-900 rounded-t-[48px] p-8 border-t border-white/10">
                  <View className="w-12 h-1.5 bg-slate-800 rounded-full self-center mb-8" />
                  <Text className="text-white text-2xl font-black mb-8 tracking-tight">Channel Actions</Text>
                  <OptionItem icon={<Calendar size={20} color="#3B82F6" />} title="AI Scheduler" sub="Find the next available gap" onPress={() => { setMenuVisible(false); setSchedulerVisible(true); }} />
                  <OptionItem icon={<Activity size={20} color="#34D399" />} title="Client Dossier" sub="View metrics and protocols" onPress={() => { setMenuVisible(false); router.push(`/(coach)/clients/${id}`); }} />
              </MotiView>
          </Pressable>
      </Modal>

      <MessageOverlay 
          visible={!!activeMessageForMenu} 
          message={messages.find(m => m.id === activeMessageForMenu?.id) || activeMessageForMenu} 
          isMe={activeMessageForMenu?.sender_id === user?.id}
          onClose={() => setActiveMessageForMenu(null)} onReaction={handleReaction} onAction={handleAction} 
          renderMessageContent={renderOverlayContent}
      />

      {/* Enlarged Avatar Modal */}
      <Modal 
        visible={!!enlargedAvatar} 
        transparent 
        animationType="fade"
        onRequestClose={() => setEnlargedAvatar(null)}
      >
        <Pressable 
          className="flex-1 bg-black/90 justify-center items-center" 
          onPress={() => setEnlargedAvatar(null)}
        >
          <MotiView
            from={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'timing', duration: 300 }}
          >
            <BrandedAvatar 
              imageUrl={enlargedAvatar === 'default' ? null : enlargedAvatar} 
              name={clientProfile?.profiles?.full_name || 'Athlete'} 
              size={SCREEN_WIDTH * 0.8} 
            />
          </MotiView>
        </Pressable>
      </Modal>

      {/* Cancellation Reason Modal */}
      <Modal 
        visible={!!cancellingSessionId} 
        transparent 
        animationType="fade"
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <Pressable 
            className="flex-1 bg-black/80 justify-center items-center px-6"
            onPress={() => setCancellingSessionId(null)}
          >
            <Pressable onPress={(e) => e.stopPropagation()} style={{ width: '100%' }}>
              <MotiView
                from={{ opacity: 0, scale: 0.9, translateY: 20 }}
                animate={{ opacity: 1, scale: 1, translateY: 0 }}
                style={{ width: '100%', backgroundColor: '#0F172A', borderRadius: 32, padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
              >
                <View className="flex-row justify-between items-center mb-6">
                  <Text className="text-white text-xl font-black">Cancel Session</Text>
                  <TouchableOpacity onPress={() => setCancellingSessionId(null)}>
                    <X size={24} color="#94A3B8" />
                  </TouchableOpacity>
                </View>
                
                <Text className="text-slate-400 mb-6 text-sm font-medium">Why are you cancelling this session?</Text>
                
                <View className="gap-3 mb-6">
                  {[
                    'Personal/Emergency',
                    'Schedule Conflict',
                    'Client No-Show',
                    'Discussed in Chat',
                    'Other'
                  ].map((reason) => {
                    const isSelected = selectedReason === reason;
                    return (
                      <Pressable
                        key={reason}
                        onPressIn={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setSelectedReason(reason);
                        }}
                        style={{
                          padding: 16,
                          borderRadius: 20,
                          borderWidth: 1,
                          borderColor: isSelected ? '#10B981' : 'rgba(255,255,255,0.05)',
                          backgroundColor: isSelected ? 'rgba(16, 185, 129, 0.1)' : '#0F172A'
                        }}
                      >
                        <View className="flex-row items-center justify-between">
                          <Text style={{ 
                            fontSize: 14, 
                            fontWeight: '700', 
                            color: isSelected ? '#10B981' : '#F8FAFC' 
                          }}>{reason}</Text>
                          {isSelected && <Check size={18} color="#10B981" />}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>

                {selectedReason === 'Other' && (
                  <View style={{ height: 140, marginBottom: 24, overflow: 'hidden' }}>
                    <MotiView
                      from={{ opacity: 0, translateY: -10 }}
                      animate={{ opacity: 1, translateY: 0 }}
                      transition={{ type: 'timing', duration: 200 }}
                      style={{ flex: 1 }}
                    >
                      <TextInput
                        className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white text-base flex-1"
                        multiline
                        placeholder="Explain why (optional if obvious)..."
                        placeholderTextColor="#475569"
                        value={cancellationReason}
                        onChangeText={setCancellationReason}
                        autoFocus
                        textAlignVertical="top"
                        style={{ height: '100%' }}
                      />
                    </MotiView>
                  </View>
                )}
                
                <TouchableOpacity 
                  onPress={submitCancellation}
                  disabled={!selectedReason || isSubmittingCancellation}
                  className={`py-4 rounded-2xl items-center mb-2 ${selectedReason ? 'bg-red-500' : 'bg-slate-800'}`}
                >
                  {isSubmittingCancellation ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text className="text-white font-black text-base">Cancel Session</Text>
                  )}
                </TouchableOpacity>
              </MotiView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const OptionItem = ({ icon, title, sub, onPress }: any) => (
    <TouchableOpacity onPress={onPress} className="flex-row items-center gap-5 p-5 bg-slate-950 rounded-[32px] border border-white/5 mb-4">
        <View className="w-12 h-12 bg-slate-900 rounded-2xl items-center justify-center border border-white/5">{icon}</View>
        <View><Text className="text-white font-black text-base">{title}</Text><Text className="text-slate-500 text-[11px] font-medium">{sub}</Text></View>
    </TouchableOpacity>
);

const styles = StyleSheet.create({ header: { backgroundColor: '#020617' } });

const MessageBubble = ({ 
  item, isMe, repliedMsg, isHighlighted, onReplyPress, theme, user, 
  clientName, clientAvatarUrl, coachName, coachAvatarUrl, onLongPress 
}: any) => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [isPressed, setIsPressed] = React.useState(false);
  let displayContent = item.content;
  let reactions: any[] = [];
  let isDeleted = false;
  let deletedBy = '';
  let isEdited = false;

  try {
    const trimmed = item.content.trim();
    if (!trimmed.startsWith('{')) throw new Error('Not JSON');
    
    let p = JSON.parse(trimmed);
    // Handle double stringification
    if (typeof p === 'string' && p.startsWith('{')) {
      p = JSON.parse(p);
    }
    
    // Aggressive type extraction for malformed/nested JSON
    const type = p.type || 
                (trimmed.includes('"type":"audio"') ? 'audio' : null) || 
                (trimmed.includes('"type":"image"') ? 'image' : null) ||
                (trimmed.includes('"type":"video"') ? 'video' : null) ||
                (trimmed.includes('"type":"document"') ? 'document' : null) ||
                (trimmed.includes('"type":"meal"') ? 'meal' : null);
    
    const mediaTypes = ['challenge_completed', 'task_completion', 'image', 'video', 'gif', 'document', 'audio', 'session_invite', 'call_invite'];
    if (type && (mediaTypes.includes(type) || type === 'meal' || type === 'meal_log')) {
      if (type === 'meal' || type === 'meal_log') return <MealMessageCard content={item.content} isOwn={isMe} />;
      return (
        <ChatMediaMessage 
          content={item.content} 
          isOwn={isMe} 
          createdAt={item.created_at} 
          isRead={item.read} 
          senderAvatarUrl={isMe ? coachAvatarUrl : clientAvatarUrl}
          senderName={isMe ? coachName : clientName}
        />
      );
    }
    
    displayContent = p.text || (type && type !== 'text' ? '' : item.content);
    reactions = p.reactions || [];
    isEdited = !!p.is_edited;
    if (p.type === 'deleted') { isDeleted = true; deletedBy = p.deleted_by; }
  } catch {
    // Final defensive check: if string contains media markers, don't show as text
    if (item.content.includes('"type"') && (item.content.includes('"url"') || item.content.includes('"taskName"'))) {
      return (
        <ChatMediaMessage 
          content={item.content} 
          isOwn={isMe} 
          createdAt={item.created_at} 
          isRead={item.read} 
          senderAvatarUrl={isMe ? coachAvatarUrl : clientAvatarUrl}
          senderName={isMe ? coachName : clientName}
        />
      );
    }
  }

  if (isDeleted) {
    const isDeletedByMe = deletedBy === user?.id;
    const deleterName = isDeletedByMe ? 'You' : (clientName || 'User');
    return (
      <View className="px-5 py-3 rounded-[24px] border border-slate-800 bg-slate-900/40 italic">
        <Text className="text-slate-500 text-sm">
          {isDeletedByMe ? 'You deleted this message' : `${deleterName} deleted this message`}
        </Text>
      </View>
    );
  }

  const shouldTruncate = displayContent.length > 300;
  const truncatedContent = shouldTruncate && !isExpanded ? displayContent.slice(0, 300) + '...' : displayContent;

  return (
    <View style={{ position: 'relative' }}>
      <Pressable
          delayLongPress={100}
          unstable_pressDelay={0}
          onPressIn={() => setIsPressed(true)}
          onPressOut={() => setIsPressed(false)}
          onLongPress={onLongPress}
      >
        <MotiView 
            from={{ backgroundColor: isMe ? theme.colors.primary : '#334155', scale: 1 }}
            animate={{ 
                scale: isPressed ? 0.9 : (isHighlighted ? 1.05 : 1),
                backgroundColor: isHighlighted ? '#1E293B' : (isMe ? theme.colors.primary : '#334155') 
            }}
            transition={{ type: 'timing', duration: 100 }}
            className={`px-5 py-3.5 rounded-[28px] ${isMe ? 'rounded-br-none' : 'rounded-bl-none border border-white/5 shadow-2xl'}`}
            style={{ maxWidth: SCREEN_WIDTH * 0.75, minWidth: isMe ? 0 : 120, backgroundColor: isMe ? theme.colors.primary : '#334155' }}
        >
        {repliedMsg && (
           <TouchableOpacity 
              activeOpacity={0.8}
              onPress={onReplyPress}
              className="bg-black/20 px-4 py-3 rounded-2xl mb-2 border-l-4 border-white/30 min-h-[44px]"
           >
              <Text className="text-[9px] font-black text-white/50 uppercase tracking-widest mb-0.5">{repliedMsg.sender_id === user?.id ? 'You' : (clientName || 'Client')}</Text>
              <Text className="text-white/80 text-xs" numberOfLines={1}>
                {(() => {
                  try { 
                    const p = JSON.parse(repliedMsg.content); 
                    if (p.type === 'task_completion') return '✅ Task Completed: ' + (p.taskName || '');
                    if (p.type === 'challenge_completed') return '🏆 Challenge Completed: ' + (p.taskName || '');
                    if (p.type === 'meal' || p.type === 'meal_log') return '🍽️ Meal Log';
                    if (p.type === 'image') return '🖼 Photo';
                    if (p.type === 'video') return '🎥 Video';
                    if (p.type === 'gif') return '🎞 GIF';
                    if (p.type === 'document') return '📄 ' + (p.fileName || 'Document');
                    if (p.type === 'audio') {
                      let dStr = '';
                      if (p.duration && !isNaN(Math.floor(Number(p.duration)))) {
                        const d = Math.floor(Number(p.duration));
                        dStr = ` (${Math.floor(d / 60)}:${(d % 60).toString().padStart(2, '0')})`;
                      }
                      return `🎤 Voice Message${dStr}`;
                    }
                    if (p.type === 'session_invite' || p.type === 'call_invite') return '📹 Session Invitation';
                    return p.text || repliedMsg.content; 
                  } catch { return repliedMsg.content; }
                })()}
              </Text>
           </TouchableOpacity>
        )}
        <Text className="text-[15px] font-medium leading-[22px] text-white">
          {truncatedContent}
        </Text>
        {shouldTruncate && (
          <TouchableOpacity onPress={() => setIsExpanded(!isExpanded)} className="mt-1">
            <Text style={{ color: isMe ? 'white' : theme.colors.primary, fontWeight: 'bold', fontSize: 13 }}>
              {isExpanded ? 'Show Less' : 'Read More'}
            </Text>
          </TouchableOpacity>
        )}
        <View className="flex-row items-center justify-end gap-1.5 mt-2">
           {isEdited && (
             <Text style={{ fontSize: 9, fontWeight: '600', color: 'rgba(255,255,255,0.35)', fontStyle: 'italic' }}>Edited</Text>
           )}
           <Text className="text-[9px] font-bold text-white/40">{new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
           {isMe && <CheckCheck size={11} color={item.read ? '#34D399' : '#94A3B8'} />}
        </View>
      </MotiView>
      </Pressable>

      {reactions.length > 0 && (
        <View className="flex-row flex-wrap mt-[-8px] ml-2">
          {Object.entries(reactions.reduce((acc: any, r: any) => { acc[r.emoji] = (acc[r.emoji] || 0) + 1; return acc; }, {}))
            .map(([emoji, count]: any) => (
              <View key={emoji} className="bg-slate-800 rounded-full px-2 py-0.5 border border-white/5 flex-row items-center mr-1 mb-1">
                <Text className="text-[12px]">{emoji}</Text>
                {count > 1 && <Text className="text-[10px] text-white ml-1 font-bold">{count}</Text>}
              </View>
          ))}
        </View>
      )}
    </View>
  );
};
