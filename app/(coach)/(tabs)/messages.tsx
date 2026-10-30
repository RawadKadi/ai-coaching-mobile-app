import { useBrandColors, useTheme } from '@/contexts/BrandContext';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Image, RefreshControl, StatusBar, TextInput, Pressable, Animated, useWindowDimensions } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { MotiView, AnimatePresence } from 'moti';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ChevronRight, MessageCircle, Users, Zap, Search, Bell, X } from 'lucide-react-native';
import { BrandedAvatar } from '@/components/BrandedAvatar';
import { MessagesListSkeleton } from '@/components/MessagesListSkeleton';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePresence } from '@/contexts/PresenceContext';
import * as Haptics from 'expo-haptics';

type ClientPreview = {
  id: string; user_id: string; full_name: string; avatar_url: string | null;
  last_message?: string; last_message_time?: string; unread_count?: number;
};
type CoachPreview = {
  coach_id: string; user_id: string; full_name: string; avatar_url: string | null;
  last_message?: string; last_message_time?: string; unread_count?: number;
};
type Tab = 'clients' | 'team';

export default function CoachMessagesScreen() {
  const theme = useTheme();
  const colors = theme.colors;
  const isDarkMode = theme.isDarkMode;
  const router = useRouter();
  const { coach, user, loading: authLoading } = useAuth();
  const insets = useSafeAreaInsets();
  const { isUserOnline } = usePresence();
  const [activeTab, setActiveTab] = useState<Tab>('clients');
  const [clients, setClients] = useState<ClientPreview[]>([]);
  const [teammates, setTeammates] = useState<CoachPreview[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [teamLoading, setTeamLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [teamUnreadCount, setTeamUnreadCount] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const clientsRef = useRef(clients);
  clientsRef.current = clients;
  const teammatesRef = useRef(teammates);
  teammatesRef.current = teammates;

  // Handle case where auth finishes without a coach profile
  useEffect(() => {
    if (!authLoading && !coach?.id) {
      setClientsLoading(false);
      setTeamLoading(false);
    }
  }, [authLoading, coach?.id]);

  const { width: windowWidth } = useWindowDimensions();
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const tabAnim = useRef(new Animated.Value(activeTab === 'clients' ? 0 : 1)).current;

  useEffect(() => {
    Animated.spring(tabAnim, {
      toValue: activeTab === 'clients' ? 0 : 1,
      tension: 220,
      friction: 18,
      useNativeDriver: true,
    }).start();
  }, [activeTab]);

  const effectiveContainerWidth = containerWidth || (windowWidth - 48);
  const tabWidth = Math.max(0, (effectiveContainerWidth - 12) / 2);
  const indicatorTranslateX = tabAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, tabWidth],
  });

  const filteredClients = clients.filter(c => c.full_name.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredTeammates = teammates.filter(t => t.full_name.toLowerCase().includes(searchQuery.toLowerCase()));

  const loadClients = useCallback(async (silent = false) => {
    if (!coach?.id) return;
    try {
      if (!silent) setClientsLoading(true);

      // 1. Get all clients with their profiles (1 query)
      const { data: links, error: linksError } = await supabase
        .from('coach_client_links')
        .select(`client_id, clients:client_id(id, user_id, profiles:user_id(full_name, avatar_url))`)
        .eq('coach_id', coach.id)
        .eq('status', 'active');

      if (linksError) {
        console.error('Error loading client links:', linksError);
      }

      if (!links?.length) { 
        setClients([]); 
        return; 
      }

      const clientUserIds = links.map((l: any) => l.clients?.user_id).filter(Boolean);

      if (clientUserIds.length === 0) {
        setClients([]);
        return;
      }

      // 2. Get last message for ALL clients in ONE query, then group in JS
      const { data: allMsgs } = await supabase
        .from('messages')
        .select('content, created_at, sender_id, recipient_id')
        .or(clientUserIds.map((uid: string) => `sender_id.eq.${uid},recipient_id.eq.${uid}`).join(','))
        .order('created_at', { ascending: false });

      // 3. Get unread counts for ALL clients in ONE query
      const { data: unreadData } = await supabase
        .from('messages')
        .select('sender_id')
        .in('sender_id', clientUserIds)
        .eq('recipient_id', user?.id)
        .eq('read', false)
        .eq('ai_generated', false);

      // Build lookup maps in JS (no more per-client round-trips)
      const lastMsgMap: Record<string, any> = {};
      for (const msg of allMsgs || []) {
        const uid = clientUserIds.find((id: string) => id === msg.sender_id || id === msg.recipient_id);
        if (uid && !lastMsgMap[uid]) lastMsgMap[uid] = msg;
      }
      const unreadMap: Record<string, number> = {};
      for (const row of unreadData || []) {
        unreadMap[row.sender_id] = (unreadMap[row.sender_id] || 0) + 1;
      }

      const list: ClientPreview[] = (links || []).map((link: any) => {
        const client = link.clients;
        if (!client?.profiles) return null;
        const lastMsg = lastMsgMap[client.user_id];
        let preview = lastMsg?.content || 'No messages yet';
        try { 
          let p = JSON.parse(preview); 
          if (typeof p === 'string' && p.startsWith('{')) {
            p = JSON.parse(p);
          }
          if (p?.type === 'task_completion') {
            preview = `✅ Task: ${p.taskName || 'Completed'}`;
          } else if (p?.type === 'challenge_completed') {
            preview = `🏆 Challenge: ${p.taskName || 'Completed'}`;
          } else if (p?.type === 'meal' || p?.type === 'meal_log') {
            preview = '🍽️ Meal Log';
          } else if (p?.type === 'image') {
            preview = '🖼 Photo';
          } else if (p?.type === 'video') {
            preview = '🎥 Video';
          } else if (p?.type === 'gif') {
            preview = '🎞 GIF';
          } else if (p?.type === 'document') {
            preview = '📄 ' + (p.fileName || 'Document');
          } else if (p?.type === 'audio') {
            let durStr = '';
            if (p.duration) {
              const d = Math.floor(Number(p.duration));
              if (!isNaN(d)) durStr = ` (${Math.floor(d / 60)}:${(d % 60).toString().padStart(2, '0')})`;
            }
            preview = `🎤 Voice message${durStr}`;
          } else if (p?.type === 'session_invite' || p?.type === 'call_invite') {
            preview = '📹 Session Invitation';
          } else if (p?.type === 'deleted') {
            preview = p.deleted_by === user?.id ? 'You deleted a message' : 'Message deleted';
          } else {
            preview = p?.text || preview; 
          }
        } catch {}
        return { id: client.id, user_id: client.user_id, full_name: client.profiles.full_name, avatar_url: client.profiles.avatar_url, last_message: preview, last_message_time: lastMsg?.created_at, unread_count: unreadMap[client.user_id] || 0 };
      }).filter(Boolean) as ClientPreview[];

      list.sort((a, b) => new Date(b.last_message_time || 0).getTime() - new Date(a.last_message_time || 0).getTime());
      setClients(list);
    } catch (e) { 
      console.error('Error in loadClients:', e); 
    } finally { 
      setClientsLoading(false); 
      setRefreshing(false); 
    }
  }, [coach?.id, user?.id]);

  const loadTeammates = useCallback(async (silent = false) => {
    try {
      if (!silent) setTeamLoading(true);

      // 1. Get team coaches (1 RPC call)
      const { data } = await supabase.rpc('get_team_coaches');
      if (!data?.length) { 
        setTeammates([]); 
        return; 
      }

      const teamUserIds = data.map((tm: any) => tm.user_id).filter(Boolean);

      if (teamUserIds.length === 0) {
        setTeammates([]);
        return;
      }

      // 2. Get last message for ALL teammates in ONE query
      const { data: allMsgs } = await supabase
        .from('messages')
        .select('content, created_at, sender_id, recipient_id')
        .or(teamUserIds.map((uid: string) => `and(sender_id.eq.${user?.id},recipient_id.eq.${uid}),and(sender_id.eq.${uid},recipient_id.eq.${user?.id})`).join(','))
        .order('created_at', { ascending: false });

      // 3. Get unread counts for ALL teammates in ONE query
      const { data: unreadData } = await supabase
        .from('messages')
        .select('sender_id')
        .in('sender_id', teamUserIds)
        .eq('recipient_id', user?.id)
        .eq('read', false)
        .eq('ai_generated', false);

      // Build lookup maps in JS
      const lastMsgMap: Record<string, any> = {};
      for (const msg of allMsgs || []) {
        const uid = teamUserIds.find((id: string) => id === msg.sender_id || id === msg.recipient_id);
        if (uid && !lastMsgMap[uid]) lastMsgMap[uid] = msg;
      }
      const unreadMap: Record<string, number> = {};
      for (const row of unreadData || []) {
        unreadMap[row.sender_id] = (unreadMap[row.sender_id] || 0) + 1;
      }

      const list = data.map((tm: any) => {
        const lastMsg = lastMsgMap[tm.user_id];
        let preview = lastMsg?.content || 'No messages yet';
        try { 
          let p = JSON.parse(preview); 
          if (typeof p === 'string' && p.startsWith('{')) {
            p = JSON.parse(p);
          }
          if (p?.type === 'task_completion') {
            preview = `✅ Task: ${p.taskName || 'Completed'}`;
          } else if (p?.type === 'challenge_completed') {
            preview = `🏆 Challenge: ${p.taskName || 'Completed'}`;
          } else if (p?.type === 'meal' || p?.type === 'meal_log') {
            preview = '🍽️ Meal Log';
          } else if (p?.type === 'image') {
            preview = '🖼 Photo';
          } else if (p?.type === 'video') {
            preview = '🎥 Video';
          } else if (p?.type === 'gif') {
            preview = '🎞 GIF';
          } else if (p?.type === 'document') {
            preview = '📄 ' + (p.fileName || 'Document');
          } else if (p?.type === 'audio') {
            let durStr = '';
            if (p.duration) {
              const d = Math.floor(Number(p.duration));
              if (!isNaN(d)) durStr = ` (${Math.floor(d / 60)}:${(d % 60).toString().padStart(2, '0')})`;
            }
            preview = `🎤 Voice message${durStr}`;
          } else if (p?.type === 'session_invite' || p?.type === 'call_invite') {
            preview = '📹 Session Invitation';
          } else if (p?.type === 'deleted') {
            preview = p.deleted_by === user?.id ? 'You deleted a message' : 'Message deleted';
          } else {
            preview = p?.text || preview; 
          }
        } catch {}
        return { coach_id: tm.coach_id, user_id: tm.user_id, full_name: tm.full_name, avatar_url: tm.avatar_url, last_message: preview, last_message_time: lastMsg?.created_at, unread_count: unreadMap[tm.user_id] || 0 };
      });

      list.sort((a: any, b: any) => new Date(b.last_message_time || 0).getTime() - new Date(a.last_message_time || 0).getTime());
      setTeammates(list);
      setTeamUnreadCount(list.reduce((s: number, t: any) => s + (t.unread_count || 0), 0));
    } catch (e) { 
      console.error('Error in loadTeammates:', e); 
    } finally { 
      setTeamLoading(false); 
      setRefreshing(false);
    }
  }, [user?.id]);

  // Realtime subscription
  useEffect(() => {
    if (!user?.id) return;
    const sub = supabase.channel('coach-messages-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `recipient_id=eq.${user.id}` }, () => { 
        loadClients(true); 
        loadTeammates(true); 
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `sender_id=eq.${user.id}` }, () => { 
        loadClients(true); 
        loadTeammates(true); 
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [user?.id, loadClients, loadTeammates]);

  useFocusEffect(
    useCallback(() => { 
      if (coach?.id) { 
        loadClients(clientsRef.current.length > 0); 
        loadTeammates(teammatesRef.current.length > 0); 
      } 
    }, [coach?.id, loadClients, loadTeammates])
  );

  const isTabLoading = activeTab === 'clients'
    ? (clientsLoading || (authLoading && !coach?.id))
    : (teamLoading || (authLoading && !coach?.id));

  const formatTime = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadClients(true), loadTeammates(true)]);
    } catch (e) {
      console.error('Error refreshing messages:', e);
    } finally {
      setRefreshing(false);
    }
  }, [loadClients, loadTeammates]);
  const renderCard = (fullName: string, avatarUrl: string | null, lastMsg: string | undefined, lastTime: string | undefined, unread: number | undefined, onPress: () => void, index: number, userId: string) => (
    <MotiView
      from={{ opacity: 0, translateY: -24 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 350, delay: index * 70 } as any}
      className="mb-4"
    >
      <TouchableOpacity
        className="flex-row items-center p-5 rounded-[32px] border"
        style={{ backgroundColor: colors.surface, borderColor: colors.border }}
        onPress={onPress}
      >
        <View className="relative mr-4">
          <BrandedAvatar name={fullName} imageUrl={avatarUrl} size={56} />
          <View 
            className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 ${isUserOnline(userId) ? 'bg-emerald-500' : 'bg-slate-400'}`} 
            style={{ borderColor: colors.surface }}
          />
        </View>
        <View className="flex-1 mr-3">
          <View className="flex-row justify-between items-center mb-1">
            <Text className="font-black text-base tracking-tight" style={{ color: colors.text }}>{fullName}</Text>
            <Text className="text-[10px] font-bold uppercase" style={{ color: colors.textSecondary }}>{formatTime(lastTime)}</Text>
          </View>
          <Text className="text-sm font-medium" style={{ color: colors.textSecondary }} numberOfLines={1}>{lastMsg}</Text>
        </View>
        {(unread || 0) > 0 ? (
          <View className="w-6 h-6 rounded-full items-center justify-center shadow-lg" style={{ backgroundColor: colors.primary }}>
            <Text className="text-white text-[10px] font-black">{unread}</Text>
          </View>
        ) : (
          <ChevronRight size={18} color={colors.textSecondary} />
        )}
      </TouchableOpacity>
    </MotiView>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} translucent />
      <View style={{ paddingTop: insets.top }} className="flex-1">
          {/* Header */}
          <View className="px-6 py-8 flex-row justify-between items-end">
            <View>
                <Text className="text-[10px] font-black uppercase tracking-[4px] mb-2" style={{ color: colors.primary }}>Message Center</Text>
                <Text className="text-4xl font-black tracking-tighter" style={{ color: colors.text }}>Messages</Text>
            </View>
            <TouchableOpacity 
              onPress={() => {
                setIsSearching(!isSearching);
                if (isSearching) setSearchQuery('');
              }}
              className="w-12 h-12 rounded-2xl items-center justify-center border"
              style={{ backgroundColor: colors.surface, borderColor: colors.border }}
            >
                {isSearching ? <X size={22} color="#EF4444" /> : <Search size={22} color={colors.textSecondary} />}
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          {isSearching && (
            <View className="px-6 mb-6">
              <View className="flex-row items-center rounded-3xl px-4 py-2 border shadow-sm" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                <Search size={20} color={colors.primary} />
                <TextInput
                  autoFocus
                  placeholder={`Search ${activeTab === 'clients' ? 'clients' : 'team'}...`}
                  placeholderTextColor={colors.textTertiary || '#94A3B8'}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  className="flex-1 text-2xl ml-3 h-10"
                  style={{ color: colors.text }}
                />
              </View>
            </View>
          )}

          {/* Tab Switch */}
          <View className="px-6 mb-8">
            <View 
              onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
              style={{ backgroundColor: colors.surface, borderColor: colors.border }} 
              className="flex-row rounded-[28px] p-1.5 border relative overflow-hidden"
            >
              {/* Sliding Tab Indicator */}
              <Animated.View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: 6,
                  bottom: 6,
                  left: 6,
                  width: tabWidth,
                  borderRadius: 22,
                  backgroundColor: isDarkMode ? '#1E293B' : colors.background || '#FFFFFF',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: isDarkMode ? 0.3 : 0.12,
                  shadowRadius: 8,
                  elevation: 4,
                  transform: [{ translateX: indicatorTranslateX }],
                }}
              />

              <Pressable
                onPress={() => {
                  if (activeTab !== 'clients') {
                    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                    setActiveTab('clients');
                  }
                }}
                className="flex-1 py-4 rounded-[22px] items-center flex-row justify-center gap-3 z-10"
              >
                <Users size={18} color={activeTab === 'clients' ? colors.primary : colors.textSecondary} />
                <Text style={{ color: activeTab === 'clients' ? colors.text : colors.textSecondary }} className="font-black text-sm uppercase tracking-widest">
                  Clients
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  if (activeTab !== 'team') {
                    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                    setActiveTab('team');
                  }
                }}
                className="flex-1 py-4 rounded-[22px] items-center flex-row justify-center gap-3 z-10"
              >
                <Zap size={18} color={activeTab === 'team' ? colors.primary : colors.textSecondary} />
                <Text style={{ color: activeTab === 'team' ? colors.text : colors.textSecondary }} className="font-black text-sm uppercase tracking-widest">
                  Team
                </Text>
                {teamUnreadCount > 0 && activeTab !== 'team' && (
                  <View className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors.primary }} />
                )}
              </Pressable>
            </View>
          </View>

          {/* List */}
          {isTabLoading && !refreshing ? (
            <MessagesListSkeleton />
          ) : (
            <FlatList
              key={activeTab}
              data={(activeTab === 'clients' ? filteredClients : filteredTeammates) as any[]}
              renderItem={({ item, index }) => {
                if ('id' in item) {
                    const c = item as ClientPreview;
                    return renderCard(c.full_name, c.avatar_url, c.last_message, c.last_message_time, c.unread_count, () => router.push({ pathname: '/(coach)/chat/[id]', params: { id: c.id } }), index, c.user_id);
                } else {
                    const tm = item as CoachPreview;
                    return renderCard(tm.full_name, tm.avatar_url, tm.last_message, tm.last_message_time, tm.unread_count, () => router.push({ pathname: '/(coach)/chat/coach/[coachId]', params: { coachId: tm.coach_id, userId: tm.user_id, fullName: tm.full_name, avatarUrl: tm.avatar_url ?? '' } }), index, tm.user_id);
                }
              }}
              keyExtractor={item => 'id' in item ? item.id : item.coach_id}
              contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 140 }}
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
              ListEmptyComponent={
                <View className="mt-20 items-center px-10">
                  <View className="w-24 h-24 rounded-[32px] items-center justify-center border shadow-sm" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                    <MessageCircle size={40} color={colors.textSecondary} />
                  </View>
                  <Text className="font-black text-lg mt-8 text-center" style={{ color: colors.text }}>No messages found</Text>
                  <Text className="text-xs mt-2 text-center leading-5 font-medium" style={{ color: colors.textSecondary }}>
                    {searchQuery.trim()
                      ? `No results for "${searchQuery}"`
                      : activeTab === 'clients'
                        ? 'When you start a chat with a client, it will appear here.'
                        : 'When you start a chat with a team member, it will appear here.'
                    }
                  </Text>
                </View>
              }
            />
          )}
      </View>
    </View>
  );
}
