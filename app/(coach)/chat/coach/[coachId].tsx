import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, TouchableOpacity, StatusBar, Animated, UIManager, Modal, Pressable, Dimensions
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/BrandContext';
import { useUnread } from '@/contexts/UnreadContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Check, CheckCheck, ArrowDown, Shield, Reply, MoreVertical } from 'lucide-react-native';
import { ChatInputBar } from '@/components/ChatInputBar';
import ChatMediaMessage from '@/components/ChatMediaMessage';
import { BrandedAvatar } from '@/components/BrandedAvatar';
import { MessageOverlay } from '@/components/MessageOverlay';
import { safeBack } from '@/lib/navigation-utils';
import MealMessageCard from '@/components/MealMessageCard';
import { uploadChatMedia } from '@/lib/uploadChatMedia';
import { mediaDownloadManager } from '@/lib/MediaDownloadManager';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotiView, AnimatePresence } from 'moti';
import { TypingIndicator } from '@/components/TypingIndicator';
import { usePresence } from '@/contexts/PresenceContext';
import { Swipeable } from 'react-native-gesture-handler';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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

type CoachInfo = {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
};

export default function CoachToCoachChat() {
  const { coachId, userId: paramUserId, fullName: paramFullName, avatarUrl: paramAvatarUrl } = useLocalSearchParams<{
    coachId: string;
    userId: string;
    fullName: string;
    avatarUrl: string;
  }>();
  const router = useRouter();
  const { user, profile } = useAuth();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { refreshUnreadCount } = useUnread();
  const { isUserOnline } = usePresence();

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [coachInfo, setCoachInfo] = useState<CoachInfo | null>(null);
  const [firstUnreadIndex, setFirstUnreadIndex] = useState(-1);
  const [unreadCountAtOpen, setUnreadCountAtOpen] = useState(0);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [activeMessageForMenu, setActiveMessageForMenu] = useState<Message | null>(null);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [pressedMessageId, setPressedMessageId] = useState<string | null>(null);
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

  const flatListRef = useRef<FlatList>(null);
  const swipeableRefs = useRef<{ [key: string]: Swipeable | null }>({});
  const typingChannelRef = useRef<any>(null);

  useEffect(() => {
    if (user && coachId) {
      loadChatData();
    }
  }, [user?.id, coachId]);

  useFocusEffect(
    useCallback(() => {
      if (user && coachId) {
        setFirstUnreadIndex(-1);
        setUnreadCountAtOpen(0);
        loadChatData().then(data => {
          setTimeout(() => markMessagesAsRead(data), 500);
        });
      }
    }, [user?.id, coachId])
  );

  useEffect(() => {
    if (user && coachId) {
        console.log('[CoachCoachChat] Starting subscription for participant:', coachId);
        // Start listening immediately for any messages in this coach-to-coach thread
        const channelId = `coach-coach-realtime-${coachId}-${user.id}`;
        const channel = supabase.channel(channelId)
          .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'messages',
            filter: `recipient_id=eq.${user.id}` 
          }, (p) => {
            const nm = p.new as Message;
            // ONLY add if it's from the coach we're currently chatting with
            if (nm.sender_id === paramUserId) {
              console.log('[CoachCoachChat] New message received:', nm.id);
              setMessages(prev => {
                if (prev.some(m => m.id === nm.id)) return prev;
                return [nm, ...prev];
              });
              markAsRead(nm.id);
              if (showScrollBottomRef.current) {
                setNewMessagesCount(prev => prev + 1);
              }
            }
          })
          .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'messages',
            filter: `sender_id=eq.${user.id}`
          }, (p) => {
            const nm = p.new as Message;
            // ONLY add if it's sent to the coach we're currently chatting with
            if (nm.recipient_id === paramUserId) {
              console.log('[CoachCoachChat] Own message confirmed:', nm.id);
              setMessages(prev => {
                let newMsgCid: string | undefined;
                try {
                  const parsed = JSON.parse(nm.content);
                  newMsgCid = parsed.cid;
                } catch {}

                if (prev.some(m => m.id === nm.id)) return prev;

                if (newMsgCid) {
                  // Look for the optimistic message by CID
                  const existingIndex = prev.findIndex(m => m.cid === newMsgCid);
                  if (existingIndex !== -1) {
                    const updated = [...prev];
                    updated[existingIndex] = nm;
                    return updated;
                  }
                }
                return [nm, ...prev];
              });
            }
          })
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (p) => {
            const updated = p.new as Message;
            if (updated.sender_id === paramUserId || updated.recipient_id === paramUserId) {
              setMessages(prev => prev.map(m => m.id === updated.id ? updated : m));
            }
          })
          .subscribe((status) => {
            console.log('[CoachCoachChat] Subscription status:', status);
          });

        return () => {
          console.log('[CoachCoachChat] Cleaning up subscription for channel:', channelId);
          supabase.removeChannel(channel);
        };
    }
  }, [user?.id, coachId, paramUserId]);
  
  // Typing broadcast channel
  useEffect(() => {
    if (!user || !paramUserId) return;
    const key = [user.id, paramUserId].sort().join('-');
    const ch = supabase
      .channel(`chat-reactions-${key}`)
      .on('broadcast', { event: 'reaction_update' }, ({ payload }) => {
        setMessages(prev => prev.map(m => m.id === payload.messageId ? { ...m, content: payload.content } : m));
      })
      .on('broadcast', { event: 'message_edit' }, ({ payload }) => {
        setMessages(prev => prev.map(m => m.id === payload.messageId ? { ...m, content: payload.content } : m));
      })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        setIsOtherTyping(payload.isTyping);
      })
      .subscribe();
    typingChannelRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, paramUserId]);

  const loadChatData = async (): Promise<Message[]> => {
    try {
      setLoading(true);
      if (!paramUserId) return [];
      const info: CoachInfo = { user_id: paramUserId, full_name: paramFullName || 'Coach', avatar_url: paramAvatarUrl || null };
      setCoachInfo(info);
      const { data, error } = await supabase.from('messages').select('*')
        .or(`and(sender_id.eq.${user?.id},recipient_id.eq.${info.user_id}),and(sender_id.eq.${info.user_id},recipient_id.eq.${user?.id})`)
        .order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      setMessages(data || []);
      return data || [];
    } catch (error) {
      console.error('[CoachChat] Error:', error);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (mid: string) => {
    await supabase.from('messages').update({ read: true }).eq('id', mid);
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

  const handleSendText = async (text: string, replyId?: string) => {
    if (!user || !coachInfo) return;
    setSending(true);
    const msg = { sender_id: user.id, recipient_id: coachInfo.user_id, content: text, read: false, reply_to_id: replyId, ai_generated: false };
    const { error } = await supabase.from('messages').insert(msg);
    if (error) Alert.alert('Error', 'Failed to send');
    setSending(false);
    setReplyingTo(null);
    scrollToBottom();
  };

  const handleTyping = (isTyping: boolean) => {
    typingChannelRef.current?.send({
      type: 'broadcast',
      event: 'typing',
      payload: { isTyping, userId: user?.id },
    });
  };

  const handleSendMedia = async (jsonContent: string, replyId?: string) => {
    if (!profile || !paramUserId) return;
    
    let parsedContent: any = {};
    try {
      parsedContent = JSON.parse(jsonContent);
    } catch (e) {
      console.error('[CoachCoachChat] Failed to parse media content:', e);
      return;
    }

    // 1. Create Optimistic Message
    const cid = `c-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const tempId = `temp-${Date.now()}`;

    // Embed CID
    const contentWithCid = JSON.stringify({ ...parsedContent, cid });

    const optimisticMsg: Message = {
      id: tempId,
      sender_id: user?.id || '',
      recipient_id: paramUserId,
      content: contentWithCid,
      created_at: new Date().toISOString(),
      read: false,
      reply_to_id: replyId,
      ai_generated: false,
      isUploading: true,
      progress: 0,
      cid
    };

    // Add to state immediately
    setMessages(prev => [optimisticMsg, ...prev]);
    scrollToBottom();

    let finalContent = contentWithCid;
    try {
      // 2. Upload if local (not a remote URL)
      if (parsedContent.isOptimistic && parsedContent.url && !parsedContent.url.startsWith('http')) {
        const folder = parsedContent.type === 'video' ? 'videos' : (parsedContent.type === 'document' ? 'documents' : 'images');
        
        const publicUrl = await uploadChatMedia(
          parsedContent.url, 
          folder, 
          (pct) => {
            // Update progress in state
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

      // 3. Insert into Supabase
      const { data: insertedData, error } = await supabase.from('messages').insert({ 
        sender_id: user?.id, 
        recipient_id: paramUserId, 
        content: finalContent, 
        read: false, 
        reply_to_id: replyId, 
        ai_generated: false 
      }).select().single();

      if (error) throw error;

      // 4. Replace optimistic message with real one
      if (insertedData) {
        setMessages(prev => prev.map(m => m.id === tempId ? insertedData : m));
      }
    } catch (e: any) {
      console.error('[CoachCoachChat] Media upload/send failed:', e);
      Alert.alert('Send Error', 'Failed to send media: ' + (e.message || 'Unknown error'));
      // Remove optimistic message on failure
      setMessages(prev => prev.filter(m => m.id !== tempId));
    } finally {
      setSending(false);
      setReplyingTo(null);
    }
  };

  const handleConfirmEdit = async (newText: string, messageId: string) => {
    const currentMsg = messages.find(m => m.id === messageId);
    let currentContent: any = {};
    try {
      currentContent = JSON.parse(currentMsg?.content || '{}');
    } catch {
      currentContent = {};
    }
    const updatedContent = JSON.stringify({ ...currentContent, text: newText, type: currentContent.type || 'text', is_edited: true });

    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content: updatedContent } : m));
    setEditingMessage(null);

    const { error } = await supabase.from('messages').update({ content: updatedContent }).eq('id', messageId);
    if (error) {
      Alert.alert('Error', 'Failed to edit message: ' + error.message);
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content: currentMsg?.content || m.content } : m));
    } else {
      typingChannelRef.current?.send({
        type: 'broadcast',
        event: 'message_edit',
        payload: { messageId, content: updatedContent },
      });
    }
  };

  const handleAction = async (action: 'reply' | 'copy' | 'delete' | 'forward' | 'edit') => {
    if (!activeMessageForMenu) return;
    
    if (action === 'edit') {
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
      let text = activeMessageForMenu.content;
      try { const p = JSON.parse(text); if (p.text) text = p.text; } catch {}
      await Clipboard.setStringAsync(text);
    } else if (action === 'delete') {
      if (activeMessageForMenu.sender_id !== user?.id) { Alert.alert('Access Denied', 'You can only delete your own messages.'); return; }
      const msgId = activeMessageForMenu.id;
      const deleted = JSON.stringify({ type: 'deleted', deleted_by: user?.id, original_type: 'text' });
      
      // Optimistic update
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: deleted } : m));
      
      const { error } = await supabase.from('messages').update({ content: deleted }).eq('id', msgId);
      if (error) {
          console.error('[CoachCoachChat] Deletion failed:', error);
          Alert.alert('Error', 'Failed to delete: ' + error.message);
      }
    }
    setActiveMessageForMenu(null);
  };

  const handleReaction = async (emoji: string) => {
    if (!activeMessageForMenu || !user) return;
    const msgId = activeMessageForMenu.id;
    const currentMsg = messages.find(m => m.id === msgId) || activeMessageForMenu;
    let currentContent: any = {};
    try { currentContent = JSON.parse(currentMsg.content); } catch { currentContent = { text: currentMsg.content, type: 'text' }; }
    const reactions = currentContent.reactions || [];
    const idx = reactions.findIndex((r: any) => r.user_id === user.id && r.emoji === emoji);
    let nr = [...reactions];
    if (idx > -1) nr.splice(idx, 1); else nr.push({ emoji, user_id: user.id });
    const updated = JSON.stringify({ ...currentContent, reactions: nr });
    
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: updated } : m));
    setActiveMessageForMenu(null);

    typingChannelRef.current?.send({
      type: 'broadcast',
      event: 'reaction_update',
      payload: { messageId: msgId, content: updated },
    });
    
    const { error } = await supabase.from('messages').update({ content: updated }).eq('id', msgId);
    if (error) {
        const { data: savedContent, error: rpcError } = await supabase.rpc('toggle_message_reaction', { p_message_id: msgId, p_emoji: emoji });
        if (rpcError) {
          setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: currentMsg.content } : m));
          Alert.alert('Error', 'Failed to save reaction: ' + rpcError.message);
        } else if (savedContent && savedContent !== updated) {
          setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: savedContent } : m));
          typingChannelRef.current?.send({
            type: 'broadcast',
            event: 'reaction_update',
            payload: { messageId: msgId, content: savedContent },
          });
        }
    }
  };

  const scrollToMessage = useCallback((mid: string) => {
    const idx = messages.findIndex(m => m.id === mid);
    if (idx !== -1) {
      flatListRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5, viewOffset: 80 });
      setHighlightedMessageId(mid);
      setTimeout(() => setHighlightedMessageId(null), 1500);
    }
  }, [messages]);


  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.sender_id === user?.id;
    const renderLeftActions = (progress: any, dragX: any) => {
        const trans = dragX.interpolate({ inputRange: [0, 100], outputRange: [0, 1], extrapolate: 'clamp' });
        return (
            <View style={{ width: 60, justifyContent: 'center', alignItems: 'center' }}>
                <Animated.View style={{ transform: [{ scale: trans }] }}><Reply size={24} color="#3B82F6" /></Animated.View>
            </View>
        );
    };

    const isMedia = isMediaMessage(item.content);

    return (
      <Swipeable
        ref={ref => { if (ref) swipeableRefs.current[item.id] = ref; }}
        renderLeftActions={renderLeftActions}
        onSwipeableWillOpen={() => { setReplyingTo(item); swipeableRefs.current[item.id]?.close(); }}
        friction={1} overshootLeft={false} containerStyle={{ marginBottom: 16 }}
      >
          <View
             style={{ width: '100%', alignItems: isMe ? 'flex-end' : 'flex-start' }}
          >
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
                    senderAvatarUrl={isMe ? profile?.avatar_url : coachInfo?.avatar_url}
                    senderName={isMe ? profile?.full_name : coachInfo?.full_name}
                  />
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
                  otherCoachName={coachInfo?.full_name}
                  otherCoachAvatarUrl={coachInfo?.avatar_url}
                  myName={profile?.full_name}
                  myAvatarUrl={profile?.avatar_url}
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

  return (
    <View style={{ flex: 1, backgroundColor: '#020617' }}>
      <StatusBar barStyle="light-content" translucent />
      <View style={{ paddingTop: insets.top, backgroundColor: '#020617' }} className="border-b border-white/5">
        <View className="flex-row items-center justify-between px-6 py-4">
            <View className="flex-row items-center gap-4">
                <TouchableOpacity onPress={() => safeBack()} className="w-10 h-10 bg-slate-900 rounded-xl items-center justify-center border border-white/5">
                    <ArrowLeft size={18} color="white" />
                </TouchableOpacity>
                <View className="flex-row items-center gap-3">
                    <BrandedAvatar imageUrl={paramAvatarUrl} name={paramFullName || 'Coach'} size={40} />
                    <View>
                        <Text className="text-white font-bold text-base">{paramFullName || 'Coach'}</Text>
                        <View className="flex-row items-center gap-1.5">
                          <View className={`w-2 h-2 rounded-full ${paramUserId && isUserOnline(paramUserId) ? 'bg-emerald-500' : 'bg-slate-600'}`} />
                          <Text className="text-slate-400 text-[10px] font-medium">
                            {paramUserId && isUserOnline(paramUserId) ? 'Online' : 'Offline'}
                          </Text>
                        </View>
                    </View>
                </View>
            </View>
            <TouchableOpacity className="w-10 h-10 bg-slate-900 rounded-xl items-center justify-center border border-white/5"><Shield size={18} color="#64748B" /></TouchableOpacity>
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

      <MessageOverlay 
          visible={!!activeMessageForMenu} message={activeMessageForMenu} isMe={activeMessageForMenu?.sender_id === user?.id}
          onClose={() => setActiveMessageForMenu(null)} onReaction={handleReaction} onAction={handleAction}
          renderMessageContent={(msg: any, isMe: boolean) => (
            <MessageBubble 
              item={msg} 
              isMe={isMe} 
              theme={theme} 
              user={user}
              otherCoachName={coachInfo?.full_name}
              otherCoachAvatarUrl={coachInfo?.avatar_url}
              myName={profile?.full_name}
              myAvatarUrl={profile?.avatar_url}
              repliedMsg={msg.reply_to_id ? messages.find((m: any) => m.id === msg.reply_to_id) : null}
            />
          )}
      />
    </View>
  );
}

const MessageBubble = ({ 
  item, isMe, repliedMsg, isHighlighted, onReplyPress, theme, user, 
  otherCoachName, otherCoachAvatarUrl, myName, myAvatarUrl, onLongPress 
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
          senderAvatarUrl={isMe ? myAvatarUrl : otherCoachAvatarUrl}
          senderName={isMe ? myName : otherCoachName}
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
          senderAvatarUrl={isMe ? myAvatarUrl : otherCoachAvatarUrl}
          senderName={isMe ? myName : otherCoachName}
        />
      );
    }
  }

  if (isDeleted) {
    const isDeletedByMe = deletedBy === user?.id;
    const deleterName = isDeletedByMe ? 'You' : (otherCoachName || 'Coach');
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
              <Text className="text-[9px] font-black text-white/50 uppercase tracking-widest mb-0.5">{repliedMsg.sender_id === user?.id ? 'You' : (otherCoachName || 'Coach')}</Text>
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
