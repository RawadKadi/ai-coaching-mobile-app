import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Image, RefreshControl, StatusBar, TextInput, Pressable } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { MotiView, AnimatePresence } from 'moti';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ChevronRight, MessageCircle, Users, Zap, Search, Bell, X } from 'lucide-react-native';
import { BrandedAvatar } from '@/components/BrandedAvatar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const router = useRouter();
  const { coach, user } = useAuth();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<Tab>('clients');
  const [clients, setClients] = useState<ClientPreview[]>([]);
  const [teammates, setTeammates] = useState<CoachPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [teamUnreadCount, setTeamUnreadCount] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredClients = clients.filter(c => c.full_name.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredTeammates = teammates.filter(t => t.full_name.toLowerCase().includes(searchQuery.toLowerCase()));

  // Note: Initial data loading is handled by useFocusEffect below

  useEffect(() => {
    if (!user?.id) return;
    const sub = supabase.channel('coach-messages-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `recipient_id=eq.${user.id}` }, () => { loadClients(true); loadTeammates(true); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `sender_id=eq.${user.id}` }, () => { loadClients(true); loadTeammates(true); })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [user?.id]);

  useFocusEffect(useCallback(() => { if (coach) { loadClients(); loadTeammates(); } }, [coach]));

  const loadClients = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);

      // 1. Get all clients with their profiles (1 query)
      const { data: links } = await supabase
        .from('coach_client_links')
        .select(`client_id, clients:client_id(id, user_id, profiles:user_id(full_name, avatar_url))`)
        .eq('coach_id', coach?.id)
        .eq('status', 'active');

      if (!links?.length) { setClients([]); return; }

      const clientUserIds = links.map((l: any) => l.clients?.user_id).filter(Boolean);

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
        .eq('read', false);

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
        try { const p = JSON.parse(preview); preview = p?.text || (p?.type === 'meal_log' ? '🍽️ Meal Log' : p?.type === 'session_invite' ? '🎥 Session Invite' : 'Message'); } catch {}
        return { id: client.id, user_id: client.user_id, full_name: client.profiles.full_name, avatar_url: client.profiles.avatar_url, last_message: preview, last_message_time: lastMsg?.created_at, unread_count: unreadMap[client.user_id] || 0 };
      }).filter(Boolean) as ClientPreview[];

      list.sort((a, b) => new Date(b.last_message_time || 0).getTime() - new Date(a.last_message_time || 0).getTime());
      setClients(list);
    } catch (e) { console.error(e); } finally { setLoading(false); setRefreshing(false); }
  }, [coach?.id, user?.id]);

  const loadTeammates = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);

      // 1. Get team coaches (1 RPC call)
      const { data } = await supabase.rpc('get_team_coaches');
      if (!data?.length) { setTeammates([]); return; }

      const teamUserIds = data.map((tm: any) => tm.user_id).filter(Boolean);

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
        .eq('read', false);

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
        try { const p = JSON.parse(preview); if (p?.text) preview = p.text; } catch {}
        return { coach_id: tm.coach_id, user_id: tm.user_id, full_name: tm.full_name, avatar_url: tm.avatar_url, last_message: preview, last_message_time: lastMsg?.created_at, unread_count: unreadMap[tm.user_id] || 0 };
      });

      list.sort((a: any, b: any) => new Date(b.last_message_time || 0).getTime() - new Date(a.last_message_time || 0).getTime());
      setTeammates(list);
      setTeamUnreadCount(list.reduce((s: number, t: any) => s + (t.unread_count || 0), 0));
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [user?.id]);

  const formatTime = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const onRefresh = () => { setRefreshing(true); loadClients(); loadTeammates(); };

  const renderCard = (fullName: string, avatarUrl: string | null, lastMsg: string | undefined, lastTime: string | undefined, unread: number | undefined, onPress: () => void, index: number) => (
    <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ delay: index * 50 }} className="mb-4">
      <TouchableOpacity
        className="flex-row items-center p-5 bg-slate-900/40 rounded-[32px] border border-white/5"
        onPress={onPress}
      >
        <View className="relative mr-4">
          <BrandedAvatar name={fullName} imageUrl={avatarUrl} size={56} />
          <View className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-500 rounded-full border-2 border-slate-950" />
        </View>
        <View className="flex-1 mr-3">
          <View className="flex-row justify-between items-center mb-1">
            <Text className={`font-black text-base tracking-tight ${unread ? 'text-white' : 'text-slate-300'}`}>{fullName}</Text>
            <Text className="text-slate-600 text-[10px] font-bold uppercase">{formatTime(lastTime)}</Text>
          </View>
          <Text className={`text-sm font-medium ${unread ? 'text-slate-400' : 'text-slate-600'}`} numberOfLines={1}>{lastMsg}</Text>
        </View>
        {(unread || 0) > 0 ? (
          <View className="w-6 h-6 bg-blue-600 rounded-full items-center justify-center shadow-lg shadow-blue-500/40">
            <Text className="text-white text-[10px] font-black">{unread}</Text>
          </View>
        ) : (
          <ChevronRight size={18} color="#334155" />
        )}
      </TouchableOpacity>
    </MotiView>
  );

  return (
    <View style={{ flex: 1 }} className="bg-slate-950">
      <StatusBar barStyle="light-content" translucent />
      <View style={{ paddingTop: insets.top }} className="flex-1">
          {/* Header */}
          <View className="px-6 py-8 flex-row justify-between items-end">
            <View>
                <Text className="text-blue-500 text-[10px] font-black uppercase tracking-[4px] mb-2">Message Center</Text>
                <Text className="text-white text-4xl font-black tracking-tighter">Messages</Text>
            </View>
            <TouchableOpacity 
              onPress={() => {
                setIsSearching(!isSearching);
                if (isSearching) setSearchQuery('');
              }}
              className="w-12 h-12 bg-slate-900 rounded-2xl items-center justify-center border border-white/5"
            >
                {isSearching ? <X size={22} color="#EF4444" /> : <Search size={22} color="#64748B" />}
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          {isSearching && (
            <View className="px-6 mb-6">
              <View className="flex-row items-center bg-slate-900/80 rounded-3xl px-4 py-2 border border-white/10 shadow-2xl">
                <Search size={20} color="#3B82F6" />
                <TextInput
                  autoFocus
                  placeholder={`Search ${activeTab === 'clients' ? 'clients' : 'team'}...`}
                  placeholderTextColor="#475569"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  className="flex-1 text-white text-2xl ml-3 h-10"
                />
              </View>
            </View>
          )}

          {/* Tab Switch */}
          <View className="px-6 mb-8">
            <View className="flex-row bg-slate-900/50 rounded-[28px] p-1.5 border border-white/5">
              <Pressable
                onPress={() => setActiveTab('clients')}
                className={`flex-1 py-4 rounded-[22px] items-center flex-row justify-center gap-3 ${activeTab === 'clients' ? 'bg-slate-800' : ''}`}
                style={activeTab === 'clients' ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 } : {}}
              >
                <Users size={18} color={activeTab === 'clients' ? '#3B82F6' : '#475569'} />
                <Text className={`font-black text-sm uppercase tracking-widest ${activeTab === 'clients' ? 'text-white' : 'text-slate-500'}`}>Clients</Text>
              </Pressable>
              <Pressable
                onPress={() => setActiveTab('team')}
                className={`flex-1 py-4 rounded-[22px] items-center flex-row justify-center gap-3 ${activeTab === 'team' ? 'bg-slate-800' : ''}`}
                style={activeTab === 'team' ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 } : {}}
              >
                <Zap size={18} color={activeTab === 'team' ? '#3B82F6' : '#475569'} />
                <Text className={`font-black text-sm uppercase tracking-widest ${activeTab === 'team' ? 'text-white' : 'text-slate-500'}`}>Team</Text>
                {teamUnreadCount > 0 && activeTab !== 'team' && (
                  <View className="w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-slate-900" />
                )}
              </Pressable>
            </View>
          </View>

          {/* List */}
          {loading && !refreshing ? (
            <View className="flex-1 items-center justify-center"><ActivityIndicator color="#3B82F6" /></View>
          ) : (
            <FlatList
              data={(activeTab === 'clients' ? filteredClients : filteredTeammates) as any[]}
              renderItem={({ item, index }) => {
                if ('id' in item) {
                    const c = item as ClientPreview;
                    return renderCard(c.full_name, c.avatar_url, c.last_message, c.last_message_time, c.unread_count, () => router.push({ pathname: '/(coach)/chat/[id]', params: { id: c.id } }), index);
                } else {
                    const tm = item as CoachPreview;
                    return renderCard(tm.full_name, tm.avatar_url, tm.last_message, tm.last_message_time, tm.unread_count, () => router.push({ pathname: '/(coach)/chat/coach/[coachId]', params: { coachId: tm.coach_id, userId: tm.user_id, fullName: tm.full_name, avatarUrl: tm.avatar_url ?? '' } }), index);
                }
              }}
              keyExtractor={item => 'id' in item ? item.id : item.coach_id}
              contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 140 }}
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" />}
              ListEmptyComponent={
                <View className="mt-20 items-center px-10">
                  <View className="w-24 h-24 bg-slate-900 rounded-[32px] items-center justify-center border border-white/5 shadow-2xl">
                    <MessageCircle size={40} color="#334155" />
                  </View>
                  <Text className="text-white font-black text-lg mt-8 text-center">Your inbox is clear</Text>
                  <Text className="text-slate-500 text-xs mt-2 text-center leading-5 font-medium">When you have active conversations with {activeTab === 'clients' ? 'clients' : 'team members'}, they'll appear here.</Text>
                </View>
              }
            />
          )}
      </View>
    </View>
  );
}
