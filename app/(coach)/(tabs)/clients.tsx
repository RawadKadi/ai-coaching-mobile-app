import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, StatusBar, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { MotiView, AnimatePresence } from 'moti';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Search, ChevronRight, Users, MessageSquare, Activity, UserPlus, Zap, Filter } from 'lucide-react-native';
import { BrandedAvatar } from '@/components/BrandedAvatar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ClientWithProfile {
  id: string;
  goal?: string;
  experience_level?: string;
  profiles: { full_name: string; avatar_url?: string | null };
}

export default function ClientsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { coach } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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
    } catch (e) { console.error(e); } finally { setLoading(false); setRefreshing(false); }
  };

  const onRefresh = () => { setRefreshing(true); loadClients(); };
  const filtered = clients.filter(c => c.profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <View style={{ flex: 1 }} className="bg-slate-950">
      <StatusBar barStyle="light-content" translucent />
      <View style={{ flex: 1, paddingTop: insets.top }}>
          {/* Header */}
          <View className="px-6 py-8 flex-row justify-between items-end">
            <View>
              <Text className="text-blue-500 text-[10px] font-black uppercase tracking-[4px] mb-2">Network</Text>
              <View className="flex-row items-center gap-4">
                <Text className="text-white text-4xl font-black tracking-tighter">Clients</Text>
                <View className="bg-blue-600/10 border border-blue-600/20 px-3 py-1 rounded-full">
                  <Text className="text-blue-500 font-black text-[10px]">{clients.length} Active</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity
              className="w-14 h-14 bg-blue-600 rounded-[22px] items-center justify-center shadow-2xl shadow-blue-500/30 border border-white/10"
              onPress={() => router.push('/(coach)/invite-client')}
            >
              <UserPlus size={24} color="white" />
            </TouchableOpacity>
          </View>

          {/* Search with Filter */}
          <View className="px-6 mb-8 flex-row gap-3">
            <View className="flex-1 flex-row items-center bg-slate-900/40 border border-white/5 rounded-[28px] px-6 py-4 shadow-xl">
              <Search size={20} color="#475569" />
              <TextInput
                className="flex-1 ml-4 text-white font-bold text-base"
                placeholder="Find a client..."
                placeholderTextColor="#1e293b"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
            <TouchableOpacity className="w-14 h-14 bg-slate-900 rounded-[22px] items-center justify-center border border-white/5 shadow-xl">
                <Filter size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          {loading && !refreshing ? (
            <View className="flex-1 justify-center items-center"><ActivityIndicator color="#3B82F6" /></View>
          ) : (
            <ScrollView 
                className="flex-1 px-6" 
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 140 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" />}
            >
              <AnimatePresence>
                {filtered.length === 0 ? (
                  <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-20 items-center px-10">
                    <View className="w-24 h-24 bg-slate-900 rounded-[32px] items-center justify-center border border-white/5 shadow-2xl">
                      <Users size={40} color="#334155" />
                    </View>
                    <Text className="text-white font-black text-lg mt-8 text-center">{searchQuery ? 'No athletes match' : 'Your roster is empty'}</Text>
                    <Text className="text-slate-500 text-xs mt-2 text-center leading-5 font-medium">{searchQuery ? 'Try a different name or keyword' : 'Invite your first athlete to get started with coaching.'}</Text>
                  </MotiView>
                ) : (
                  filtered.map((client, i) => (
                    <MotiView key={client.id} from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ delay: i * 50 }} className="mb-4">
                      <TouchableOpacity
                        onPress={() => router.push(`/(coach)/clients/${client.id}`)}
                        className="bg-slate-900/40 p-6 rounded-[40px] border border-white/5 flex-row items-center justify-between shadow-xl"
                      >
                        <View className="flex-row items-center gap-5 flex-1">
                          <View className="relative">
                            <BrandedAvatar size={60} name={client.profiles?.full_name} imageUrl={client.profiles?.avatar_url} useBrandColor={true} />
                            <View className="absolute bottom-0 right-0 w-4.5 h-4.5 bg-emerald-500 rounded-full border-[3px] border-slate-900" />
                          </View>
                          <View className="flex-1">
                            <Text className="text-white font-black text-lg tracking-tight">{client.profiles?.full_name}</Text>
                            <Text className="text-slate-600 text-[10px] font-black uppercase tracking-[2px] mt-1" numberOfLines={1}>
                              {client.goal || 'Elite Performance'} • {client.experience_level || 'Pro'}
                            </Text>
                          </View>
                        </View>
                        <ChevronRight size={18} color="#334155" />
                      </TouchableOpacity>
                    </MotiView>
                  ))
                )}
              </AnimatePresence>
            </ScrollView>
          )}
      </View>
    </View>
  );
}
