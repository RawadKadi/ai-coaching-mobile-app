import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Image, SafeAreaView, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { MotiView, AnimatePresence } from 'moti';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ChevronRight, MessageCircle, Users, Zap } from 'lucide-react-native';
import { BrandedAvatar } from '@/components/BrandedAvatar';

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
  const [activeTab, setActiveTab] = useState<Tab>('clients');
  const [clients, setClients] = useState<ClientPreview[]>([]);
  const [teammates, setTeammates] = useState<CoachPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [teamUnreadCount, setTeamUnreadCount] = useState(0);

  useEffect(() => {
    if (coach) { loadClients(); loadTeammates(); }
  }, [coach]);

  useEffect(() => {
    if (!user?.id) return;
    const sub = supabase.channel('coach-messages-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `recipient_id=eq.${user.id}` }, () => { loadClients(true); loadTeammates(true); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `sender_id=eq.${user.id}` }, () => { loadClients(true); loadTeammates(true); })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [user?.id]);

  useFocusEffect(useCallback(() => { if (coach) { loadClients(); loadTeammates(); } }, [coach]));

  const loadClients = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const { data: links } = await supabase.from('coach_client_links').select(`client_id, clients:client_id(id, user_id, profiles:user_id(full_name, avatar_url))`).eq('coach_id', coach?.id).eq('status', 'active');
      const list = await Promise.all((links || []).map(async (link: any) => {
        const client = link.clients;
        if (!client?.profiles) return null;
        const { data: lastMsg } = await supabase.from('messages').select('content, created_at').or(`sender_id.eq.${client.user_id},recipient_id.eq.${client.user_id}`).order('created_at', { ascending: false }).limit(1).single();
        const { count } = await supabase.from('messages').select('*', { count: 'exact', head: true }).eq('sender_id', client.user_id).eq('recipient_id', user?.id).eq('read', false);
        let preview = lastMsg?.content || 'No messages yet';
        try { const p = JSON.parse(preview); preview = p?.text || (p?.type === 'meal_log' ? '🍽️ Meal Log' : p?.type === 'session_invite' ? '🎥 Session Invite' : 'Message'); } catch {}
        return { id: client.id, user_id: client.user_id, full_name: client.profiles.full_name, avatar_url: client.profiles.avatar_url, last_message: preview, last_message_time: lastMsg?.created_at, unread_count: count || 0 };
      }));
      const valid = (list.filter(Boolean) as ClientPreview[]).sort((a, b) => new Date(b.last_message_time || 0).getTime() - new Date(a.last_message_time || 0).getTime());
      setClients(valid);
    } catch (e) { console.error(e); } finally { setLoading(false); setRefreshing(false); }
  };

  const loadTeammates = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const { data } = await supabase.rpc('get_team_coaches');
      const list = await Promise.all((data || []).map(async (tm: any) => {
        const { data: lastMsg } = await supabase.from('messages').select('content, created_at').or(`and(sender_id.eq.${user?.id},recipient_id.eq.${tm.user_id}),and(sender_id.eq.${tm.user_id},recipient_id.eq.${user?.id})`).order('created_at', { ascending: false }).limit(1).single();
        const { count } = await supabase.from('messages').select('*', { count: 'exact', head: true }).eq('sender_id', tm.user_id).eq('recipient_id', user?.id).eq('read', false);
        let preview = lastMsg?.content || 'No messages yet';
        try { const p = JSON.parse(preview); if (p?.text) preview = p.text; } catch {}
        return { coach_id: tm.coach_id, user_id: tm.user_id, full_name: tm.full_name, avatar_url: tm.avatar_url, last_message: preview, last_message_time: lastMsg?.created_at, unread_count: count || 0 };
      }));
      list.sort((a, b) => new Date(b.last_message_time || 0).getTime() - new Date(a.last_message_time || 0).getTime());
      setTeammates(list);
      setTeamUnreadCount(list.reduce((s, t) => s + (t.unread_count || 0), 0));
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const formatTime = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const onRefresh = () => { setRefreshing(true); loadClients(); loadTeammates(); };

  const renderClientCard = ({ item, index }: { item: ClientPreview; index: number }) => (
    <MotiView from={{ opacity: 0, translateX: -10 }} animate={{ opacity: 1, translateX: 0 }} transition={{ delay: index * 40 }} className="mb-3">
      <TouchableOpacity
        className="flex-row items-center p-4 bg-slate-900/40 rounded-[28px] border border-slate-900"
        onPress={() => router.push({ pathname: '/(coach)/(tabs)/chat/[id]', params: { id: item.id } })}
      >
        <View className="relative mr-4">
          <BrandedAvatar name={item.full_name} imageUrl={item.avatar_url} size={52} />
          <View className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-slate-950" />
        </View>
        <View className="flex-1 mr-3">
          <View className="flex-row justify-between items-center mb-1">
            <Text className={`font-black text-base ${item.unread_count ? 'text-white' : 'text-slate-300'}`}>{item.full_name}</Text>
            <Text className="text-slate-600 text-[10px] font-bold">{formatTime(item.last_message_time)}</Text>
          </View>
          <Text className={`text-xs font-bold ${item.unread_count ? 'text-slate-400' : 'text-slate-600'}`} numberOfLines={1}>{item.last_message}</Text>
        </View>
        {(item.unread_count || 0) > 0 ? (
          <View className="w-6 h-6 bg-blue-600 rounded-full items-center justify-center">
            <Text className="text-white text-[10px] font-black">{item.unread_count}</Text>
          </View>
        ) : (
          <ChevronRight size={18} color="#334155" />
        )}
      </TouchableOpacity>
    </MotiView>
  );

  const renderTeamCard = ({ item, index }: { item: CoachPreview; index: number }) => (
    <MotiView from={{ opacity: 0, translateX: -10 }} animate={{ opacity: 1, translateX: 0 }} transition={{ delay: index * 40 }} className="mb-3">
      <TouchableOpacity
        className="flex-row items-center p-4 bg-slate-900/40 rounded-[28px] border border-slate-900"
        onPress={() => router.push({ pathname: '/(coach)/(tabs)/chat/coach/[coachId]', params: { coachId: item.coach_id, userId: item.user_id, fullName: item.full_name, avatarUrl: item.avatar_url ?? '' } })}
      >
        <View className="relative mr-4">
          <BrandedAvatar name={item.full_name} imageUrl={item.avatar_url} size={52} />
          <View className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-blue-500 rounded-full border-2 border-slate-950" />
        </View>
        <View className="flex-1 mr-3">
          <View className="flex-row justify-between items-center mb-1">
            <Text className={`font-black text-base ${item.unread_count ? 'text-white' : 'text-slate-300'}`}>{item.full_name}</Text>
            <Text className="text-slate-600 text-[10px] font-bold">{formatTime(item.last_message_time)}</Text>
          </View>
          <Text className={`text-xs font-bold ${item.unread_count ? 'text-slate-400' : 'text-slate-600'}`} numberOfLines={1}>{item.last_message}</Text>
        </View>
        {(item.unread_count || 0) > 0 ? (
          <View className="w-6 h-6 bg-blue-600 rounded-full items-center justify-center">
            <Text className="text-white text-[10px] font-black">{item.unread_count}</Text>
          </View>
        ) : (
          <ChevronRight size={18} color="#334155" />
        )}
      </TouchableOpacity>
    </MotiView>
  );

  return (
    <View style={{ flex: 1 }} className="bg-slate-950">
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
          {/* Header */}
          <View className="px-6 pt-10 pb-4">
            <Text className="text-blue-500 text-[10px] font-black uppercase tracking-[4px] mb-1">Comms Hub</Text>
            <Text className="text-white text-3xl font-black">Messages</Text>
          </View>

          {/* Tab Switch */}
          <View className="px-6 mb-6">
            <View className="flex-row bg-slate-900/50 rounded-2xl p-1 border border-slate-900">
              <TouchableOpacity
                onPress={() => setActiveTab('clients')}
                className={`flex-1 py-3 rounded-xl items-center flex-row justify-center gap-2 ${activeTab === 'clients' ? 'bg-slate-800 shadow-sm' : ''}`}
              >
                <Users size={16} color={activeTab === 'clients' ? '#3B82F6' : '#475569'} />
                <Text className={`font-black text-sm ${activeTab === 'clients' ? 'text-white' : 'text-slate-600'}`}>Units</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setActiveTab('team')}
                className={`flex-1 py-3 rounded-xl items-center flex-row justify-center gap-2 ${activeTab === 'team' ? 'bg-slate-800 shadow-sm' : ''}`}
              >
                <Zap size={16} color={activeTab === 'team' ? '#3B82F6' : '#475569'} />
                <Text className={`font-black text-sm ${activeTab === 'team' ? 'text-white' : 'text-slate-600'}`}>Command</Text>
                {teamUnreadCount > 0 && activeTab !== 'team' && (
                  <View className="w-2 h-2 bg-red-500 rounded-full" />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* List */}
          {loading && !refreshing ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator color="#3B82F6" />
            </View>
          ) : (
            <FlatList
              data={activeTab === 'clients' ? clients : teammates}
              renderItem={activeTab === 'clients' ? renderClientCard : renderTeamCard}
              keyExtractor={item => 'id' in item ? item.id : item.coach_id}
              contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 120 }}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" />}
              ListEmptyComponent={
                <View className="mt-20 items-center">
                  <View className="w-24 h-24 bg-slate-900/50 rounded-full items-center justify-center border border-slate-900">
                    {activeTab === 'clients' ? <MessageCircle size={40} color="#1E293B" /> : <Users size={40} color="#1E293B" />}
                  </View>
                  <Text className="text-slate-700 font-black text-xs uppercase tracking-widest mt-6">
                    {activeTab === 'clients' ? 'No active comms' : 'No command links'}
                  </Text>
                </View>
              }
            />
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}
