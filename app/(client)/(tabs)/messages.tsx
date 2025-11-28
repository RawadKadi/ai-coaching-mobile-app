import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, LayoutAnimation, UIManager } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Send, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useFocusEffect } from 'expo-router';

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

export default function MessagesScreen() {
  const { client } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (client) {
      loadMessages();
      const cleanup = subscribeToMessages();
      return cleanup;
    }
  }, [client]);

  // Reload messages when screen comes into focus (fallback if realtime doesn't work)
  useFocusEffect(
    React.useCallback(() => {
      if (client) {
        console.log('[Messages] Screen focused, reloading messages');
        loadMessages();
      }
    }, [client])
  );

  const subscribeToMessages = () => {
    console.log('[Messages] Setting up subscription for user_id:', client?.user_id);
    
    const subscription = supabase
      .channel('client-messages-' + client?.user_id)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `recipient_id=eq.${client?.user_id}`,
        },
        (payload) => {
          console.log('[Messages] Received message:', payload.new);
          setMessages((current) => [...current, payload.new as Message]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `sender_id=eq.${client?.user_id}`,
        },
        (payload) => {
          console.log('[Messages] Sent message:', payload.new);
          // Check if we already have this message (optimistic update might have added it)
          setMessages((current) => {
            if (current.find(m => m.id === payload.new.id)) return current;
            return [...current, payload.new as Message];
          });
        }
      )
      .subscribe((status) => {
        console.log('[Messages] Subscription status:', status);
      });

    return () => {
      console.log('[Messages] Cleaning up subscription');
      supabase.removeChannel(subscription);
    };
  };

  const loadMessages = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${client?.user_id},recipient_id.eq.${client?.user_id}`)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !client) return;

    try {
      setSending(true);
      
      // Get active coach from coach_client_links
      const { data: coachLink, error: linkError } = await supabase
        .from('coach_client_links')
        .select('coach_id')
        .eq('client_id', client.id)
        .eq('status', 'active')
        .single();

      if (linkError || !coachLink) {
        console.error('No active coach found for client:', client.id);
        return;
      }

      const { data: coach } = await supabase
        .from('coaches')
        .select('user_id')
        .eq('id', coachLink.coach_id)
        .single();

      if (!coach) return;

      const message = {
        sender_id: client.user_id,
        recipient_id: coach.user_id,
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
    const isMe = item.sender_id === client?.user_id;
    
    // Check if this is a task completion message
    let isTaskMessage = false;
    try {
      const parsed = JSON.parse(item.content);
      if (parsed && parsed.type === 'task_completion') {
        isTaskMessage = true;
      }
    } catch (e) {
      // Not JSON, render normally
    }

    if (isTaskMessage) {
      return <TaskCompletionMessage content={item.content} isOwn={isMe} />;
    }

    return (
      <View style={[styles.messageContainer, isMe ? styles.myMessage : styles.theirMessage]}>
        <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.theirMessageText]}>
          {item.content}
        </Text>
        <Text style={[styles.timestamp, isMe ? styles.myTimestamp : styles.theirTimestamp]}>
          {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
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
    backgroundColor: '#FFFFFF',
    padding: 24,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 28,
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
