import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/BrandContext';
import { supabase } from '@/lib/supabase';
import { ChevronRight, MessageCircle, Users } from 'lucide-react-native';

type ClientPreview = {
  id: string;
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  last_message?: string;
  last_message_time?: string;
  unread_count?: number;
};

type CoachPreview = {
  coach_id: string;
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  last_message?: string;
  last_message_time?: string;
  unread_count?: number;
};

type Tab = 'clients' | 'team';

export default function CoachMessagesScreen() {
  const router = useRouter();
  const { coach, user } = useAuth();
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState<Tab>('clients');
  const [clients, setClients] = useState<ClientPreview[]>([]);
  const [teammates, setTeammates] = useState<CoachPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [teamLoading, setTeamLoading] = useState(true);
  const [teamUnreadCount, setTeamUnreadCount] = useState(0);

  useEffect(() => {
    if (coach) {
      loadClients();
      loadTeammates();
    }
  }, [coach]);

  // Real-time: refresh both lists on any message change
  useEffect(() => {
    if (!user?.id) return;
    const subscription = supabase
      .channel('coach-messages-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `recipient_id=eq.${user.id}` }, () => {
        loadClients(true);
        loadTeammates(true);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `sender_id=eq.${user.id}` }, () => {
        loadClients(true);
        loadTeammates(true);
      })
      .subscribe();
    return () => { supabase.removeChannel(subscription); };
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      if (coach) {
        loadClients();
        loadTeammates();
      }
    }, [coach])
  );

  // ─── Client list ───────────────────────────────────────────────────────────

  const loadClients = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
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

      const clientsWithMessages = await Promise.all(
        (links || []).map(async (link: any) => {
          const client = link.clients;
          if (!client || !client.profiles) return null;
          const profile = client.profiles;

          const { data: lastMsg } = await supabase
            .from('messages')
            .select('content, created_at, read, sender_id')
            .or(`sender_id.eq.${client.user_id},recipient_id.eq.${client.user_id}`)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('sender_id', client.user_id)
            .eq('recipient_id', user?.id)
            .eq('read', false);

          let displayContent = lastMsg?.content || 'No messages yet';
          try {
            const parsed = JSON.parse(displayContent);
            if (parsed?.text) displayContent = parsed.text;
            else if (parsed?.type === 'reschedule_proposal') displayContent = '📅 Reschedule Proposal';
            else if (parsed?.type === 'session_invite') displayContent = '🎥 Session Invite';
            else if (parsed?.type === 'meal_log') displayContent = '🍽️ Meal Log';
          } catch { /* not JSON */ }

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

      const valid: ClientPreview[] = clientsWithMessages.filter(c => c !== null) as ClientPreview[];
      valid.sort((a, b) => {
        if (!a.last_message_time) return 1;
        if (!b.last_message_time) return -1;
        return new Date(b.last_message_time!).getTime() - new Date(a.last_message_time!).getTime();
      });
      setClients(valid);
    } catch (error) {
      console.error('Error loading clients:', error);
    } finally {
      setLoading(false);
    }
  };

  // ─── Team / Coach list ─────────────────────────────────────────────────────

  const loadTeammates = async (silent = false) => {
    try {
      if (!silent) setTeamLoading(true);

      // get_team_coaches() runs as SECURITY DEFINER — bypasses RLS exactly like get_sub_coaches().
      // Returns: coach_id, user_id, full_name, avatar_url for each teammate.
      const { data: teamData, error } = await supabase.rpc('get_team_coaches');
      if (error) throw error;

      const teamWithMessages = await Promise.all(
        (teamData || []).map(async (tm: any) => {
          const { data: lastMsg } = await supabase
            .from('messages')
            .select('content, created_at, read, sender_id')
            .or(
              `and(sender_id.eq.${user?.id},recipient_id.eq.${tm.user_id}),` +
              `and(sender_id.eq.${tm.user_id},recipient_id.eq.${user?.id})`
            )
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('sender_id', tm.user_id)
            .eq('recipient_id', user?.id)
            .eq('read', false);

          let displayContent = lastMsg?.content || 'No messages yet';
          try {
            const parsed = JSON.parse(displayContent);
            if (parsed?.text) displayContent = parsed.text;
          } catch { /* not JSON */ }

          return {
            coach_id: tm.coach_id,
            user_id: tm.user_id,
            full_name: tm.full_name,
            avatar_url: tm.avatar_url,
            last_message: displayContent,
            last_message_time: lastMsg?.created_at,
            unread_count: count || 0,
          };
        })
      );

      teamWithMessages.sort((a, b) => {
        if (!a.last_message_time) return 1;
        if (!b.last_message_time) return -1;
        return new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime();
      });

      setTeammates(teamWithMessages);
      setTeamUnreadCount(teamWithMessages.reduce((sum, tm) => sum + (tm.unread_count || 0), 0));
    } catch (error) {
      console.error('Error loading teammates:', error);
    } finally {
      setTeamLoading(false);
    }
  };

  // ─── Shared helpers ────────────────────────────────────────────────────────

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  const formatTime = (isoStr?: string) => {
    if (!isoStr) return '';
    return new Date(isoStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  // ─── Renderers ─────────────────────────────────────────────────────────────

  const renderClientCard = ({ item }: { item: ClientPreview }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
      onPress={() => router.push({ pathname: '/(coach)/(tabs)/chat/[id]', params: { id: item.id } })}
    >
      <View style={styles.avatarContainer}>
        {item.avatar_url ? (
          <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatarPlaceholder, { backgroundColor: theme.colors.surfaceAlt }]}>
            <Text style={[styles.avatarInitials, { color: theme.colors.primary, fontFamily: theme.typography.fontFamily }]}>
              {getInitials(item.full_name)}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.cardInfo}>
        <View style={styles.nameRow}>
          <Text style={[styles.cardName, { color: theme.colors.text, fontFamily: theme.typography.fontFamily }]}>
            {item.full_name}
          </Text>
          <Text style={[styles.timeText, { color: theme.colors.textSecondary, fontFamily: theme.typography.fontFamily }]}>
            {formatTime(item.last_message_time)}
          </Text>
        </View>
        <View style={styles.messageRow}>
          <Text
            style={[
              styles.lastMessage,
              { color: theme.colors.textSecondary, fontFamily: theme.typography.fontFamily },
              item.unread_count ? { color: theme.colors.text, fontWeight: '600' } : null,
            ]}
            numberOfLines={1}
          >
            {item.last_message || 'No messages yet'}
          </Text>
          {!!item.unread_count && (
            <View style={[styles.badge, { backgroundColor: theme.colors.primary }]}>
              <Text style={styles.badgeText}>{item.unread_count}</Text>
            </View>
          )}
        </View>
      </View>
      <ChevronRight size={20} color={theme.colors.textSecondary} />
    </TouchableOpacity>
  );

  const renderTeamCard = ({ item }: { item: CoachPreview }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
      onPress={() =>
        router.push({
          pathname: '/(coach)/(tabs)/chat/coach/[coachId]',
          params: {
            coachId: item.coach_id,
            userId: item.user_id,
            fullName: item.full_name,
            avatarUrl: item.avatar_url ?? '',
          },
        })
      }
    >
      <View style={styles.avatarContainer}>
        {item.avatar_url ? (
          <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatarPlaceholder, { backgroundColor: theme.colors.surfaceAlt }]}>
            <Text style={[styles.avatarInitials, { color: theme.colors.primary, fontFamily: theme.typography.fontFamily }]}>
              {getInitials(item.full_name)}
            </Text>
          </View>
        )}
        <View style={[styles.coachDot, { backgroundColor: theme.colors.primary }]} />
      </View>
      <View style={styles.cardInfo}>
        <View style={styles.nameRow}>
          <Text style={[styles.cardName, { color: theme.colors.text, fontFamily: theme.typography.fontFamily }]}>
            {item.full_name}
          </Text>
          <Text style={[styles.timeText, { color: theme.colors.textSecondary, fontFamily: theme.typography.fontFamily }]}>
            {formatTime(item.last_message_time)}
          </Text>
        </View>
        <View style={styles.messageRow}>
          <Text
            style={[
              styles.lastMessage,
              { color: theme.colors.textSecondary, fontFamily: theme.typography.fontFamily },
              item.unread_count ? { color: theme.colors.text, fontWeight: '600' } : null,
            ]}
            numberOfLines={1}
          >
            {item.last_message || 'No messages yet'}
          </Text>
          {!!item.unread_count && (
            <View style={[styles.badge, { backgroundColor: theme.colors.primary }]}>
              <Text style={styles.badgeText}>{item.unread_count}</Text>
            </View>
          )}
        </View>
      </View>
      <ChevronRight size={20} color={theme.colors.textSecondary} />
    </TouchableOpacity>
  );

  const isLoading = activeTab === 'clients' ? loading : teamLoading;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <Text style={[styles.title, { color: theme.colors.text, fontFamily: theme.typography.fontFamily }]}>
          Messages
        </Text>
      </View>

      {/* Segmented control */}
      <View style={[styles.segmentedWrapper, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <View style={[styles.segmentedControl, { backgroundColor: theme.colors.surfaceAlt }]}>
          <TouchableOpacity
            style={[
              styles.segment,
              activeTab === 'clients' && [styles.segmentActive, { backgroundColor: theme.colors.surface }],
            ]}
            onPress={() => setActiveTab('clients')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.segmentText,
                { color: activeTab === 'clients' ? theme.colors.primary : theme.colors.textSecondary },
                { fontFamily: theme.typography.fontFamily },
              ]}
            >
              Clients
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.segment,
              activeTab === 'team' && [styles.segmentActive, { backgroundColor: theme.colors.surface }],
            ]}
            onPress={() => setActiveTab('team')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.segmentText,
                { color: activeTab === 'team' ? theme.colors.primary : theme.colors.textSecondary },
                { fontFamily: theme.typography.fontFamily },
              ]}
            >
              Team
            </Text>
            {teamUnreadCount > 0 && activeTab !== 'team' && (
              <View style={[styles.tabDot, { backgroundColor: theme.colors.error ?? '#EF4444' }]} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : activeTab === 'clients' ? (
        <FlatList
          data={clients}
          renderItem={renderClientCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MessageCircle size={48} color={theme.colors.border} />
              <Text style={[styles.emptyText, { color: theme.colors.textSecondary, fontFamily: theme.typography.fontFamily }]}>
                No active clients found
              </Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={teammates}
          renderItem={renderTeamCard}
          keyExtractor={(item) => item.coach_id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Users size={48} color={theme.colors.border} />
              <Text style={[styles.emptyText, { color: theme.colors.textSecondary, fontFamily: theme.typography.fontFamily }]}>
                No teammates yet
              </Text>
              <Text style={[styles.emptySubText, { color: theme.colors.textSecondary, fontFamily: theme.typography.fontFamily }]}>
                Coaches in your team will appear here
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    padding: 24,
    paddingTop: 60,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  segmentedWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  segmentActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
  },
  tabDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginLeft: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: { padding: 16 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  avatarContainer: {
    marginRight: 12,
    position: 'relative',
  },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: { fontSize: 18, fontWeight: '600' },
  coachDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  cardInfo: {
    flex: 1,
    marginRight: 12,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardName: { fontSize: 16, fontWeight: '600' },
  timeText: { fontSize: 12 },
  messageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    fontSize: 14,
    flex: 1,
    marginRight: 8,
  },
  badge: {
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: { marginTop: 12, fontSize: 16 },
  emptySubText: { marginTop: 4, fontSize: 14, textAlign: 'center' },
});
