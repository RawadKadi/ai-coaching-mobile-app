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
  Image, 
  Modal, 
  Pressable, 
  Dimensions, 
  Linking, 
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
  Send, 
  ArrowLeft, 
  ChevronDown, 
  ChevronUp, 
  Check, 
  CheckCheck, 
  X, 
  Calendar, 
  Video, 
  ArrowDown, 
  MoreVertical, 
  Activity,
  Plus,
  Reply,
  Dumbbell,
  Shield
} from 'lucide-react-native';
import { BrandedAvatar } from '@/components/BrandedAvatar';
import { ChatInputBar } from '@/components/ChatInputBar';
import SchedulerModal from '@/components/SchedulerModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
};

export default function CoachChatScreen() {
  const { id } = useLocalSearchParams(); // This is the CLIENT ID (UUID)
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
  
  const flatListRef = useRef<FlatList>(null);
  const swipeableRefs = useRef<{ [key: string]: Swipeable | null }>({});

  useEffect(() => {
    if (user && id) {
      loadChatData();
    }
  }, [user?.id, id]);

  const loadChatData = async () => {
    try {
      setLoading(true);
      
      // 1. Get client details using the RPC which is the source of truth in main/v2
      const { data: cData, error: cError } = await supabase.rpc('get_client_details', { target_client_id: id });
      if (cError) throw cError;
      
      setClientProfile({ profiles: { full_name: cData.full_name, avatar_url: cData.avatar_url, id: cData.id } });
      setClientUserId(cData.id); // In main logic, id from RPC is the profile/user id

      // 2. Get messages (between coach-auth-user-id and client-auth-user-id)
      const { data: mData, error: mError } = await supabase.from('messages')
        .select('*')
        .or(`and(sender_id.eq.${profile?.id},recipient_id.eq.${cData.id}),and(sender_id.eq.${cData.id},recipient_id.eq.${profile?.id})`)
        .order('created_at', { ascending: false });
      
      if (mError) throw mError;
      setMessages(mData || []);
      
      // 3. Real-time subscription
      const channel = supabase.channel(`coach-convo-${id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (p) => {
          const nm = p.new as Message;
          if (nm.sender_id === cData.id || nm.sender_id === profile?.id) {
            setMessages(prev => [nm, ...prev]);
            if (nm.sender_id !== profile?.id) markAsRead(nm.id);
          }
        })
        .subscribe();

      return () => { supabase.removeChannel(channel); };
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

  const sendMessage = async (text: string, replyId?: string) => {
    if (!profile || !clientUserId || !text.trim()) return;
    setSending(true);
    const msg = { sender_id: profile.id, recipient_id: clientUserId, content: text, read: false, reply_to_id: replyId, ai_generated: false };
    const { error } = await supabase.from('messages').insert(msg);
    if (error) Alert.alert('Error', 'Failed to send');
    setSending(false);
    setReplyingTo(null);
  };

  const scrollToMessage = useCallback((messageId: string) => {
     const idx = messages.findIndex(m => m.id === messageId);
     if (idx !== -1) {
         setHighlightedMessageId(messageId);
         flatListRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 });
         setTimeout(() => setHighlightedMessageId(null), 2000);
     }
  }, [messages]);

  const renderMessageContent = (item: Message, isMe: boolean) => {
    const isHighlighted = item.id === highlightedMessageId;
    const repliedMsg = item.reply_to_id ? messages.find(m => m.id === item.reply_to_id) : null;

    return (
        <MotiView 
            animate={{ 
                scale: isHighlighted ? 1.05 : 1,
                backgroundColor: isHighlighted ? '#60A5FA' : (isMe ? '#2563EB' : '#1E293B') 
            }}
            transition={{ type: 'spring', damping: 15 }}
            className={`px-5 py-3.5 rounded-[28px] ${isMe ? 'rounded-br-none' : 'rounded-bl-none border border-white/5 shadow-2xl'}`}
            style={{ maxWidth: '85%' }}
        >
          {repliedMsg && (
             <TouchableOpacity 
                activeOpacity={0.8}
                onPress={() => scrollToMessage(item.reply_to_id!)}
                className="bg-black/20 px-3 py-2 rounded-2xl mb-2 border-l-2 border-white/30"
             >
                <Text className="text-[9px] font-black text-white/50 uppercase tracking-widest mb-0.5">{repliedMsg.sender_id === profile?.id ? 'You' : 'Client'}</Text>
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
    const isMe = item.sender_id === profile?.id;
    
    const renderRightActions = (progress: any, dragX: any) => {
        const trans = dragX.interpolate({ inputRange: [-100, 0], outputRange: [1, 0], extrapolate: 'clamp' });
        return (
            <View style={{ width: 60, justifyContent: 'center', alignItems: 'center' }}>
                <Animated.View style={{ transform: [{ scale: trans }] }}><Reply size={24} color="#3B82F6" /></Animated.View>
            </View>
        );
    };

    return (
      <Swipeable
        ref={ref => { if (ref) swipeableRefs.current[item.id] = ref; }}
        renderRightActions={renderRightActions}
        onSwipeableOpen={() => {
            setReplyingTo(item);
            swipeableRefs.current[item.id]?.close();
        }}
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
      
      {/* Precision Header */}
      <View style={{ paddingTop: insets.top, backgroundColor: '#020617' }} className="border-b border-white/5">
        <View className="flex-row items-center justify-between px-6 py-4">
            <View className="flex-row items-center gap-4">
                <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 bg-slate-900 rounded-xl items-center justify-center border border-white/5">
                    <ArrowLeft size={18} color="white" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.push(`/(coach)/clients/${id}`)} className="flex-row items-center gap-3">
                    <BrandedAvatar name={clientProfile?.profiles?.full_name} size={42} imageUrl={clientProfile?.profiles?.avatar_url} />
                    <View>
                        <Text className="text-white font-black text-lg tracking-tight">{clientProfile?.profiles?.full_name || 'Protocol Hub'}</Text>
                        <View className="flex-row items-center gap-1.5">
                            <View className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                            <Text className="text-slate-500 text-[9px] font-black uppercase tracking-[2px]">Encrypted Stream</Text>
                        </View>
                    </View>
                </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => setMenuVisible(true)} className="w-10 h-10 bg-slate-900 rounded-xl items-center justify-center border border-white/5">
                <MoreVertical size={20} color="#64748B" />
            </TouchableOpacity>
        </View>
      </View>

      <View style={{ flex: 1 }} className="px-6">
          {loading ? (
            <View className="flex-1 items-center justify-center">
                <ActivityIndicator color="#3B82F6" />
                <Text className="text-slate-500 text-xs mt-4 font-black uppercase tracking-widest">Opening Secure Comms...</Text>
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

      {clientProfile && (
        <SchedulerModal
          visible={schedulerVisible}
          onClose={() => setSchedulerVisible(false)}
          onConfirm={async () => { setSchedulerVisible(false); }}
          clientContext={{ name: clientProfile.profiles?.full_name, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }}
          existingSessions={[]}
          targetClientId={id as string}
        />
      )}
    </View>
  );
}

const OptionItem = ({ icon, title, sub, onPress }: any) => (
    <TouchableOpacity onPress={onPress} className="flex-row items-center gap-5 p-5 bg-slate-950 rounded-[32px] border border-white/5 mb-4">
        <View className="w-12 h-12 bg-slate-900 rounded-2xl items-center justify-center border border-white/5">{icon}</View>
        <View>
            <Text className="text-white font-black text-base">{title}</Text>
            <Text className="text-slate-500 text-[11px] font-medium">{sub}</Text>
        </View>
    </TouchableOpacity>
);
