import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ChevronRight, MessageCircle } from 'lucide-react-native';

type ClientPreview = {
  id: string; // client id
  user_id: string; // profile id
  full_name: string;
  avatar_url: string | null;
  last_message?: string;
  last_message_time?: string;
  unread_count?: number;
};

export default function CoachMessagesScreen() {
  const router = useRouter();
  const { coach, user } = useAuth();
  const [clients, setClients] = useState<ClientPreview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (coach) {
      loadClients();
    }
  }, [coach]);

  // Reload when screen comes into focus to update unread counts
  useFocusEffect(
    React.useCallback(() => {
      if (coach) {
        loadClients();
      }
    }, [coach])
  );

  const loadClients = async () => {
    try {
      setLoading(true);
      
      // 1. Get all active clients for this coach
      const { data: links, error: linksError } = await supabase
        .from('coach_client_links')
        .select(`
          client_id,
          clients:client_id (
            id,
            user_id,
            profiles:user_id (
              full_name,
              avatar_url
            )
          )
        `)
        .eq('coach_id', coach?.id)
        .eq('status', 'active');

      if (linksError) throw linksError;

      // 2. For each client, get the last message
      // This is a bit N+1, but okay for small number of clients
      const clientsWithMessages = await Promise.all(
        (links || []).map(async (link: any) => {
          const client = link.clients;
          
          // Guard against missing client data (e.g. RLS restriction)
          if (!client || !client.profiles) {
            console.warn('Missing client data for link:', link);
            return null;
          }
          
          const profile = client.profiles;
          
          // Get last message between coach and this client
          const { data: lastMsg } = await supabase
            .from('messages')
            .select('content, created_at, read, sender_id')
            .or(`sender_id.eq.${client.user_id},recipient_id.eq.${client.user_id}`)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          // Get unread count (messages from client to THIS coach that are unread)
          const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('sender_id', client.user_id)
            .eq('recipient_id', user?.id)
            .eq('read', false);

          // Parse content if it's JSON for the preview
          let displayContent = lastMsg?.content || 'No messages yet';
          try {
            const parsed = JSON.parse(displayContent);
            if (parsed && parsed.text) {
              displayContent = parsed.text;
            } else if (parsed && parsed.type === 'reschedule_proposal') {
              displayContent = '📅 Reschedule Proposal';
            } else if (parsed && parsed.type === 'session_invite') {
              displayContent = '🎥 Session Invite';
            } else if (parsed && parsed.type === 'meal_log') {
              displayContent = '🍽️ Meal Log';
            }
          } catch (e) {
            // Not JSON, use as is
          }

          return {
            id: client.id,
            user_id: client.user_id,
            full_name: profile.full_name,
            avatar_url: profile.avatar_url,
            last_message: displayContent,
            last_message_time: lastMsg?.created_at,
            unread_count: count || 0,
          };
        })
      );

      // Filter out nulls and sort
      const validClients = clientsWithMessages.filter((c): c is ClientPreview => c !== null);

      // Sort by last message time
      validClients.sort((a, b) => {
        if (!a.last_message_time) return 1;
        if (!b.last_message_time) return -1;
        return new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime();
      });

      setClients(validClients);
    } catch (error) {
      console.error('Error loading clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderClient = ({ item }: { item: ClientPreview }) => (
    <TouchableOpacity 
      style={styles.clientCard}
      onPress={() => router.push(`/(coach)/chat/${item.id}`)}
    >
      <View style={styles.avatarContainer}>
        {item.avatar_url ? (
          <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitials}>
              {item.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
            </Text>
          </View>
        )}
      </View>
      
      <View style={styles.clientInfo}>
        <View style={styles.nameRow}>
          <Text style={styles.clientName}>{item.full_name}</Text>
          {item.last_message_time && (
            <Text style={styles.timeText}>
              {new Date(item.last_message_time).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </Text>
          )}
        </View>
        
        <View style={styles.messageRow}>
          <Text style={[styles.lastMessage, item.unread_count ? styles.unreadMessage : null]} numberOfLines={1}>
            {item.last_message || 'No messages yet'}
          </Text>
          {item.unread_count ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.unread_count}</Text>
            </View>
          ) : null}
        </View>
      </View>
      
      <ChevronRight size={20} color="#9CA3AF" />
    </TouchableOpacity>
  );

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
          data={clients}
          renderItem={renderClient}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MessageCircle size={48} color="#D1D5DB" />
              <Text style={styles.emptyText}>No active clients found</Text>
            </View>
          }
        />
      )}
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
  list: {
    padding: 16,
  },
  clientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E0E7FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3730A3',
  },
  clientInfo: {
    flex: 1,
    marginRight: 12,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  clientName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  timeText: {
    fontSize: 12,
    color: '#6B7280',
  },
  messageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    fontSize: 14,
    color: '#6B7280',
    flex: 1,
    marginRight: 8,
  },
  unreadMessage: {
    color: '#111827',
    fontWeight: '600',
  },
  badge: {
    backgroundColor: '#3B82F6',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: '#9CA3AF',
  },
});
