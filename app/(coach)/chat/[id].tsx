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
};

export default function CoachChatScreen() {
  const { id } = useLocalSearchParams(); // This is the CLIENT ID
  const router = useRouter();
  const { user, profile, coach } = useAuth();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { refreshUnreadCount } = useUnread();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientProfile, setClientProfile] = useState<any>(null);
  const [clientUserId, setClientUserId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [nextSession, setNextSession] = useState<any>(null);
  const [allCoachSessions, setAllCoachSessions] = useState<any[]>([]);
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
      // Get client's profile and user_id
      const { data: cData, error: cError } = await supabase
        .from('clients')
        .select('user_id, profiles:user_id(full_name, avatar_url, id)')
        .eq('id', id)
        .single();
      
      if (cError) throw cError;
      setClientProfile(cData);
      setClientUserId(cData.user_id);

      // Get conversation messages
      const { data: mData, error: mError } = await supabase.from('messages')
        .select('*')
        .or(`and(sender_id.eq.${user?.id},recipient_id.eq.${cData.user_id}),and(sender_id.eq.${cData.user_id},recipient_id.eq.${user?.id})`)
        .order('created_at', { ascending: false });
      
      if (mError) throw mError;
      setMessages(mData || []);
      
      // Real-time sub for this convo
      const channel = supabase.channel(`coach-convo-${id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (p) => {
          const nm = p.new as Message;
          if (nm.sender_id === cData.user_id || nm.sender_id === user!.id) {
            setMessages(prev => [nm, ...prev]);
            if (nm.sender_id !== user!.id) markAsRead(nm.id);
          }
        })
        .subscribe();

      loadNextSession();
      return () => { supabase.removeChannel(channel); };
    } catch (e) { 
        console.error('[CoachChat] Error loading data:', e); 
        Alert.alert('Error', 'Failed to load chat data.');
    } finally { 
        setLoading(false); 
    }
  };

  const loadNextSession = async () => {
    if (!coach?.id) return;
    const { data } = await supabase.from('sessions')
        .select('*')
        .eq('client_id', id)
        .eq('coach_id', coach.id)
        .eq('status', 'scheduled')
        .gt('scheduled_at', new Date().toISOString())
        .order('scheduled_at', { ascending: true })
        .limit(1)
        .maybeSingle();
    setNextSession(data);
  };

  const markAsRead = async (mid: string) => {
    await supabase.from('messages').update({ read: true }).eq('id', mid);
    refreshUnreadCount();
  };

  const sendMessage = async (text: string, replyId?: string) => {
    if (!user || !clientUserId || !text.trim()) return;
    setSending(true);
    const msg = { 
        sender_id: user.id, 
        recipient_id: clientUserId, 
        content: text, 
        read: false, 
        reply_to_id: replyId,
        ai_generated: false 
    };
    const { error } = await supabase.from('messages').insert(msg);
    if (error) Alert.alert('Error', 'Failed to send message');
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

  const renderSessionCard = (sessionData: any, isMe: boolean) => {
    const date = new Date(sessionData.timestamp || sessionData.scheduled_at);
    const status = sessionData.status || 'scheduled';
    
    let statusLabel = "UPCOMING";
    let statusColor = "#9333EA";
    if (status === 'postponed') { statusLabel = "POSTPONED"; statusColor = "#EAB308"; }
    if (status === 'cancelled') { statusLabel = "CANCELLED"; statusColor = "#EF4444"; }

    return (
      <View className="bg-slate-900/80 rounded-[32px] p-6 border border-white/5 shadow-2xl w-full">
          <View style={{ backgroundColor: statusColor }} className="self-start px-3 py-1 rounded-full mb-4">
              <Text className="text-white text-[10px] font-black tracking-widest uppercase">{statusLabel}</Text>
          </View>
          <View className="flex-row items-center justify-between mb-4">
              <View className="flex-1">
                  <Text className="text-white text-xl font-black tracking-tight mb-1">{sessionData.description || 'Live Session'}</Text>
                  <View className="flex-row items-center gap-2">
                       <Calendar size={14} color="#64748B" />
                       <Text className="text-slate-400 font-bold text-sm">
                           {date.toLocaleDateString([], { weekday: 'long' })} at {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                       </Text>
                  </View>
              </View>
              <View className="w-12 h-12 bg-slate-950 rounded-2xl items-center justify-center border border-white/5">
                  <Dumbbell size={24} color="#FB923C" />
              </View>
          </View>
          
          <View className="flex-row items-center gap-4 mt-2">
              <TouchableOpacity className="flex-1 bg-blue-600 py-4 rounded-2xl items-center shadow-lg shadow-blue-500/30">
                  <Text className="text-white font-black uppercase text-xs tracking-widest">Join Now</Text>
              </TouchableOpacity>
              <TouchableOpacity className="px-4">
                  <Text className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">Cancel</Text>
              </TouchableOpacity>
          </View>
      </View>
    );
  };

  const renderMessageContent = (item: Message, isMe: boolean) => {
    try {
        const parsed = JSON.parse(item.content);
        if (parsed.type === 'session_invite' || parsed.type === 'session_proposal') {
            return renderSessionCard(parsed, isMe);
        }
    } catch {}

    const isHighlighted = item.id === highlightedMessageId;
    const repliedMsg = item.reply_to_id ? messages.find(m => m.id === item.reply_to_id) : null;

    return (
        <MotiView 
            animate={{ 
                scale: isHighlighted ? 1.05 : 1,
                opacity: 1,
                backgroundColor: isHighlighted ? '#3B82F6' : (isMe ? '#2563EB' : '#0F172A') 
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
                <Text className="text-[9px] font-black text-white/50 uppercase tracking-widest mb-0.5">{repliedMsg.sender_id === user?.id ? 'You' : 'Client'}</Text>
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
    const isMe = item.sender_id === user?.id; // Robust check using exact user ID
    
    // ACTION: Swiping reveal reply
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
        renderRightActions={renderRightActions} // Enable for everyone
        onSwipeableOpen={() => {
            console.log('[CoachChat] Replying to:', item.id);
            setReplyingTo(item);
            swipeableRefs.current[item.id]?.close();
        }}
        containerStyle={{ marginBottom: 16 }}
      >
        <View style={{ width: '100%', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
            {renderMessageContent(item, isMe)}
        </View>
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
                        <Text className="text-white font-black text-lg tracking-tight">{clientProfile?.profiles?.full_name || 'Loading...'}</Text>
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
                <Text className="text-slate-500 text-xs mt-4 font-black uppercase tracking-widest">Opening Convo...</Text>
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

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
          <View style={{ paddingBottom: insets.bottom > 0 ? insets.bottom : 12 }} className="bg-slate-950 border-t border-white/5">
              <ChatInputBar 
                onSendText={sendMessage} 
                onSendMedia={async () => {}} 
                sending={sending} 
                replyingTo={replyingTo} 
                onCancelReply={() => setReplyingTo(null)} 
              />
          </View>
      </KeyboardAvoidingView>

      <Modal visible={menuVisible} transparent animationType="slide">
          <Pressable className="flex-1 bg-black/60 justify-end" onPress={() => setMenuVisible(false)}>
              <MotiView 
                from={{ translateY: 300 }}
                animate={{ translateY: 0 }}
                className="bg-slate-900 rounded-t-[48px] p-8 border-t border-white/10"
              >
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
          onConfirm={async () => { 
                await loadNextSession();
                setSchedulerVisible(false);
          }}
          clientContext={{ name: clientProfile.profiles?.full_name, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }}
          existingSessions={allCoachSessions}
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
