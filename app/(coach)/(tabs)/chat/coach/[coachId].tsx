import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  KeyboardAvoidingView, Platform, ActivityIndicator, Image, Alert,
} from 'react-native';
import { TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/BrandContext';
import { useUnread } from '@/contexts/UnreadContext';
import { supabase } from '@/lib/supabase';
import { ChevronLeft, Check, CheckCheck, ArrowDown } from 'lucide-react-native';
import { ChatInputBar } from '@/components/ChatInputBar';
import { ChatMediaMessage } from '@/components/ChatMediaMessage';

type Message = {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: string;
  read: boolean;
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
  const { user: profile } = useAuth();
  const theme = useTheme();
  const { refreshUnreadCount } = useUnread();

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [coachInfo, setCoachInfo] = useState<CoachInfo | null>(null);
  const [firstUnreadIndex, setFirstUnreadIndex] = useState(-1);
  const [unreadCountAtOpen, setUnreadCountAtOpen] = useState(0);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const flatListRef = useRef<FlatList>(null);

  // ─── Initial load ────────────────────────────────────────────────────────

  useEffect(() => {
    if (profile && coachId) {
      loadChatData();
    }
  }, [profile, coachId]);

  useFocusEffect(
    useCallback(() => {
      if (profile && coachId) {
        setFirstUnreadIndex(-1);
        setUnreadCountAtOpen(0);
        loadChatData().then(data => {
          setTimeout(() => markMessagesAsRead(data), 500);
        });
      }
    }, [profile, coachId])
  );

  // ─── Real-time subscription ───────────────────────────────────────────────

  useEffect(() => {
    if (!profile?.id || !coachInfo?.user_id) return;

    const channel = supabase
      .channel(`coach-chat-${coachId}-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const msg = payload.new as Message;
          const isFromThem = msg.sender_id === coachInfo.user_id && msg.recipient_id === profile.id;
          const isFromMe   = msg.sender_id === profile.id && msg.recipient_id === coachInfo.user_id;

          if (isFromThem || isFromMe) {
            setMessages(current => {
              const existsById = current.find(m => m.id === msg.id);
              const existsByContent = current.find(m =>
                m.sender_id === msg.sender_id &&
                m.content === msg.content &&
                Math.abs(new Date(m.created_at).getTime() - new Date(msg.created_at).getTime()) < 3000
              );
              if (existsById) return current;
              if (existsByContent) {
                if (existsByContent.id.startsWith('temp-')) {
                  return current.map(m => m.id === existsByContent.id ? msg : m);
                }
                return current;
              }
              return [...current, msg];
            });
            if (isFromThem) markAsRead(msg.id);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        (payload) => {
          const updated = payload.new as Message;
          const isInConvo =
            (updated.sender_id === coachInfo.user_id && updated.recipient_id === profile.id) ||
            (updated.sender_id === profile.id && updated.recipient_id === coachInfo.user_id);

          if (isInConvo) {
            setMessages(current => current.map(m => m.id === updated.id ? updated : m));
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile?.id, coachInfo?.user_id]);

  // ─── Data loaders ─────────────────────────────────────────────────────────

  const loadChatData = async (): Promise<Message[]> => {
    try {
      setLoading(true);

      // 1. Set coach info from route params (passed from the messages list).
      //    This avoids querying the coaches/profiles tables which are blocked by RLS.
      if (!paramUserId) {
        console.error('[CoachChat] No userId param — cannot load chat');
        return [];
      }

      const info: CoachInfo = {
        user_id: paramUserId,
        full_name: paramFullName || 'Coach',
        avatar_url: paramAvatarUrl || null,
      };
      setCoachInfo(info);

      // 2. Load conversation messages
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(
          `and(sender_id.eq.${profile?.id},recipient_id.eq.${info.user_id}),` +
          `and(sender_id.eq.${info.user_id},recipient_id.eq.${profile?.id})`
        )
        .order('created_at', { ascending: true });

      if (error) throw error;

      setMessages(data || []);

      // 3. Track first unread for the "NEW MESSAGES" separator
      if (data && data.length > 0) {
        const unreadMsgs = data.filter(m => !m.read && m.sender_id === info.user_id);
        if (unreadMsgs.length > 0) {
          const firstUnreadIdx = data.findIndex(m => m.id === unreadMsgs[0].id);
          if (firstUnreadIdx !== -1 && firstUnreadIndex === -1) {
            setFirstUnreadIndex(data.length - 1 - firstUnreadIdx);
            setUnreadCountAtOpen(unreadMsgs.length);
          }
        }
      }

      return data || [];
    } catch (error) {
      console.error('[CoachChat] Error loading chat:', error);
      return [];
    } finally {
      setLoading(false);
    }
  };

  // ─── Read / send ──────────────────────────────────────────────────────────

  const markAsRead = async (messageId: string) => {
    await supabase.from('messages').update({ read: true }).eq('id', messageId);
  };

  const markMessagesAsRead = async (msgs?: Message[]) => {
    const list = msgs || messages;
    if (!list.length || !profile?.id) return;
    const unreadIds = list
      .filter(m => !m.read && m.recipient_id === profile.id)
      .map(m => m.id);
    if (unreadIds.length > 0) {
      await supabase.from('messages').update({ read: true }).in('id', unreadIds);
      refreshUnreadCount();
    }
  };

  const sendMediaMessage = async (jsonContent: string) => {
    if (!profile || !coachInfo) return;
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          sender_id: profile.id,
          recipient_id: coachInfo.user_id,
          content: jsonContent,
          read: false,
          ai_generated: false,
        })
        .select()
        .single();
      if (error) throw error;
      setMessages(prev => [...prev, data]);
    } catch (error) {
      console.error('[CoachChat] Error sending media:', error);
      Alert.alert('Error', 'Failed to send. Please try again.');
    }
  };

  const sendMessage = async (text: string) => {
    if (!profile || !coachInfo) return;

    // Optimistic update
    const tempId = `temp-${Date.now()}`;
    const optimistic = {
      id: tempId,
      sender_id: profile.id,
      recipient_id: coachInfo.user_id,
      content: text,
      created_at: new Date().toISOString(),
      read: false,
    };
    setMessages(prev => [...prev, optimistic]);

    try {
      setSending(true);
      const { data, error } = await supabase
        .from('messages')
        .insert({
          sender_id: profile.id,
          recipient_id: coachInfo.user_id,
          content: text,
          read: false,
          ai_generated: false,
        })
        .select()
        .single();

      if (error) throw error;
      setMessages(prev => prev.map(m => m.id === tempId ? data : m));
    } catch (error) {
      console.error('[CoachChat] Error sending message:', error);
      setMessages(prev => prev.filter(m => m.id !== tempId));
      Alert.alert('Error', 'Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  // ─── Scroll helpers ───────────────────────────────────────────────────────

  const handleScroll = (event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const isAtBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - 50;
    setShowScrollButton(!isAtBottom);
    if (isAtBottom && messages.length > 0) markMessagesAsRead();
  };

  const scrollToBottom = () => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    setShowScrollButton(false);
    markMessagesAsRead();
  };

  // ─── Message renderer ─────────────────────────────────────────────────────

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isOwn = item.sender_id === profile?.id;
    const showSeparator = index === firstUnreadIndex;

    // Detect media message
    let isMedia = false;
    try {
      const p = JSON.parse(item.content);
      if (p?.type && ['image', 'video', 'document', 'gif'].includes(p.type)) isMedia = true;
    } catch {}

    return (
      <View>
        {showSeparator && (
          <View style={styles.unreadSeparator}>
            <View style={[styles.unreadLine, { backgroundColor: theme.colors.border }]} />
            <View style={[styles.unreadBadge, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.primary }]}>
              <Text style={[styles.unreadBadgeText, { color: theme.colors.primary }]}>
                {unreadCountAtOpen} NEW {unreadCountAtOpen === 1 ? 'MESSAGE' : 'MESSAGES'}
              </Text>
            </View>
            <View style={[styles.unreadLine, { backgroundColor: theme.colors.border }]} />
          </View>
        )}

        {isMedia ? (
          <ChatMediaMessage content={item.content} isOwn={isOwn} />
        ) : (
          <View style={[
            styles.bubble,
            isOwn
              ? [styles.myBubble, { backgroundColor: theme.colors.primary }]
              : [styles.theirBubble, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }],
          ]}>
            <Text style={[
              styles.bubbleText,
              { fontFamily: theme.typography.fontFamily },
              isOwn ? { color: theme.colors.textOnPrimary } : { color: theme.colors.text },
            ]}>
              {item.content}
            </Text>
            <View style={styles.bubbleFooter}>
              <Text style={[
                styles.timestamp,
                isOwn
                  ? { color: theme.colors.textOnPrimary, opacity: 0.7 }
                  : { color: theme.colors.textSecondary },
              ]}>
                {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
              {isOwn && (
                item.read
                  ? <CheckCheck size={14} color={theme.colors.textOnPrimary} style={{ opacity: 0.8 }} />
                  : <Check size={14} color={theme.colors.textOnPrimary} style={{ opacity: 0.8 }} />
              )}
            </View>
          </View>
        )}
      </View>
    );
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>

        <View style={styles.headerInfo}>
          {coachInfo?.avatar_url ? (
            <Image source={{ uri: coachInfo.avatar_url }} style={styles.headerAvatar} />
          ) : (
            <View style={[styles.headerAvatarPlaceholder, { backgroundColor: theme.colors.surfaceAlt }]}>
              <Text style={[styles.headerAvatarInitials, { color: theme.colors.primary }]}>
                {coachInfo ? getInitials(coachInfo.full_name) : '?'}
              </Text>
            </View>
          )}
          <View>
            <Text style={[styles.headerName, { color: theme.colors.text, fontFamily: theme.typography.fontFamily }]}>
              {coachInfo?.full_name ?? 'Coach'}
            </Text>
            <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary, fontFamily: theme.typography.fontFamily }]}>
              Teammate
            </Text>
          </View>
        </View>
      </View>

      {/* Messages */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages.slice().reverse()}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.messageList}
          inverted
          onScroll={handleScroll}
          scrollEventThrottle={16}
        />
      )}

      {/* Scroll to bottom button */}
      {showScrollButton && (
        <TouchableOpacity
          style={[styles.scrollButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
          onPress={scrollToBottom}
          activeOpacity={0.8}
        >
          <ArrowDown size={20} color={theme.colors.primary} />
          {firstUnreadIndex !== -1 && (
            <View style={[styles.scrollButtonBadge, { backgroundColor: theme.colors.error ?? '#EF4444' }]}>
              <Text style={styles.scrollButtonBadgeText}>{messages.length - firstUnreadIndex}</Text>
            </View>
          )}
        </TouchableOpacity>
      )}

      {/* Input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ChatInputBar
          onSendText={sendMessage}
          onSendMedia={sendMediaMessage}
          sending={sending}
        />
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: 60,
    borderBottomWidth: 1,
    gap: 12,
  },
  backButton: { marginRight: 4 },
  headerInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerAvatar: { width: 40, height: 40, borderRadius: 20 },
  headerAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatarInitials: { fontSize: 16, fontWeight: '700' },
  headerName: { fontSize: 17, fontWeight: '700' },
  headerSubtitle: { fontSize: 12, marginTop: 1 },

  // Loading
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Message list
  messageList: { padding: 16, gap: 4 },

  // Bubbles
  bubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 4,
  },
  myBubble: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  theirBubble: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  bubbleText: { fontSize: 16, lineHeight: 24 },
  bubbleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 4,
  },
  timestamp: { fontSize: 10 },

  // Unread separator
  unreadSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  unreadLine: { flex: 1, height: 1 },
  unreadBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginHorizontal: 8,
    borderWidth: 1,
  },
  unreadBadgeText: { fontSize: 12, fontWeight: '600' },

  // Scroll button
  scrollButton: {
    position: 'absolute',
    bottom: 80,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 1,
  },
  scrollButtonBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  scrollButtonBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },

  // Input bar
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    alignItems: 'center',
    gap: 12,
  },
  input: {
    flex: 1,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
