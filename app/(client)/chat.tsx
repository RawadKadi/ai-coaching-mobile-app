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
  LayoutAnimation, 
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
import { PinchGestureHandler, PanGestureHandler, State } from 'react-native-gesture-handler';
import { useAuth } from '@/contexts/AuthContext';
import { useUnread } from '@/contexts/UnreadContext';
import { supabase } from '@/lib/supabase';
import { Send, ChevronDown, ChevronUp, X, Video, ArrowDown, Check, CheckCheck, ArrowLeft, MoreVertical, Shield } from 'lucide-react-native';
import MealMessageCard from '@/components/MealMessageCard';
import RescheduleProposalMessage from '@/components/RescheduleProposalMessage';
import ChatMediaMessage from '@/components/ChatMediaMessage';
import { ChatInputBar } from '@/components/ChatInputBar';
import { useFocusEffect } from 'expo-router';
import { uploadChatMedia } from '@/lib/uploadChatMedia';
import { Swipeable } from 'react-native-gesture-handler';
import { Reply } from 'lucide-react-native';
import { useTheme } from '@/contexts/BrandContext';
import { BrandedAvatar } from '@/components/BrandedAvatar';
import { BrandedText } from '@/components/BrandedText';
import { ChevronLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { ChatReplyContext } from '@/components/ChatReplyContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotiView, AnimatePresence } from 'moti';

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
  const { user, coach } = useAuth();
  const { refreshUnreadCount } = useUnread();
  const theme = useTheme();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [coachProfile, setCoachProfile] = useState<any>(null);
  const [sending, setSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (user && coach) {
      loadChatData();
      const channel = supabase.channel(`client-chat-${user.id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (p) => {
          const nm = p.new as Message;
          if (nm.sender_id === coach.user_id || nm.sender_id === user.id) {
            setMessages(prev => [nm, ...prev]);
            if (nm.sender_id !== user.id) markAsRead(nm.id);
          }
        })
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [user?.id, coach?.user_id]);

  const loadChatData = async () => {
    try {
      setLoading(true);
      const { data: cData } = await supabase.from('profiles').select('*').eq('id', coach?.user_id).single();
      setCoachProfile(cData);

      const { data: mData } = await supabase.from('messages')
        .select('*')
        .or(`and(sender_id.eq.${user?.id},recipient_id.eq.${coach?.user_id}),and(sender_id.eq.${coach?.user_id},recipient_id.eq.${user?.id})`)
        .order('created_at', { ascending: false });
      
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

  const scrollToMessage = useCallback((messageId: string) => {
     const idx = messages.findIndex(m => m.id === messageId);
     if (idx !== -1) {
         setHighlightedMessageId(messageId);
         flatListRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 });
         setTimeout(() => setHighlightedMessageId(null), 2000);
     }
  }, [messages]);

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.sender_id === user?.id;
    const isHighlighted = item.id === highlightedMessageId;
    const repliedMsg = item.reply_to_id ? messages.find(m => m.id === item.reply_to_id) : null;

    return (
      <View style={{ width: '100%', marginBottom: 12, alignItems: isMe ? 'flex-end' : 'flex-start' }}>
        <MotiView 
            animate={{ 
                scale: isHighlighted ? 1.05 : 1,
                backgroundColor: isHighlighted ? '#3B82F6' : (isMe ? '#2563EB' : '#0F172A') 
            }}
            transition={{ type: 'spring', damping: 15 }}
            className={`px-5 py-3.5 rounded-[28px] max-w-[85%] ${isMe ? 'rounded-br-none' : 'rounded-bl-none border border-white/5 shadow-2xl'}`}
        >
          {repliedMsg && (
             <TouchableOpacity 
                activeOpacity={0.8}
                onPress={() => scrollToMessage(item.reply_to_id!)}
                className="bg-black/20 px-3 py-2 rounded-2xl mb-2 border-l-2 border-white/30"
             >
                <Text className="text-[9px] font-black text-white/50 uppercase tracking-widest mb-0.5">{repliedMsg.sender_id === user?.id ? 'You' : 'Coach'}</Text>
                <Text className="text-white/80 text-xs" numberOfLines={1}>{repliedMsg.content}</Text>
             </TouchableOpacity>
          )}
          <Text className={`text-[15px] font-medium leading-[22px] ${isMe ? 'text-white' : 'text-slate-100'}`}>{item.content}</Text>
          <View className="flex-row items-center justify-end gap-1.5 mt-2">
             <Text className="text-[9px] font-bold text-white/40">{new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
             {isMe && <CheckCheck size={11} color={item.read ? '#34D399' : '#94A3B8'} />}
          </View>
        </MotiView>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#020617' }}>
      <StatusBar barStyle="light-content" translucent />
      
      {/* Premium Inset Header */}
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

      <View style={{ flex: 1 }} className="px-6">
          {loading ? (
            <View className="flex-1 items-center justify-center"><ActivityIndicator color="#3B82F6" /></View>
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
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
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
    </View>
  );
}
