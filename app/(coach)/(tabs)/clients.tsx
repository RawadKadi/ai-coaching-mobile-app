import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, StatusBar, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { MotiView, AnimatePresence } from 'moti';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Search, ChevronRight, Users, MessageSquare, Activity, UserPlus, Zap, Filter, Shield, TrendingUp, Plus, Award, Calendar } from 'lucide-react-native';
import { BrandedAvatar } from '@/components/BrandedAvatar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBrand, useBrandColors, useTheme } from '@/contexts/BrandContext';
import { Pressable, Alert } from 'react-native';

interface ClientWithProfile {
  id: string;
  status?: string;
  goal?: string;
  experience_level?: string;
  profiles: { full_name: string; avatar_url?: string | null };
  checkedInToday?: boolean;
}

interface SubCoach {
  coach_id: string | null;
  full_name: string;
  email: string;
  client_count: number;
  added_at: string;
  status: 'active' | 'pending';
  invite_token: string | null;
  avatar_url?: string | null;
}

type Tab = 'clients' | 'team';

export default function ClientsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { coach } = useAuth();
  const { brand } = useBrand();
  const { primary, secondary } = useBrandColors();
  const theme = useTheme();

  const [activeTab, setActiveTab] = useState<Tab>('clients');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [clients, setClients] = useState<ClientWithProfile[]>([]);
  const [subCoaches, setSubCoaches] = useState<SubCoach[]>([]);
  const [totalTeamClients, setTotalTeamClients] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (coach) {
      loadData();
      const sub = supabase.channel('coach_management_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'coach_client_links', filter: `coach_id=eq.${coach.id}` }, () => loadClients())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'coach_hierarchy', filter: `parent_coach_id=eq.${coach.id}` }, () => loadSubCoaches())
        .subscribe();
      return () => { sub.unsubscribe(); };
    } else { setLoading(false); }
  }, [coach]);

  useFocusEffect(useCallback(() => { if (coach) loadData(); }, [coach]));

  const loadData = async () => {
    setLoading(true);
    await Promise.all([
      loadClients(),
      coach?.is_parent_coach ? loadSubCoaches() : Promise.resolve(),
      coach?.is_parent_coach ? loadBrandStats() : Promise.resolve()
    ]);
    setLoading(false);
  };

  const loadClients = async () => {
    if (!coach) return;
    try {
      const { data, error } = await supabase.rpc('get_my_clients');
      if (error) throw error;
      
      const today = new Date().toISOString().split('T')[0];
      const { data: checkinsData } = await supabase
        .from('check_ins')
        .select('client_id')
        .eq('date', today);
        
      const checkedInClientIds = new Set(checkinsData?.map(c => c.client_id) || []);

      const mappedClients = data?.map((item: any) => ({
        id: item.client_id,
        status: item.status?.toLowerCase().trim(),
        goal: item.client_goal,
        experience_level: item.client_experience,
        profiles: { full_name: item.client_name, avatar_url: item.client_avatar },
        checkedInToday: checkedInClientIds.has(item.client_id)
      })) || [];
      
      setClients(mappedClients);
    } catch (e) { console.error(e); } finally { setRefreshing(false); }
  };

  const loadSubCoaches = async () => {
    if (!coach?.id || !coach.is_parent_coach) return;
    try {
      const { data, error } = await supabase.rpc('get_sub_coaches', {
        p_parent_coach_id: coach.id,
      });
      if (error) throw error;
      setSubCoaches(data || []);
    } catch (error) {
      console.error('[Management] Error loading sub-coaches:', error);
    }
  };

  const loadBrandStats = async () => {
    if (!brand?.id) return;
    try {
      const { count, error } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('brand_id', brand?.id);
      if (error) throw error;
      setTotalTeamClients(count || 0);
    } catch (error) {
      console.error('[Management] Error loading brand stats:', error);
    }
  };

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const filteredClients = clients.filter(c => c.profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredCoaches = subCoaches.filter(c => c.full_name?.toLowerCase().includes(searchQuery.toLowerCase()));
  
  const activeCount = clients.filter(c => c.status === 'active').length;
  const pendingCount = clients.filter(c => c.status === 'pending').length;
  const checkedInTodayCount = clients.filter(c => c.checkedInToday).length;

  const renderCoachCard = (item: SubCoach, index: number) => (
    <MotiView
      key={item.invite_token || item.coach_id || index}
      from={{ opacity: 0, translateY: 20 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ delay: index * 50 }}
      className="mb-4"
    >
      <TouchableOpacity
        onPress={() => {
          if (item.status === 'active' && item.coach_id) {
            router.push(`/(coach)/team/${item.coach_id}`);
          } else if (item.status === 'pending' && item.invite_token) {
            Alert.alert('Pending Invite', `Email: ${item.email}\n\nToken: ${item.invite_token}`);
          }
        }}
        className={`p-6 rounded-[32px] border ${item.status === 'pending' ? 'border-dashed border-amber-500/30 bg-amber-500/5' : 'border-white/5 bg-slate-900/40'} flex-row items-center gap-4`}
      >
        <BrandedAvatar name={item.full_name} size={56} imageUrl={item.avatar_url} useBrandColor={item.status === 'active'} />
        <View className="flex-1">
          <View className="flex-row items-center justify-between mb-1">
            <Text className="text-white font-black text-lg tracking-tight" numberOfLines={1}>{item.full_name}</Text>
            <View className={`px-2 py-1 rounded-md border ${item.status === 'pending' ? 'bg-amber-500/10 border-amber-500/20' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
              <Text className={`${item.status === 'pending' ? 'text-amber-500' : 'text-emerald-500'} text-[8px] font-black uppercase tracking-widest`}>{item.status}</Text>
            </View>
          </View>
          <Text className="text-slate-500 text-xs font-medium mb-3" numberOfLines={1}>{item.email}</Text>
          <View className="flex-row items-center gap-4">
             <View className="flex-row items-center gap-1.5">
                <Users size={12} color="#94A3B8" />
                <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest">{item.client_count} Clients</Text>
             </View>
             <View className="w-1 h-1 rounded-full bg-slate-800" />
             <View className="flex-row items-center gap-1.5">
                <Calendar size={12} color="#94A3B8" />
                <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest">{new Date(item.added_at).toLocaleDateString()}</Text>
             </View>
          </View>
        </View>
        <ChevronRight size={20} color="#334155" />
      </TouchableOpacity>
    </MotiView>
  );

  return (
    <View style={{ flex: 1 }} className="bg-slate-950">
      <StatusBar barStyle="light-content" translucent />
      
      {/* Header */}
      <View style={{ paddingTop: insets.top + 16 }} className="px-6 pb-6 flex-row items-center justify-between border-b border-white/5 bg-slate-950">
        <View>
          <Text className="text-slate-500 text-[10px] font-black uppercase tracking-[3px] mb-1">Management Center</Text>
          <Text className="text-white text-3xl font-black tracking-tighter">Management</Text>
        </View>
        <TouchableOpacity
          className="w-14 h-14 bg-blue-600 rounded-[22px] items-center justify-center shadow-2xl shadow-blue-500/30 border border-white/10"
          onPress={() => activeTab === 'clients' ? router.push('/(coach)/invite-client') : router.push('/(coach)/team/add')}
        >
          {activeTab === 'clients' ? <UserPlus size={24} color="white" /> : <Plus size={24} color="white" />}
        </TouchableOpacity>
      </View>

      <ScrollView 
        className="flex-1" 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" />}
      >
        {/* Tab Switch */}
        <View className="px-6 mt-8 mb-8">
          <View className="flex-row bg-slate-900/50 rounded-[28px] p-1.5 border border-white/5">
            <Pressable
              onPress={() => { setActiveTab('clients'); setSearchQuery(''); }}
              className={`flex-1 py-4 rounded-[22px] items-center flex-row justify-center gap-3 ${activeTab === 'clients' ? 'bg-slate-800' : ''}`}
              style={activeTab === 'clients' ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 } : {}}
            >
              <Users size={18} color={activeTab === 'clients' ? '#3B82F6' : '#475569'} />
              <Text className={`font-black text-sm uppercase tracking-widest ${activeTab === 'clients' ? 'text-white' : 'text-slate-500'}`}>Clients</Text>
            </Pressable>
            <Pressable
              onPress={() => { setActiveTab('team'); setSearchQuery(''); }}
              className={`flex-1 py-4 rounded-[22px] items-center flex-row justify-center gap-3 ${activeTab === 'team' ? 'bg-slate-800' : ''}`}
              style={activeTab === 'team' ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 } : {}}
            >
              <Zap size={18} color={activeTab === 'team' ? '#3B82F6' : '#475569'} />
              <Text className={`font-black text-sm uppercase tracking-widest ${activeTab === 'team' ? 'text-white' : 'text-slate-500'}`}>Coaches</Text>
            </Pressable>
          </View>
        </View>

        <AnimatePresence mode="wait">
          {activeTab === 'clients' ? (
            <MotiView key="clients-tab" from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} exit={{ opacity: 0, translateY: -10 }}>
              {/* Athletes Hero */}
              <View className="mx-6 p-10 rounded-[48px] bg-blue-600/10 border border-blue-500/20 items-center overflow-hidden">
                <View className="absolute top-0 right-0 p-4 opacity-10">
                  <Activity size={120} color="#3B82F6" />
                </View>
                <View className="w-20 h-20 bg-blue-600 rounded-[30px] items-center justify-center shadow-2xl shadow-blue-500/50 mb-6 border-2 border-white/20">
                  <Users size={36} color="white" fill="white" />
                </View>
                <Text className="text-white text-2xl font-black text-center tracking-tighter">Athlete Network</Text>
                <Text className="text-slate-400 text-center mt-3 leading-5 px-4 text-sm font-medium">
                  Optimize your roster, track check-ins, and elevate collective performance.
                </Text>
              </View>

              {/* Athletes Stats */}
              <View className="mx-6 mt-8 p-8 rounded-[40px] bg-slate-900/40 border border-white/5">
                <View className="flex-row items-center gap-2 mb-8">
                  <View className="w-8 h-8 rounded-xl bg-slate-950 items-center justify-center border border-white/5">
                    <TrendingUp size={16} color="#3B82F6" />
                  </View>
                  <Text className="text-white font-black text-lg tracking-tight">Active Performance</Text>
                </View>
                <View className="flex-row">
                  <StatItem label="Active" value={activeCount.toString()} icon={<Users size={14} color="#3B82F6" />} />
                  <View className="w-px h-12 bg-white/5 mx-2 self-center" />
                  <StatItem label="Pending" value={pendingCount.toString()} icon={<MessageSquare size={14} color="#F59E0B" />} />
                  <View className="w-px h-12 bg-white/5 mx-2 self-center" />
                  <StatItem label="Checked In" value={checkedInTodayCount.toString()} icon={<Activity size={14} color="#10B981" />} isLast />
                </View>
              </View>

              {/* Search Bar */}
              <View className="px-6 mt-10 mb-6 flex-row gap-3">
                <View className="flex-1 flex-row items-center bg-slate-900/40 border border-white/5 rounded-[28px] px-6 py-4">
                  <Search size={20} color="#475569" />
                  <TextInput className="flex-1 ml-4 text-white font-bold text-base" placeholder="Find an athlete..." placeholderTextColor="#1e293b" value={searchQuery} onChangeText={setSearchQuery} />
                </View>
              </View>

              {/* Athletes List */}
              <View className="px-6">
                {loading ? <ActivityIndicator className="mt-10" color="#3B82F6" /> : filteredClients.length === 0 ? (
                  <View className="py-20 items-center">
                    <Users size={48} color="#1E293B" />
                    <Text className="text-slate-500 font-bold mt-4">No athletes found</Text>
                  </View>
                ) : (
                  filteredClients.map((client, i) => (
                    <MotiView key={client.id} from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ delay: i * 50 }} className="mb-4">
                      <TouchableOpacity onPress={() => router.push(`/(coach)/clients/${client.id}`)} className="bg-slate-900/40 p-6 rounded-[40px] border border-white/5 flex-row items-center justify-between shadow-xl">
                        <View className="flex-row items-center gap-5 flex-1">
                          <View className="relative">
                            <BrandedAvatar size={60} name={client.profiles?.full_name} imageUrl={client.profiles?.avatar_url} useBrandColor={true} />
                            <View className={`absolute bottom-0 right-0 w-4.5 h-4.5 rounded-full border-[3px] border-slate-900 ${client.status === 'active' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                          </View>
                          <View className="flex-1">
                            <View className="flex-row items-center gap-2">
                                <Text className="text-white font-black text-lg tracking-tight">{client.profiles?.full_name}</Text>
                                {client.status === 'pending' && <View className="bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full"><Text className="text-amber-500 font-black text-[8px] uppercase">Pending</Text></View>}
                            </View>
                            <Text className="text-slate-600 text-[10px] font-black uppercase tracking-[2px] mt-1" numberOfLines={1}>{client.goal || 'Elite Performance'} • {client.experience_level || 'Pro'}</Text>
                            {client.checkedInToday && <View className="flex-row items-center gap-1 mt-2"><View className="w-1.5 h-1.5 rounded-full bg-emerald-500" /><Text className="text-emerald-500 text-[9px] font-black uppercase tracking-widest">Checked In</Text></View>}
                          </View>
                        </View>
                        <ChevronRight size={18} color="#334155" />
                      </TouchableOpacity>
                    </MotiView>
                  ))
                )}
              </View>
            </MotiView>
          ) : (
            <MotiView key="team-tab" from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} exit={{ opacity: 0, translateY: -10 }}>
              {/* Coaches Tab Content */}
              {!coach?.is_parent_coach ? (
                <View className="mx-6 py-20 items-center justify-center bg-slate-900/20 rounded-[40px] border border-white/5 border-dashed">
                  <Award size={64} color="#1E293B" />
                  <Text className="text-white text-xl font-black text-center mt-6 tracking-tighter">Parent Coach Required</Text>
                  <Text className="text-slate-500 text-center mt-3 leading-5 px-10 font-medium">This section is for head coaches managing performance teams.</Text>
                </View>
              ) : (
                <>
                  {/* Coaches Hero */}
                  <View className="mx-6 p-10 rounded-[48px] bg-blue-600/10 border border-blue-500/20 items-center overflow-hidden">
                    <View className="absolute top-0 right-0 p-4 opacity-10">
                      <Shield size={120} color="#3B82F6" />
                    </View>
                    <View className="w-20 h-20 bg-blue-600 rounded-[30px] items-center justify-center shadow-2xl shadow-blue-500/50 mb-6 border-2 border-white/20">
                      <Zap size={36} color="white" fill="white" />
                    </View>
                    <Text className="text-white text-2xl font-black text-center tracking-tighter">Command Center</Text>
                    <Text className="text-slate-400 text-center mt-3 leading-5 px-4 text-sm font-medium">
                      Oversee your team, track metrics, and optimize your coaching output.
                    </Text>
                  </View>

                  {/* Coaches Stats */}
                  <View className="mx-6 mt-8 p-8 rounded-[40px] bg-slate-900/40 border border-white/5">
                    <View className="flex-row items-center gap-2 mb-8">
                      <View className="w-8 h-8 rounded-xl bg-slate-950 items-center justify-center border border-white/5">
                        <TrendingUp size={16} color="#10B981" />
                      </View>
                      <Text className="text-white font-black text-lg tracking-tight">{brand?.name || 'Network Stats'}</Text>
                    </View>
                    <View className="flex-row">
                      <StatItem label="Coaches" value={subCoaches.length.toString()} icon={<Users size={14} color="#3B82F6" />} />
                      <View className="w-px h-12 bg-white/5 mx-2 self-center" />
                      <StatItem label="Total Depth" value={totalTeamClients.toString()} icon={<Zap size={14} color="#10B981" />} />
                      <View className="w-px h-12 bg-white/5 mx-2 self-center" />
                      <StatItem label="Assigned" value={subCoaches.reduce((sum, c) => sum + (c.client_count || 0), 0).toString()} icon={<Shield size={14} color="#F59E0B" />} isLast />
                    </View>
                  </View>

                  {/* Search Bar */}
                  <View className="px-6 mt-10 mb-6 flex-row gap-3">
                    <View className="flex-1 flex-row items-center bg-slate-900/40 border border-white/5 rounded-[28px] px-6 py-4">
                      <Search size={20} color="#475569" />
                      <TextInput className="flex-1 ml-4 text-white font-bold text-base" placeholder="Find a coach..." placeholderTextColor="#1e293b" value={searchQuery} onChangeText={setSearchQuery} />
                    </View>
                  </View>

                  {/* Coaches List */}
                  <View className="px-6">
                    {loading ? <ActivityIndicator className="mt-10" color="#3B82F6" /> : filteredCoaches.length === 0 ? (
                      <View className="py-20 items-center">
                        <Users size={48} color="#1E293B" />
                        <Text className="text-slate-500 font-bold mt-4">No coaches found</Text>
                      </View>
                    ) : (
                      filteredCoaches.map((item, index) => renderCoachCard(item, index))
                    )}
                  </View>
                </>
              )}
            </MotiView>
          )}
        </AnimatePresence>
      </ScrollView>
    </View>
  );
}

const StatItem = ({ label, value, icon, isLast }: any) => (
  <View className={`flex-1 items-center ${isLast ? '' : 'border-r border-white/5'}`}>
      <View className="flex-row items-center gap-1.5 mb-1">
          {icon}
          <Text className="text-slate-500 text-[8px] font-black uppercase tracking-[2px]">{label}</Text>
      </View>
      <Text className="text-white text-2xl font-black tracking-tighter">{value}</Text>
  </View>
);
