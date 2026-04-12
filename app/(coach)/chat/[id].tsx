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
  StatusBar
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/BrandContext';
import { useUnread } from '@/contexts/UnreadContext';
import { supabase } from '@/lib/supabase';
import { 
  ArrowLeft, 
  Check, 
  CheckCheck, 
  Calendar, 
  Activity,
  Reply,
  MoreVertical,
} from 'lucide-react-native';
import { BrandedAvatar } from '@/components/BrandedAvatar';
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');
import { MotiView } from 'moti';
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
  if (!content) return false;
  try {
    const p = JSON.parse(content);
    return ['image', 'video', 'document', 'gif', 'challenge_completed', 'task_completion', 'meal', 'meal_log'].includes(p.type);
  } catch {
    return false;
  }
}

export default function CoachChatScreen() {
  const { id } = useLocalSearchParams(); 
  const router = useRouter();
  const { user, profile } = useAuth();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { refreshUnreadCount } = useUnread();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientProfile, setClientProfile] = useState<any>(null);
  const [clientUserId, setClientUserId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [schedulerVisible, setSchedulerVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [activeMessageForMenu, setActiveMessageForMenu] = useState<Message | null>(null);
  
  const flatListRef = useRef<FlatList>(null);
  const swipeableRefs = useRef<{ [key: string]: Swipeable | null }>({});
  // Buffer for messages that arrive before clientUserId is resolved
  const pendingBuffer = useRef<Message[]>([]);
  // Keep a stable ref to clientUserId so real-time callbacks always see latest value
  const clientUserIdRef = useRef<string | null>(null);

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
        const cUid = clientUserIdRef.current;
        if (cUid && (updated.sender_id === cUid || updated.recipient_id === cUid)) {
          setMessages(prev => prev.map(m => m.id === updated.id ? updated : m));
        }
      })
      .subscribe((status) => {
        console.log('[CoachChat] Channel status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, id]); // ← Stable: no clientUserId dependency

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

  const handleSendText = async (text: string, replyId?: string) => {
    if (!profile || !clientUserId) return;
    setSending(true);
    const msg = { sender_id: user?.id, recipient_id: clientUserId, content: text, read: false, reply_to_id: replyId, ai_generated: false };
    const { error } = await supabase.from('messages').insert(msg);
    if (error) Alert.alert('Error', 'Failed to send');
    setSending(false);
    setReplyingTo(null);
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

    let finalContent = contentWithCid;
    try {
      if (parsedContent.isOptimistic && parsedContent.url && !parsedContent.url.startsWith('http')) {
        const folder = parsedContent.type === 'video' ? 'videos' : (parsedContent.type === 'document' ? 'documents' : 'images');
        
        const publicUrl = await uploadChatMedia(
          parsedContent.url, 
          folder, 
          (pct) => {
            setMessages(prev => prev.map(m => m.id === tempId ? { ...m, progress: pct } : m));
          }
        );
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

  const handleAction = async (action: 'reply' | 'copy' | 'delete' | 'forward') => {
    if (!activeMessageForMenu) return;
    
    if (action === 'reply') {
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
    }
    setActiveMessageForMenu(null);
  };

  const handleReaction = async (emoji: string) => {
    if (!activeMessageForMenu || !user) return;
    
    const msgId = activeMessageForMenu.id;
    let currentContent: any = {};
    try {
      currentContent = JSON.parse(activeMessageForMenu.content);
    } catch {
      currentContent = { text: activeMessageForMenu.content, type: 'text' };
    }
    
    const reactions = currentContent.reactions || [];
    const existingIndex = reactions.findIndex((r: any) => r.user_id === user.id && r.emoji === emoji);
    
    let newReactions = [...reactions];
    if (existingIndex > -1) {
      newReactions.splice(existingIndex, 1);
    } else {
      newReactions.push({ emoji, user_id: user.id });
    }
    
    const updatedContent = JSON.stringify({ ...currentContent, reactions: newReactions });
    
    // Optimistic update
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: updatedContent } : m));
    
    const { error } = await supabase
      .from('messages')
      .update({ content: updatedContent })
      .eq('id', msgId);
      
    if (error) {
      Alert.alert('Error', 'Failed to react: ' + error.message);
    }
    setActiveMessageForMenu(null);
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
                isHighlighted={item.id === highlightedMessageId}
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
            />
          )}
        </TouchableOpacity>
      </Swipeable>
    );
  };

  // For MessageOverlay: render the correct component based on message type
  const renderOverlayContent = (msg: any, isMe: boolean) => {
    if (isMediaMessage(msg.content)) {
      return (
        <ChatMediaMessage
          content={msg.content}
          isOwn={isMe}
          createdAt={msg.created_at}
          isRead={msg.read}
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
             <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center rounded-full bg-white/5">
                <ArrowLeft size={20} color="#94A3B8" />
             </TouchableOpacity>
             <TouchableOpacity className="flex-row items-center gap-3">
                 <BrandedAvatar imageUrl={clientProfile?.profiles?.avatar_url} name={clientProfile?.profiles?.full_name || 'Protocol Hub'} size={40} />
                <View>
                    <Text className="text-white font-bold text-base">{clientProfile?.profiles?.full_name || 'Protocol Hub'}</Text>
                    <View className="flex-row items-center gap-1.5"><View className="w-2 h-2 rounded-full bg-emerald-500" /><Text className="text-slate-400 text-[10px] font-medium">Online</Text></View>
                </View>
             </TouchableOpacity>
          </View>
          <View className="flex-row items-center gap-2">
            <TouchableOpacity onPress={() => setSchedulerVisible(true)} className="w-10 h-10 items-center justify-center rounded-full bg-white/5"><Calendar size={20} color="#F8FAFC" /></TouchableOpacity>
            <TouchableOpacity onPress={() => setMenuVisible(true)} className="w-10 h-10 items-center justify-center rounded-full bg-white/5"><MoreVertical size={20} color="#94A3B8" /></TouchableOpacity>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {loading ? <View className="flex-1 items-center justify-center"><ActivityIndicator color="#3B82F6" /></View> : (
             <FlatList
                ref={flatListRef} data={messages} renderItem={renderMessage} keyExtractor={item => item.id}
                inverted showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 24, paddingHorizontal: 16 }}
                initialNumToRender={15} maxToRenderPerBatch={10} windowSize={10} removeClippedSubviews={Platform.OS !== 'web'}
                onScrollToIndexFailed={(info) => { flatListRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.5 }); }}
             />
        )}
        <ChatInputBar onSendText={handleSendText} onSendMedia={handleSendMedia} replyingTo={replyingTo} onCancelReply={() => setReplyingTo(null)} />
      </KeyboardAvoidingView>

      <SchedulerModal 
        visible={schedulerVisible} 
        onClose={() => setSchedulerVisible(false)} 
        targetClientId={id as string}
        clientContext={{ 
          name: clientProfile?.profiles?.full_name || 'Athlete', 
          timezone: 'UTC' 
        }}
        existingSessions={[]} 
        onConfirm={async (sessions) => {
          console.log('Confirmed sessions:', sessions);
        }}
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
          visible={!!activeMessageForMenu} message={activeMessageForMenu} isMe={activeMessageForMenu?.sender_id === user?.id}
          onClose={() => setActiveMessageForMenu(null)} onReaction={handleReaction} onAction={handleAction} 
          renderMessageContent={renderOverlayContent}
      />
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

const MessageBubble = ({ item, isMe, repliedMsg, isHighlighted, onReplyPress, theme, user, clientName }: any) => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  let displayContent = item.content;
  let reactions: any[] = [];
  let isDeleted = false;
  let deletedBy = '';

  try {
    const p = JSON.parse(item.content);
    displayContent = p.text || item.content;
    reactions = p.reactions || [];
    if (p.type === 'deleted') {
      isDeleted = true;
      deletedBy = p.deleted_by;
    }
    if (p.type === 'meal' || p.type === 'meal_log') return <MealMessageCard content={item.content} isOwn={isMe} />;
  } catch {}

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
      <MotiView 
          from={{ backgroundColor: isMe ? theme.colors.primary : '#334155', scale: 1 }}
          animate={{ 
              scale: isHighlighted ? 1.05 : 1,
              backgroundColor: isHighlighted ? '#1E293B' : (isMe ? theme.colors.primary : '#334155') 
          }}
          transition={{ type: 'timing', duration: 250 }}
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
                  try { const p = JSON.parse(repliedMsg.content); return p.text || repliedMsg.content; } 
                  catch { return repliedMsg.content; }
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
           <Text className="text-[9px] font-bold text-white/40">{new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
           {isMe && <CheckCheck size={11} color={item.read ? '#34D399' : '#94A3B8'} />}
        </View>
      </MotiView>

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
