import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, LayoutAnimation, UIManager } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Send, ArrowLeft, ChevronDown, ChevronUp, Check, CheckCheck, ChevronLeft } from 'lucide-react-native';

if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

type Message = {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: string;
  read: boolean;
};

const TaskCompletionMessage = ({ content, isOwn }: { content: any, isOwn: boolean }) => {
  const [expanded, setExpanded] = useState(false);
  const data = typeof content === 'string' ? JSON.parse(content) : content;

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };

  if (!data.isCompletion) {
    // Render undo message differently or as simple text
    return (
      <View style={[styles.messageBubble, isOwn ? styles.sentBubble : styles.receivedBubble]}>
        <Text style={[styles.messageText, isOwn ? styles.sentText : styles.receivedText]}>
          {data.isCompletion === false ? `⚠️ Undid task: ${data.taskName}` : content}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.taskMessageContainer, { alignSelf: isOwn ? 'flex-end' : 'flex-start' }]}>
      <View style={styles.taskHeader}>
        <Text style={styles.taskTitle}>
          {data.clientName} finished this task
        </Text>
      </View>
      
      <View style={styles.taskContent}>
        <Text style={styles.taskName}>{data.taskName}</Text>
        <Text style={styles.taskTime}>Completed at: {new Date(data.timestamp).toLocaleTimeString()}</Text>
        <View style={styles.divider} />
        
        <TouchableOpacity onPress={toggleExpand} style={styles.toggleButton}>
          <Text style={styles.toggleText}>{expanded ? 'Hide Details' : 'View Details'}</Text>
          {expanded ? <ChevronUp size={16} color="#059669" /> : <ChevronDown size={16} color="#059669" />}
        </TouchableOpacity>

        {expanded && (
          <View style={styles.taskDetails}>
            {data.description && (
              <Text style={styles.detailText}>Description: {data.description}</Text>
            )}
            {data.imageUrl && (
              <Text style={styles.detailText}>Image attached (View in logs)</Text>
            )}
          </View>
        )}
      </View>
    </View>
  );
};

export default function CoachChatScreen() {
  const { id } = useLocalSearchParams(); // client id
  const router = useRouter();
  const { profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [clientProfile, setClientProfile] = useState<any>(null);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (profile && id) {
      loadChatData();
    }
  }, [profile, id]);

  const loadChatData = async () => {
    try {
      setLoading(true);

      // 1. Get client's profile info
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('user_id, profiles:user_id(full_name)')
        .eq('id', id)
        .single();

      if (clientError) throw clientError;
      setClientProfile(clientData);

      const clientUserId = clientData.user_id;

      // 2. Load messages
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${profile?.id},recipient_id.eq.${clientUserId}),and(sender_id.eq.${clientUserId},recipient_id.eq.${profile?.id})`)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);

      // 3. Subscribe to new messages
      const channel = supabase
        .channel(`chat:${id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `recipient_id=eq.${profile?.id}`, 
            // Ideally filter by sender too, but RLS handles security. 
            // We'll filter in callback to be sure it's from this client.
          },
          (payload) => {
            if (payload.new.sender_id === clientUserId) {
              setMessages((current) => [...current, payload.new as Message]);
              // Mark as read
              markAsRead(payload.new.id);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };

    } catch (error) {
      console.error('Error loading chat:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (messageId: string) => {
    await supabase.from('messages').update({ read: true }).eq('id', messageId);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !profile || !clientProfile) return;

    try {
      setSending(true);

      const message = {
        sender_id: profile.id,
        recipient_id: clientProfile.user_id,
        content: newMessage.trim(),
        read: false,
        ai_generated: false,
      };

      const { data, error } = await supabase
        .from('messages')
        .insert(message)
        .select()
        .single();

      if (error) throw error;

      setMessages([...messages, data]);
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isOwn = item.sender_id === profile?.id;
    
    let isTaskMessage = false;
    try {
      const parsed = JSON.parse(item.content);
      if (parsed && parsed.type === 'task_completion') {
        isTaskMessage = true;
      }
    } catch (e) {
      // Not JSON
    }

    if (isTaskMessage) {
      return <TaskCompletionMessage content={item.content} isOwn={isOwn} />;
    }

    return (
      <View
        style={[
          styles.messageBubble,
          isOwn ? styles.sentBubble : styles.receivedBubble,
        ]}
      >
        <Text style={[styles.messageText, isOwn ? styles.sentText : styles.receivedText]}>
          {item.content}
        </Text>
        <View style={styles.messageFooter}>
          <Text style={[styles.timestamp, isOwn ? styles.sentTimestamp : styles.receivedTimestamp]}>
            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
          {isOwn && (
            item.read ? <CheckCheck size={12} color="#E0E7FF" /> : <Check size={12} color="#E0E7FF" />
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>
          {clientProfile?.profiles?.full_name || 'Chat'}
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        style={styles.inputContainer}
      >
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          value={newMessage}
          onChangeText={setNewMessage}
          multiline
        />
        <TouchableOpacity 
          style={[styles.sendButton, !newMessage.trim() && styles.sendButtonDisabled]} 
          onPress={sendMessage}
          disabled={!newMessage.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Send size={20} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 24,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageList: {
    padding: 16,
    gap: 12,
  },
  messageContainer: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 4,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#3B82F6',
    borderBottomRightRadius: 4,
  },
  theirMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 24,
  },
  myMessageText: {
    color: '#FFFFFF',
  },
  theirMessageText: {
    color: '#111827',
  },
  timestamp: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  myTimestamp: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  theirTimestamp: {
    color: '#9CA3AF',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    alignItems: 'center',
    gap: 12,
  },
  input: {
    flex: 1,
    backgroundColor: '#F3F4F6',
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
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#93C5FD',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 4,
  },
  sentBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#3B82F6',
    borderBottomRightRadius: 4,
  },
  receivedBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sentText: {
    color: '#FFFFFF',
  },
  receivedText: {
    color: '#111827',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 4,
  },
  sentTimestamp: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  receivedTimestamp: {
    color: '#9CA3AF',
  },
  taskMessageContainer: {
    maxWidth: '90%',
    marginVertical: 4,
    backgroundColor: '#ECFDF5', // Light green
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#10B981', // Green border
    overflow: 'hidden',
  },
  taskHeader: {
    padding: 12,
    backgroundColor: '#D1FAE5',
    borderBottomWidth: 1,
    borderBottomColor: '#10B981',
  },
  taskTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#065F46',
  },
  taskContent: {
    padding: 12,
  },
  taskName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#064E3B',
    marginBottom: 4,
  },
  taskTime: {
    fontSize: 12,
    color: '#047857',
    marginBottom: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#10B981',
    opacity: 0.3,
    marginBottom: 8,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleText: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '500',
  },
  taskDetails: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(16, 185, 129, 0.2)',
  },
  detailText: {
    fontSize: 12,
    color: '#047857',
    marginBottom: 4,
  },
});
