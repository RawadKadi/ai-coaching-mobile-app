import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  FlatList, 
  KeyboardAvoidingView, 
  Platform, 
  ActivityIndicator, 
  UIManager, 
  Modal, 
  Pressable, 
  Dimensions, 
  Linking, 
  Alert, 
  Animated,
  StatusBar
} from 'react-native';
import { Image } from 'expo-image';
import { useAuth } from '@/contexts/AuthContext';
import { useUnread } from '@/contexts/UnreadContext';
import { supabase } from '@/lib/supabase';
import { 
  Send, 
  ArrowLeft, 
  Shield, 
  Check, 
  CheckCheck, 
  Reply,
  Video,
  Dumbbell,
  Calendar
} from 'lucide-react-native';
import MealMessageCard from '@/components/MealMessageCard';
import ChatMediaMessage from '@/components/ChatMediaMessage';
import { ChatInputBar } from '@/components/ChatInputBar';
import { MessageOverlay } from '@/components/MessageOverlay';
import { uploadChatMedia } from '@/lib/uploadChatMedia';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Swipeable } from 'react-native-gesture-handler';
import { useTheme } from '@/contexts/BrandContext';
import { BrandedAvatar } from '@/components/BrandedAvatar';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotiView, AnimatePresence } from 'moti';

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

export default function ClientMessagesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const { refreshUnreadCount } = useUnread();
  const theme = useTheme();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [coachProfile, setCoachProfile] = useState<any>(null);
  const [coachUserId, setCoachUserId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [activeMessageForMenu, setActiveMessageForMenu] = useState<Message | null>(null);
  
  const flatListRef = useRef<FlatList>(null);
  const swipeableRefs = useRef<{ [key: string]: Swipeable | null }>({});

  useEffect(() => {
    if (user) {
      loadChatData();
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;

    const channelId = `client-chat-realtime-${user.id}`;
    console.log('[ClientChat] Initializing channel:', channelId);

    const channel = supabase.channel(channelId)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages',
        filter: `recipient_id=eq.${user.id}` 
      }, (p) => {
        const nm = p.new as Message;
        // Verify this belongs to the active coach
        if (coachUserId && nm.sender_id === coachUserId) {
          processIncoming(nm);
        }
      })
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages',
        filter: `sender_id=eq.${user.id}`
      }, (p) => {
        const nm = p.new as Message;
        if (coachUserId && nm.recipient_id === coachUserId) {
          processOutgoingEcho(nm);
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (p) => {
        const updated = p.new as Message;
        if (coachUserId && (updated.sender_id === coachUserId || updated.recipient_id === coachUserId)) {
          setMessages(prev => prev.map(m => m.id === updated.id ? updated : m));
        }
      })
      .subscribe();

    return () => {
      console.log('[ClientChat] Removing channel:', channelId);
      supabase.removeChannel(channel);
    };
  }, [user?.id, coachUserId]);

  const processIncoming = (nm: Message) => {
    console.log('[ClientChat] Processing incoming:', nm.id);
    setMessages(prev => {
      if (prev.some(m => m.id === nm.id)) return prev;
      return [nm, ...prev];
    });
    markAsRead(nm.id);
  };

  const processOutgoingEcho = (nm: Message) => {
    console.log('[ClientChat] Processing outgoing echo:', nm.id);
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
      const { data: linkWithCoach, error: linkError } = await supabase
        .from('coach_client_links')
        .select(`
          coach_id,
          coaches:coach_id (
            user_id,
            profiles:user_id (id, full_name, avatar_url)
          )
        `)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (linkError) throw linkError;
      if (!linkWithCoach?.coaches) {
          setLoading(false);
          return;
      }

      const coachData = linkWithCoach.coaches as any;
      const resolvedCoachUserId = coachData.user_id;
      setCoachUserId(resolvedCoachUserId);
      setCoachProfile(coachData.profiles);

      const { data: mData, error: msgError } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${user?.id},recipient_id.eq.${resolvedCoachUserId}),and(sender_id.eq.${resolvedCoachUserId},recipient_id.eq.${user?.id})`)
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (msgError) throw msgError;
      setMessages(mData || []);
    } catch (e) { 
        console.error('[ClientChat] Error:', e);
    } finally { 
        setLoading(false); 
    }
  };

  const markAsRead = async (mid: string) => {
    await supabase.from('messages').update({ read: true }).eq('id', mid);
    refreshUnreadCount();
  };

  const handleSendText = async (text: string, replyId?: string) => {
    if (!user || !coachUserId || !text.trim()) return;
    setSending(true);
    const msg = { sender_id: user.id, recipient_id: coachUserId, content: text, read: false, reply_to_id: replyId, ai_generated: false };
    const { error } = await supabase.from('messages').insert(msg);
    if (error) Alert.alert('Error', 'Failed to send');
    setSending(false);
    setReplyingTo(null);
  };

  const handleSendMedia = async (jsonContent: string, replyId?: string) => {
    if (!profile || !coachUserId) return;
    
    let parsedContent: any = {};
    try {
      parsedContent = JSON.parse(jsonContent);
    } catch (e) {
      console.error('[ClientChat] Failed to parse media content:', e);
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
      recipient_id: coachUserId,
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
        finalContent = JSON.stringify({ ...parsedContent, url: publicUrl, isOptimistic: false, cid });
      }

      // 3. Insert into Supabase
      const { data: insertedData, error } = await supabase.from('messages').insert({ 
        sender_id: user?.id, 
        recipient_id: coachUserId, 
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
      console.error('[ClientChat] Media upload/send failed:', e);
      Alert.alert('Send Error', 'Failed to send media: ' + (e.message || 'Unknown error'));
      // Remove optimistic message on failure
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

      // Optimistic update
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: deletedContent } : m));
      
      const { error } = await supabase.from('messages').update({ content: deletedContent }).eq('id', msgId);
      if (error) {
        console.error('[ClientChat] Deletion failed:', error);
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
      console.error('[ClientChat] Reaction failed:', error);
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
    const renderLeftActions = (progress: any, dragX: any) => {
        const trans = dragX.interpolate({ inputRange: [0, 100], outputRange: [0, 1], extrapolate: 'clamp' });
        return (
            <View style={{ width: 60, justifyContent: 'center', alignItems: 'center' }}>
                <Animated.View style={{ transform: [{ scale: trans }] }}><Reply size={24} color="#3B82F6" /></Animated.View>
            </View>
        );
    };

    let isMedia = false;
    try {
      const p = JSON.parse(item.content);
      if (['image', 'video', 'document', 'gif', 'challenge_completed', 'task_completion'].includes(p.type)) isMedia = true;
    } catch {}

    return (
      <Swipeable
        ref={ref => { if (ref) swipeableRefs.current[item.id] = ref; }}
        renderLeftActions={renderLeftActions}
        onSwipeableWillOpen={() => { setReplyingTo(item); swipeableRefs.current[item.id]?.close(); }}
        friction={1} overshootLeft={false} containerStyle={{ marginBottom: 16 }}
      >
        <TouchableOpacity 
            activeOpacity={0.9} 
            delayLongPress={800}
            onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); setActiveMessageForMenu(item); }}
            style={{ width: '100%', alignItems: isMe ? 'flex-end' : 'flex-start' }}
        >
          {isMedia ? (
            <ChatMediaMessage 
              content={item.content} 
              isOwn={isMe} 
              createdAt={item.created_at} 
              isRead={item.read} 
              isUploading={item.isUploading}
              progress={item.progress}
            />
          ) : (
            <MessageBubble 
              item={item} 
              isMe={isMe} 
              repliedMsg={item.reply_to_id ? messages.find(m => m.id === item.reply_to_id) : null}
              isHighlighted={item.id === highlightedMessageId}
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
                        <Text className="text-white font-black text-lg tracking-tight">{coachProfile?.full_name || 'Coach Hub'}</Text>
                        <View className="flex-row items-center gap-1.5">
                            <View className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                            <Text className="text-slate-500 text-[9px] font-black uppercase tracking-[2px]">Encrypted Stream</Text>
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

      <MessageOverlay 
          visible={!!activeMessageForMenu} message={activeMessageForMenu} isMe={activeMessageForMenu?.sender_id === user?.id}
          onClose={() => setActiveMessageForMenu(null)} onReaction={handleReaction} onAction={handleAction}
          renderMessageContent={(msg: any, isMe: boolean) => (
            <MessageBubble 
              item={msg} 
              isMe={isMe} 
              theme={theme} 
              repliedMsg={msg.reply_to_id ? messages.find(m => m.id === msg.reply_to_id) : null}
            />
          )}
      />
    </View>
  );
}
const MessageBubble = ({ item, isMe, repliedMsg, isHighlighted, onReplyPress, theme, user, coachName }: any) => {
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
    const deleterName = isDeletedByMe ? 'You' : (coachName || 'Coach');
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
              <Text className="text-[9px] font-black text-white/50 uppercase tracking-widest mb-0.5">{repliedMsg.sender_id === user?.id ? 'You' : 'Coach'}</Text>
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
