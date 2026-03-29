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
import { Swipeable } from 'react-native-gesture-handler';
import { useTheme } from '@/contexts/BrandContext';
import { BrandedAvatar } from '@/components/BrandedAvatar';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotiView } from 'moti';

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
  
  const flatListRef = useRef<FlatList>(null);
  const swipeableRefs = useRef<{ [key: string]: Swipeable | null }>({});

  useEffect(() => {
    if (user) {
      loadChatData();
    }
  }, [user?.id]);

  useEffect(() => {
    if (user && coachUserId) {
        const channel = supabase.channel(`client-chat-${user.id}`)
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (p) => {
            const nm = p.new as Message;
            if (nm.sender_id === coachUserId || nm.sender_id === user.id) {
              setMessages(prev => [nm, ...prev]);
              if (nm.sender_id !== user.id) markAsRead(nm.id);
            }
          })
          .subscribe();
        return () => { supabase.removeChannel(channel); };
    }
  }, [user?.id, coachUserId]);

  const loadChatData = async () => {
    try {
      setLoading(true);
      
      // Single joined query: coach_client_links → coaches → profiles (was 3 sequential queries)
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
          console.log('[ClientChat] No active coach link found');
          setLoading(false);
          return;
      }

      const coachData = linkWithCoach.coaches as any;
      const resolvedCoachUserId = coachData.user_id;
      setCoachUserId(resolvedCoachUserId);
      setCoachProfile(coachData.profiles);

      // Messages query runs after we have coachUserId
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

  const sendMessage = async (text: string, replyId?: string) => {
    if (!user || !coachUserId || !text.trim()) return;
    setSending(true);
    const msg = { sender_id: user.id, recipient_id: coachUserId, content: text, read: false, reply_to_id: replyId, ai_generated: false };
    const { error } = await supabase.from('messages').insert(msg);
    if (error) Alert.alert('Error', 'Failed to send');
    setSending(false);
    setReplyingTo(null);
  };

  const scrollToMessage = useCallback((messageId: string) => {
     const idx = messages.findIndex(m => m.id === messageId);
     if (idx !== -1) {
         setHighlightedMessageId(messageId);
         flatListRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5, viewOffset: 80 });
         setTimeout(() => setHighlightedMessageId(null), 2000);
     }
  }, [messages]);

  const renderMessageContent = (item: Message, isMe: boolean) => {
    try {
        const parsed = JSON.parse(item.content);
        if (parsed.type === 'meal' || parsed.type === 'meal_log') return <MealMessageCard content={item.content} isOwn={isMe} />;
        if (['image', 'video', 'document', 'gif'].includes(parsed.type)) {
            return <ChatMediaMessage content={item.content} isOwn={isMe} createdAt={item.created_at} isRead={item.read} />;
        }
    } catch {}

    const repliedMsg = item.reply_to_id ? messages.find(m => m.id === item.reply_to_id) : null;
    const isHighlighted = item.id === highlightedMessageId;

    return (
        <MotiView 
            from={{ backgroundColor: isMe ? theme.colors.primary : '#334155', scale: 1 }}
            animate={{ 
                scale: isHighlighted ? 1.05 : 1,
                backgroundColor: isHighlighted 
                    ? (isMe ? '#60A5FA' : '#475569') // High-contrast light blink
                    : (isMe ? theme.colors.primary : '#334155') 
            }}
            transition={{ type: 'timing', duration: 250 }}
            className={`px-5 py-3.5 rounded-[28px] ${isMe ? 'rounded-br-none' : 'rounded-bl-none border border-white/5'} shadow-2xl`}
            style={{ 
                maxWidth: '85%',
                minWidth: isMe ? 0 : 120, // Lengthier received bubbles
                backgroundColor: isMe ? theme.colors.primary : '#334155' // Robust fallback
            }}
        >
          {repliedMsg && (
             <TouchableOpacity 
                activeOpacity={0.8}
                onPress={() => scrollToMessage(item.reply_to_id!)}
                className="bg-black/20 px-4 py-3 rounded-2xl mb-2 border-l-4 border-white/30 min-h-[44px]"
             >
                <Text className="text-[9px] font-black text-white/50 uppercase tracking-widest mb-0.5">{repliedMsg.sender_id === user?.id ? 'You' : 'Coach'}</Text>
                <Text className="text-white/80 text-xs" numberOfLines={1}>{repliedMsg.content}</Text>
             </TouchableOpacity>
          )}
          <Text className="text-[15px] font-medium leading-[22px] text-white">{item.content}</Text>
          <View className="flex-row items-center justify-end gap-1.5 mt-2">
             <Text className="text-[9px] font-bold text-white/40">{new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
             {isMe && <CheckCheck size={11} color={item.read ? '#34D399' : '#94A3B8'} />}
          </View>
        </MotiView>
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
        onSwipeableWillOpen={() => {
            setReplyingTo(item);
            swipeableRefs.current[item.id]?.close();
        }}
        friction={1}
        overshootLeft={false}
        enableTrackpadTwoFingerGesture
        containerStyle={{ marginBottom: 16 }}
      >
        <TouchableOpacity 
            activeOpacity={0.9} 
            onLongPress={() => { setReplyingTo(item); }}
            style={{ width: '100%', alignItems: isMe ? 'flex-end' : 'flex-start' }}
        >
            {renderMessageContent(item, isMe)}
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
                        <Text className="text-white font-black text-lg tracking-tight">{coachProfile?.full_name || 'Coach'}</Text>
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

      <View style={{ flex: 1 }} className="px-6">
          {loading ? (
            <View className="flex-1 items-center justify-center">
                <ActivityIndicator color="#3B82F6" />
                <Text className="text-slate-500 text-xs mt-4 font-black uppercase tracking-widest">Accessing Channel...</Text>
            </View>
          ) : messages.length === 0 ? (
            <View className="flex-1 items-center justify-center px-10">
                <View className="w-20 h-20 bg-slate-900 rounded-[32px] items-center justify-center border border-white/5 mb-6">
                    <Send size={32} color="#1E293B" />
                </View>
                <Text className="text-white text-xl font-black text-center mb-2">Secure Connection Ready</Text>
                <Text className="text-slate-500 text-center text-sm leading-6">Say hello to your coach to begin your strategy session.</Text>
            </View>
          ) : (
            <FlatList
                ref={flatListRef}
                data={messages}
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

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ paddingBottom: insets.bottom > 0 ? insets.bottom : 12 }} className="bg-slate-950 border-t border-white/5">
              <ChatInputBar onSendText={sendMessage} onSendMedia={async () => {}} sending={sending} replyingTo={replyingTo} onCancelReply={() => setReplyingTo(null)} />
          </View>
      </KeyboardAvoidingView>
    </View>
  );
}
