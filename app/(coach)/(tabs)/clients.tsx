import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, SafeAreaView } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { MotiView, AnimatePresence } from 'moti';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Search, ChevronRight, Users, MessageSquare, Activity, UserPlus, Zap } from 'lucide-react-native';
import { BrandedAvatar } from '@/components/BrandedAvatar';

interface ClientWithProfile {
  id: string;
  goal?: string;
  experience_level?: string;
  profiles: { full_name: string; avatar_url?: string | null };
}

export default function ClientsScreen() {
  const router = useRouter();
  const { coach } = useAuth();
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<ClientWithProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (coach) {
      loadClients();
      const sub = supabase.channel('coach_client_links_changes')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'coach_client_links', filter: `coach_id=eq.${coach.id}` }, () => loadClients())
        .subscribe();
      return () => { sub.unsubscribe(); };
    } else { setLoading(false); }
  }, [coach]);

  useFocusEffect(useCallback(() => { if (coach) loadClients(); }, [coach]));

  const loadClients = async () => {
    if (!coach) return;
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_my_clients');
      if (error) throw error;
      setClients(data?.map((item: any) => ({
        id: item.client_id,
        goal: item.client_goal,
        experience_level: item.client_experience,
        profiles: { full_name: item.client_name, avatar_url: item.client_avatar }
      })) || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const filtered = clients.filter(c => c.profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()));

  if (loading) return <View className="flex-1 bg-slate-950 justify-center items-center"><ActivityIndicator color="#3B82F6" /></View>;

  return (
    <View style={{ flex: 1 }} className="bg-slate-950">
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
          {/* Header */}
          <View className="px-6 pt-10 pb-6 flex-row justify-between items-center">
            <View>
              <Text className="text-blue-500 text-[10px] font-black uppercase tracking-[4px] mb-1">Unit Registry</Text>
              <View className="flex-row items-center gap-3">
                <Text className="text-white text-3xl font-black">Clients</Text>
                <View className="bg-blue-600/10 border border-blue-600/20 px-3 py-1 rounded-full">
                  <Text className="text-blue-500 font-black text-xs">{clients.length} Active</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity
              className="w-14 h-14 bg-blue-600 rounded-[20px] items-center justify-center shadow-lg shadow-blue-500/30 border border-white/10"
              onPress={() => router.push('/(coach)/invite-client')}
            >
              <UserPlus size={22} color="white" />
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View className="px-6 mb-6">
            <View className="flex-row items-center bg-slate-900/50 border-2 border-slate-900 rounded-[24px] px-5 py-4">
              <Search size={18} color="#475569" />
              <TextInput
                className="flex-1 ml-3 text-white font-bold text-base"
                placeholder="Search unit database..."
                placeholderTextColor="#1E293B"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
          </View>

          <ScrollView className="flex-1 px-6" contentContainerStyle={{ paddingBottom: 120 }}>
            <AnimatePresence>
              {filtered.length === 0 ? (
                <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-20 items-center">
                  <View className="w-24 h-24 bg-slate-900/50 rounded-full items-center justify-center border border-slate-900">
                    <Users size={40} color="#1E293B" />
                  </View>
                  <Text className="text-slate-700 font-black text-xs uppercase tracking-widest mt-6">
                    {searchQuery ? `No results for "${searchQuery}"` : 'No units deployed'}
                  </Text>
                </MotiView>
              ) : (
                filtered.map((client, i) => <ClientListItem key={client.id} client={client} index={i} />)
              )}
            </AnimatePresence>
          </ScrollView>
        </View>
      </SafeAreaView>
    </View>
  );
}

const ClientListItem = ({ client, index }: { client: ClientWithProfile, index: number }) => {
  const router = useRouter();
  return (
    <MotiView from={{ opacity: 0, translateX: -20 }} animate={{ opacity: 1, translateX: 0 }} transition={{ delay: index * 60 }} className="mb-4">
      <TouchableOpacity
        onPress={() => router.push(`/(coach)/clients/${client.id}`)}
        className="bg-slate-900/40 p-5 rounded-[32px] border border-slate-900 flex-row items-center justify-between"
      >
        <View className="flex-row items-center gap-4 flex-1">
          <View className="relative">
            <BrandedAvatar size={56} name={client.profiles?.full_name} imageUrl={client.profiles?.avatar_url} useBrandColor={true} />
            <View className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-500 rounded-full border-2 border-slate-950" />
          </View>
          <View className="flex-1">
            <Text className="text-white font-black text-base">{client.profiles?.full_name}</Text>
            <Text className="text-slate-600 text-[10px] font-black uppercase tracking-widest mt-0.5" numberOfLines={1}>
              {client.goal || 'Elite Athlete'} • {client.experience_level || 'Active'}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center gap-3">
          <View className="flex-row gap-2">
            <TouchableOpacity 
              onPress={() => router.push({ pathname: '/(coach)/(tabs)/chat/[id]', params: { id: client.id } })}
              className="w-8 h-8 bg-slate-950 rounded-xl items-center justify-center border border-slate-800"
            >
              <MessageSquare size={14} color="#475569" />
            </TouchableOpacity>
            <View className="w-8 h-8 bg-slate-950 rounded-xl items-center justify-center border border-slate-800">
              <Zap size={14} color="#475569" />
            </View>
          </View>
          <ChevronRight size={18} color="#334155" />
        </View>
      </TouchableOpacity>
    </MotiView>
  );
};
