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
import MealMessageCard from '@/components/MealMessageCard';
import { uploadChatMedia } from '@/lib/uploadChatMedia';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
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
};

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
  const { user } = useAuth();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { refreshUnreadCount } = useUnread();

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

  const flatListRef = useRef<FlatList>(null);
  const swipeableRefs = useRef<{ [key: string]: Swipeable | null }>({});

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
    if (!user?.id || !coachInfo?.user_id) return;
    const channel = supabase.channel(`coach-chat-${coachId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
          const msg = payload.new as Message;
          if ((msg.sender_id === coachInfo.user_id && msg.recipient_id === user.id) || (msg.sender_id === user.id && msg.recipient_id === coachInfo.user_id)) {
            setMessages(current => [msg, ...current]);
            if (msg.sender_id === coachInfo.user_id) markAsRead(msg.id);
          }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
          setMessages(current => current.map(m => m.id === payload.new.id ? (payload.new as Message) : m));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, coachInfo?.user_id]);

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
  };

  const handleSendMedia = async (jsonContent: string, replyId?: string) => {
    if (!user || !coachId) return;
    
    let finalContent = jsonContent;
    try {
      const p = JSON.parse(jsonContent);
      if (p.isOptimistic && p.url && p.url.startsWith('file://')) {
        setSending(true);
        const folder = p.type === 'video' ? 'videos' : (p.type === 'document' ? 'documents' : 'images');
        const publicUrl = await uploadChatMedia(p.url, folder);
        finalContent = JSON.stringify({ ...p, url: publicUrl, isOptimistic: false });
      }
    } catch (e) {
      console.error('[CoachCoachChat] Media upload failed:', e);
      Alert.alert('Upload Error', 'Failed to upload media. Please try again.');
      setSending(false);
      return;
    }

    setSending(true);
    const msg = { 
        sender_id: user?.id, 
        recipient_id: coachId, 
        content: finalContent, 
        read: false, 
        reply_to_id: replyId, 
        ai_generated: false 
    };
    const { error } = await supabase.from('messages').insert(msg);
    if (error) {
        console.error('[CoachCoachChat] Message insert failed:', error);
        Alert.alert('Error', 'Failed to send media');
    }
    setSending(false);
    setReplyingTo(null);
  };

  const handleAction = async (action: 'reply' | 'copy' | 'delete' | 'forward') => {
    if (!activeMessageForMenu) return;
    if (action === 'reply') setReplyingTo(activeMessageForMenu);
    else if (action === 'copy') {
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
    let content: any = {};
    try { content = JSON.parse(activeMessageForMenu.content); } catch { content = { text: activeMessageForMenu.content, type: 'text' }; }
    const reactions = content.reactions || [];
    const idx = reactions.findIndex((r: any) => r.user_id === user.id && r.emoji === emoji);
    let nr = [...reactions];
    if (idx > -1) nr.splice(idx, 1); else nr.push({ emoji, user_id: user.id });
    const updated = JSON.stringify({ ...content, reactions: nr });
    
    // Optimistic update
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: updated } : m));
    
    const { error } = await supabase.from('messages').update({ content: updated }).eq('id', msgId);
    if (error) {
        console.error('[CoachCoachChat] Reaction failed:', error);
        Alert.alert('Error', 'Failed to react: ' + error.message);
    }
    setActiveMessageForMenu(null);
  };

  const scrollToMessage = useCallback((mid: string) => {
    const idx = messages.findIndex(m => m.id === mid);
    if (idx !== -1) {
      flatListRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5, viewOffset: 80 });
      setHighlightedMessageId(mid);
      setTimeout(() => setHighlightedMessageId(null), 1500);
    }
  }, [messages]);

  const MessageBubble = ({ item, isMe, repliedMsg, isHighlighted, onReplyPress, theme }: any) => {
    const [isExpanded, setIsExpanded] = React.useState(false);
    let displayContent = item.content, reactions: any[] = [], isDeleted = false, deletedBy = '', isMedia = false;
    try {
      const p = JSON.parse(item.content);
      displayContent = p.text || item.content;
      reactions = p.reactions || [];
      if (p.type === 'deleted') { isDeleted = true; deletedBy = p.deleted_by; }
      if (['image', 'video', 'document', 'gif', 'challenge_completed', 'task_completion'].includes(p.type)) isMedia = true;
      if (p.type === 'meal' || p.type === 'meal_log') return <MealMessageCard content={item.content} isOwn={isMe} />;
    } catch {}

    if (isDeleted) {
      const name = deletedBy === user?.id ? 'You' : (coachInfo?.full_name || 'Coach');
      return (
        <View className="px-5 py-3 rounded-[24px] border border-slate-800 bg-slate-900/40 italic">
          <Text className="text-slate-500 text-sm">{name} deleted this message</Text>
        </View>
      );
    }

    if (isMedia) return <ChatMediaMessage content={item.content} isOwn={isMe} createdAt={item.created_at} isRead={item.read} />;

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
          <MessageBubble 
            item={item} 
            isMe={isMe} 
            repliedMsg={item.reply_to_id ? messages.find(m => m.id === item.reply_to_id) : null}
            isHighlighted={item.id === highlightedMessageId}
            onReplyPress={() => item.reply_to_id && scrollToMessage(item.reply_to_id)}
            theme={theme}
          />
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
                    <BrandedAvatar name={coachInfo?.full_name || 'Coach'} size={42} imageUrl={coachInfo?.avatar_url} />
                    <View>
                        <Text className="text-white font-black text-lg tracking-tight">{coachInfo?.full_name || 'Coach'}</Text>
                        <View className="flex-row items-center gap-1.5"><View className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /><Text className="text-slate-500 text-[9px] font-black uppercase tracking-[2px]">Encrypted Stream</Text></View>
                    </View>
                </View>
            </View>
            <TouchableOpacity className="w-10 h-10 bg-slate-900 rounded-xl items-center justify-center border border-white/5"><Shield size={18} color="#64748B" /></TouchableOpacity>
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
