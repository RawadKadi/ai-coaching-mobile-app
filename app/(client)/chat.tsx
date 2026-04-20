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
  Dimensions, 
  Alert, 
  Animated,
  StatusBar
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useUnread } from '@/contexts/UnreadContext';
import { supabase } from '@/lib/supabase';
import { Check, CheckCheck, ArrowLeft, Shield } from 'lucide-react-native';
import MealMessageCard from '@/components/MealMessageCard';
import ChatMediaMessage from '@/components/ChatMediaMessage';
import { ChatInputBar } from '@/components/ChatInputBar';
import { uploadChatMedia } from '@/lib/uploadChatMedia';
import { mediaDownloadManager } from '@/lib/MediaDownloadManager';
import { Swipeable } from 'react-native-gesture-handler';
import { Reply } from 'lucide-react-native';
import { useTheme } from '@/contexts/BrandContext';
import { BrandedAvatar } from '@/components/BrandedAvatar';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { MessageOverlay } from '@/components/MessageOverlay';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Message = {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: string;
  read: boolean;
  reply_to_id?: string;
  isUploading?: boolean;
  progress?: number;
  cid?: string;
};

function isMediaMessage(content: string): boolean {
  try {
    const p = JSON.parse(content);
    return ['image', 'video', 'document', 'gif', 'challenge_completed', 'task_completion'].includes(p.type);
  } catch {
    return false;
  }
}

export default function ClientMessagesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, coach } = useAuth();
  const { refreshUnreadCount } = useUnread();
  const theme = useTheme();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [coachProfile, setCoachProfile] = useState<any>(null);
  const [sending, setSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [activeMessageForMenu, setActiveMessageForMenu] = useState<Message | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const swipeableRefs = useRef<{ [key: string]: Swipeable | null }>({});
  // Keep stable ref to coachId for real-time callbacks
  const coachUserIdRef = useRef<string | null>(null);
  // Broadcast channel for guaranteed real-time reaction delivery
  const reactionChannelRef = useRef<any>(null);

  useEffect(() => {
    coachUserIdRef.current = coach?.user_id || null;
  }, [coach?.user_id]);

  useEffect(() => {
    if (user && coach) {
      loadChatData();
    }
  }, [user?.id, coach?.user_id]);

  // Stable real-time channel — no coachUserId dependency
  useEffect(() => {
    if (!user || !coach) return;

    const channelId = `client-chat-rt-${user.id}`;
    const channel = supabase.channel(channelId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `recipient_id=eq.${user.id}` }, (p) => {
        const nm = p.new as Message;
        const cUid = coachUserIdRef.current;
        if (!cUid || nm.sender_id === cUid) {
          processIncoming(nm);
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `sender_id=eq.${user.id}` }, (p) => {
        const nm = p.new as Message;
        processOutgoingEcho(nm);
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
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, coach?.user_id]);

  // Broadcast channel — shared with coach for guaranteed reaction delivery.
  // Keyed identically to the coach side (sorted join of both user IDs).
  useEffect(() => {
    if (!user || !coach) return;
    const key = [user.id, coach.user_id].sort().join('-');
    const ch = supabase
      .channel(`chat-reactions-${key}`)
      .on('broadcast', { event: 'reaction_update' }, ({ payload }) => {
        setMessages(prev =>
          prev.map(m => m.id === payload.messageId ? { ...m, content: payload.content } : m)
        );
      })
      .subscribe();
    reactionChannelRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, coach?.user_id]);

  const processIncoming = (nm: Message) => {
    setMessages(prev => {
      if (prev.some(m => m.id === nm.id)) return prev;
      return [nm, ...prev];
    });
    markAsRead(nm.id);
  };

  const processOutgoingEcho = (nm: Message) => {
    setMessages(prev => {
      if (prev.some(m => m.id === nm.id)) return prev;

      let echoCid: string | undefined;
      try { echoCid = JSON.parse(nm.content).cid; } catch {}

      if (echoCid) {
        const existingIdx = prev.findIndex(m => m.cid === echoCid || (m.isUploading && m.content.includes(`"cid":"${echoCid}"`)));
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
      const { data: cData } = await supabase.from('profiles').select('*').eq('id', coach?.user_id).single();
      setCoachProfile(cData);
      coachUserIdRef.current = coach?.user_id || null;

      const { data: mData } = await supabase.from('messages')
        .select('*')
        .or(`and(sender_id.eq.${user?.id},recipient_id.eq.${coach?.user_id}),and(sender_id.eq.${coach?.user_id},recipient_id.eq.${user?.id})`)
        .order('created_at', { ascending: false })
        .limit(100);
      
      setMessages(mData || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const markAsRead = async (mid: string) => {
    await supabase.from('messages').update({ read: true }).eq('id', mid);
    refreshUnreadCount();
  };

  const sendMessage = async (text: string, replyId?: string) => {
    if (!user || !coach || !text.trim()) return;
    setSending(true);
    const msg = { sender_id: user.id, recipient_id: coach.user_id, content: text, read: false, reply_to_id: replyId };
    const { error } = await supabase.from('messages').insert(msg);
    if (error) Alert.alert('Error', 'Failed to send message');
    setSending(false);
    setReplyingTo(null);
  };

  const handleSendMedia = async (jsonContent: string, replyId?: string) => {
    if (!user || !coach) return;

    let parsedContent: any = {};
    try { parsedContent = JSON.parse(jsonContent); } catch { return; }

    const cid = `c-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const tempId = `temp-${Date.now()}`;
    const contentWithCid = JSON.stringify({ ...parsedContent, cid });

    const optimisticMsg: Message = {
      id: tempId,
      sender_id: user.id,
      recipient_id: coach.user_id,
      content: contentWithCid,
      created_at: new Date().toISOString(),
      read: false,
      reply_to_id: replyId,
      isUploading: true,
      progress: 0,
      cid,
    };

    setMessages(prev => [optimisticMsg, ...prev]);

    let finalContent = contentWithCid;
    try {
      if (parsedContent.isOptimistic && parsedContent.url && !parsedContent.url.startsWith('http')) {
        const folder = parsedContent.type === 'video' ? 'videos' : (parsedContent.type === 'document' ? 'documents' : 'images');
        const publicUrl = await uploadChatMedia(
          parsedContent.url,
          folder,
          (pct) => { setMessages(prev => prev.map(m => m.id === tempId ? { ...m, progress: pct } : m)); }
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
        sender_id: user.id,
        recipient_id: coach.user_id,
        content: finalContent,
        read: false,
        reply_to_id: replyId,
      }).select().single();

      if (error) throw error;
      if (insertedData) setMessages(prev => prev.map(m => m.id === tempId ? insertedData : m));
    } catch (e: any) {
      Alert.alert('Send Error', 'Failed to send media: ' + (e.message || 'Unknown error'));
      setMessages(prev => prev.filter(m => m.id !== tempId));
    } finally {
      setSending(false);
      setReplyingTo(null);
    }
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

    // Persist to DB: try direct update first (works when coach is recipient or client is recipient)
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
        // Both failed — revert optimistic update
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: currentMsg.content } : m));
        Alert.alert('Error', 'Failed to save reaction: ' + rpcError.message);
      } else if (savedContent && savedContent !== optimisticContent) {
        // RPC returned canonical content (e.g. toggle removed reaction) — sync
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: savedContent } : m));
        reactionChannelRef.current?.send({
          type: 'broadcast',
          event: 'reaction_update',
          payload: { messageId: msgId, content: savedContent },
        });
      }
    }
  };

  const handleAction = async (action: 'reply' | 'copy' | 'delete' | 'forward') => {
    if (!activeMessageForMenu) return;

    if (action === 'reply') {
      setReplyingTo(activeMessageForMenu);
    } else if (action === 'copy') {
      let textToCopy = activeMessageForMenu.content;
      try { const p = JSON.parse(activeMessageForMenu.content); if (p.text) textToCopy = p.text; } catch {}
      await Clipboard.setStringAsync(textToCopy);
    } else if (action === 'delete') {
      if (activeMessageForMenu.sender_id !== user?.id) {
        Alert.alert('Access Denied', 'You can only delete your own messages.');
        return;
      }
      const msgId = activeMessageForMenu.id;
      const deletedContent = JSON.stringify({ type: 'deleted', deleted_by: user?.id });
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: deletedContent } : m));
      await supabase.from('messages').update({ content: deletedContent }).eq('id', msgId);
    }
    setActiveMessageForMenu(null);
  };

  const scrollToMessage = useCallback((messageId: string) => {
     const idx = messages.findIndex(m => m.id === messageId);
     if (idx !== -1) {
         flatListRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 });
         setHighlightedMessageId(messageId);
         setTimeout(() => setHighlightedMessageId(null), 2000);
     }
  }, [messages]);

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.sender_id === user?.id;
    const isHighlighted = item.id === highlightedMessageId;
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
        friction={1} overshootLeft={false} containerStyle={{ marginBottom: 12 }}
      >
        {/* TouchableOpacity for long-press. CustomImagePlayer now uses RNGH's
            TouchableOpacity internally, so both are in the same gesture tree
            as Swipeable and properly coordinate. */}
        <TouchableOpacity
          activeOpacity={0.9}
          delayLongPress={400}
          onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); setActiveMessageForMenu(item); }}
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
                replyTo={item.reply_to_id ? messages.find(m => m.id === item.reply_to_id) : undefined}
                onPressReply={() => item.reply_to_id && scrollToMessage(item.reply_to_id)}
                isHighlighted={isHighlighted}
                onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); setActiveMessageForMenu(item); }}
              />
              {/* Reactions on media */}
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
            <ClientMessageBubble
              item={item}
              isMe={isMe}
              isHighlighted={isHighlighted}
              repliedMsg={item.reply_to_id ? messages.find(m => m.id === item.reply_to_id) : null}
              onReplyPress={() => item.reply_to_id && scrollToMessage(item.reply_to_id)}
              theme={theme}
              user={user}
              coachName={coachProfile?.full_name}
            />
          )}
        </TouchableOpacity>
      </Swipeable>
    );
  };

  const renderOverlayContent = (msg: any, isMe: boolean) => {
    // Refresh to get the latest version from messages state (reactions)
    const liveMsg = messages.find(m => m.id === msg?.id) || msg;
    if (isMediaMessage(liveMsg.content)) {
      return <ChatMediaMessage content={liveMsg.content} isOwn={isMe} createdAt={liveMsg.created_at} isRead={liveMsg.read} />;
    }
    return (
      <ClientMessageBubble
        item={msg}
        isMe={isMe}
        theme={theme}
        user={user}
        coachName={coachProfile?.full_name}
        repliedMsg={msg.reply_to_id ? messages.find((m: any) => m.id === msg.reply_to_id) : null}
      />
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#020617' }}>
      <StatusBar barStyle="light-content" translucent />
      
      <View style={{ paddingTop: insets.top, backgroundColor: '#020617' }} className="border-b border-white/5">
        <View className="flex-row items-center justify-between px-6 py-4">
            <View className="flex-row items-center gap-4">
                <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 bg-slate-900 rounded-xl items-center justify-center border border-white/5">
                    <ArrowLeft size={18} color="white" />
                </TouchableOpacity>
                <View className="flex-row items-center gap-3">
                    <BrandedAvatar name={coachProfile?.full_name} size={42} imageUrl={coachProfile?.avatar_url} />
                    <View>
                        <Text className="text-white font-black text-lg tracking-tight">{coachProfile?.full_name || 'Your Coach'}</Text>
                        <View className="flex-row items-center gap-1.5">
                            <View className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                            <Text className="text-slate-500 text-[9px] font-black uppercase tracking-[2px]">Encrypted Message</Text>
                        </View>
                    </View>
                </View>
            </View>
            <TouchableOpacity className="w-10 h-10 bg-slate-900 rounded-xl items-center justify-center border border-white/5">
                <Shield size={18} color="#64748B" />
            </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={{ flex: 1, paddingHorizontal: 16 }}>
          {loading ? (
            <View className="flex-1 items-center justify-center"><ActivityIndicator color="#3B82F6" /></View>
          ) : (
            <FlatList
                ref={flatListRef}
                data={messages}
                extraData={messages}
                renderItem={renderMessage}
                keyExtractor={item => item.id}
                inverted
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingVertical: 24 }}
                initialNumToRender={15}
                maxToRenderPerBatch={10}
                windowSize={10}
                removeClippedSubviews={Platform.OS !== 'web'}
                onScrollToIndexFailed={(info) => {
                    flatListRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.5 });
                }}
            />
          )}
        </View>

        <View style={{ paddingBottom: insets.bottom > 0 ? insets.bottom : 12 }} className="bg-slate-950 border-t border-white/5">
            <ChatInputBar 
              onSendText={sendMessage}
              onSendMedia={handleSendMedia}
              sending={sending} 
              replyingTo={replyingTo} 
              onCancelReply={() => setReplyingTo(null)} 
            />
        </View>
      </KeyboardAvoidingView>

      <MessageOverlay
        visible={!!activeMessageForMenu}
        message={messages.find(m => m.id === activeMessageForMenu?.id) || activeMessageForMenu}
        isMe={activeMessageForMenu?.sender_id === user?.id}
        onClose={() => setActiveMessageForMenu(null)}
        onReaction={handleReaction}
        onAction={handleAction}
        renderMessageContent={renderOverlayContent}
      />
    </View>
  );
}

// ── Client Message Bubble ─────────────────────────────────────────────────────
const ClientMessageBubble = ({ item, isMe, isHighlighted, repliedMsg, onReplyPress, theme, user, coachName }: any) => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  let displayContent = item.content;
  let reactions: any[] = [];
  let isDeleted = false;
  let deletedBy = '';

  try {
    const p = JSON.parse(item.content);
    displayContent = p.text || item.content;
    reactions = p.reactions || [];
    if (p.type === 'deleted') { isDeleted = true; deletedBy = p.deleted_by; }
    // Delegate media types to ChatMediaMessage to avoid showing raw JSON
    if (p.type === 'meal' || p.type === 'meal_log') return <MealMessageCard content={item.content} isOwn={isMe} />;
    if (p.type === 'challenge_completed' || p.type === 'task_completion' ||
        p.type === 'image' || p.type === 'video' || p.type === 'gif' || p.type === 'document') {
      return <ChatMediaMessage content={item.content} isOwn={isMe} createdAt={item.created_at} isRead={item.read} />;
    }
  } catch {}

  if (isDeleted) {
    return (
      <View style={{ paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24, borderWidth: 1, borderColor: '#1E293B', backgroundColor: 'rgba(15,23,42,0.4)' }}>
        <Text style={{ color: '#64748B', fontSize: 14, fontStyle: 'italic' }}>
          {deletedBy === user?.id ? 'You deleted this message' : `${coachName || 'Coach'} deleted this message`}
        </Text>
      </View>
    );
  }

  const shouldTruncate = displayContent.length > 300;
  const truncatedContent = shouldTruncate && !isExpanded ? displayContent.slice(0, 300) + '...' : displayContent;

  return (
    <View style={{ position: 'relative' }}>
      <MotiView
        from={{ backgroundColor: isMe ? '#2563EB' : '#0F172A', scale: 1 }}
        animate={{
          scale: isHighlighted ? 1.05 : 1,
          backgroundColor: isHighlighted ? '#3B82F6' : (isMe ? '#2563EB' : '#0F172A'),
        }}
        transition={{ type: 'spring', damping: 15 }}
        style={[
          {
            paddingHorizontal: 20, paddingVertical: 14,
            borderRadius: 28, maxWidth: SCREEN_WIDTH * 0.75,
            backgroundColor: isMe ? '#2563EB' : '#0F172A',
          },
          !isMe && { borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
          isMe ? { borderBottomRightRadius: 4 } : { borderBottomLeftRadius: 4 },
        ]}
      >
        {repliedMsg && (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onReplyPress}
            style={{ backgroundColor: 'rgba(0,0,0,0.2)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, marginBottom: 8, borderLeftWidth: 2, borderLeftColor: 'rgba(255,255,255,0.3)' }}
          >
            <Text style={{ fontSize: 9, fontWeight: '900', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 2 }}>
              {repliedMsg.sender_id === user?.id ? 'You' : 'Coach'}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }} numberOfLines={1}>
              {(() => { try { const p = JSON.parse(repliedMsg.content); return p.text || repliedMsg.content; } catch { return repliedMsg.content; } })()}
            </Text>
          </TouchableOpacity>
        )}
        <Text style={{ fontSize: 15, fontWeight: '500', lineHeight: 22, color: isMe ? '#FFFFFF' : '#F1F5F9' }}>
          {truncatedContent}
        </Text>
        {shouldTruncate && (
          <TouchableOpacity onPress={() => setIsExpanded(!isExpanded)} style={{ marginTop: 4 }}>
            <Text style={{ color: isMe ? 'white' : (theme?.colors?.primary || '#3B82F6'), fontWeight: 'bold', fontSize: 13 }}>
              {isExpanded ? 'Show Less' : 'Read More'}
            </Text>
          </TouchableOpacity>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginTop: 8 }}>
          <Text style={{ fontSize: 9, fontWeight: 'bold', color: 'rgba(255,255,255,0.4)' }}>
            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
          {isMe && <CheckCheck size={11} color={item.read ? '#34D399' : '#94A3B8'} />}
        </View>
      </MotiView>

      {reactions.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: -8, marginLeft: 8 }}>
          {Object.entries(reactions.reduce((acc: any, r: any) => { acc[r.emoji] = (acc[r.emoji] || 0) + 1; return acc; }, {}))
            .map(([emoji, count]: any) => (
              <View key={emoji} style={{ backgroundColor: '#1E293B', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', flexDirection: 'row', alignItems: 'center', marginRight: 4, marginBottom: 4 }}>
                <Text style={{ fontSize: 12 }}>{emoji}</Text>
                {count > 1 && <Text style={{ fontSize: 10, color: 'white', marginLeft: 4, fontWeight: 'bold' }}>{count}</Text>}
              </View>
            ))}
        </View>
      )}
    </View>
  );
};
