import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, SafeAreaView, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import { useAuth } from '@/contexts/AuthContext';
import { useUnread } from '@/contexts/UnreadContext';
import { supabase } from '@/lib/supabase';
import { Users, TrendingUp, MessageCircle, CheckCircle, Target, Sparkles, Plus, Bell, ChevronRight, Activity, Zap, Shield, BrainCircuit, AlertCircle } from 'lucide-react-native';
import { BrandedAvatar } from '@/components/BrandedAvatar';
import NewClientModal from '@/components/NewClientModal';
import SchedulerModal from '@/components/SchedulerModal';
import { ProposedSession } from '@/lib/ai-scheduling-service';

export default function CoachDashboard() {
  const router = useRouter();
  const { profile, coach } = useAuth();
  const { unreadCount } = useUnread();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [proposedSessions, setProposedSessions] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalClients: 0, activeClients: 0, pendingCheckIns: 2, unreadMessages: 0 });
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [showScheduler, setShowScheduler] = useState(false);
  const [newClient, setNewClient] = useState<{id: string, name: string, timezone: string} | null>(null);

  useEffect(() => {
    if (coach) {
      loadDashboardData();
      const sub = supabase.channel('new_client_notifications').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'coach_client_links', filter: `coach_id=eq.${coach.id}` }, async (payload) => {
        const { data: cData } = await supabase.from('clients').select(`id, user_id, profiles!inner (full_name, timezone)`).eq('id', payload.new.client_id).single();
        if (cData) {
          const p: any = cData.profiles;
          setNewClient({ id: cData.id, name: p?.full_name || 'New Unit', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
          setShowNewClientModal(true);
          loadDashboardData();
        }
      }).subscribe();
      return () => { sub.unsubscribe(); };
    } else { setLoading(false); }
  }, [coach]);

  const loadDashboardData = async () => {
    if (!coach) return;
    try {
      setLoading(true);
      const { data } = await supabase.rpc('get_coach_stats');
      setStats({
        totalClients: data?.totalClients || 0,
        activeClients: data?.activeClients || 0,
        pendingCheckIns: 2,
        unreadMessages: unreadCount,
      });
    } catch (e) { console.error(e); } finally { setLoading(false); setRefreshing(false); }
  };

  if (loading && !refreshing) return <View className="flex-1 bg-slate-950 justify-center items-center"><ActivityIndicator color="#3B82F6" /></View>;

  return (
    <View style={{ flex: 1 }} className="bg-slate-950">
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
          <ScrollView 
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: 120 }}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadDashboardData(); }} tintColor="#3B82F6" />}
          >
              {/* Header / Identity */}
              <MotiView from={{ opacity: 0, translateY: -10 }} animate={{ opacity: 1, translateY: 0 }} className="px-6 pt-10 pb-6 flex-row justify-between items-center">
                  <View>
                      <Text className="text-blue-500 text-[10px] font-black uppercase tracking-[4px] mb-1">Command Hub</Text>
                      <Text className="text-white text-3xl font-black">Agent {profile?.full_name?.split(' ')[0]}</Text>
                  </View>
                  <TouchableOpacity onPress={() => router.push('/(coach)/(tabs)/profile')}>
                      <BrandedAvatar name={profile?.full_name} imageUrl={profile?.avatar_url} size={54} />
                      <View className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-slate-950" />
                  </TouchableOpacity>
              </MotiView>

              {/* Performance Mosaic */}
              <View className="px-6 flex-row flex-wrap gap-4 mb-10">
                  <UnitStatCard 
                      label="Active Units" 
                      value={stats.activeClients} 
                      subtext="84% Capacity" 
                      color="#3B82F6" 
                      icon={<Users size={16} color="white" />} 
                  />
                  <UnitStatCard 
                      label="Success Rate" 
                      value="92%" 
                      subtext="+4.2% Growth" 
                      color="#10B981" 
                      icon={<TrendingUp size={16} color="white" />} 
                      delay={100} 
                  />
              </View>

              {/* Neural Warnings */}
              {stats.pendingCheckIns > 0 && (
                  <MotiView from={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="px-6 mb-10">
                      <TouchableOpacity className="bg-amber-500/5 border border-amber-500/20 rounded-[32px] p-6 flex-row items-center gap-5">
                          <MotiView 
                              from={{ opacity: 0.4, scale: 0.8 }} 
                              animate={{ opacity: 1, scale: 1 }} 
                              transition={{ loop: true, duration: 1500, type: 'timing' }}
                              className="w-12 h-12 rounded-2xl bg-amber-500/20 items-center justify-center"
                          >
                              <AlertCircle size={24} color="#F59E0B" />
                          </MotiView>
                          <View className="flex-1">
                              <Text className="text-amber-500 font-black text-xs uppercase tracking-widest mb-1">Attention Required</Text>
                              <Text className="text-white font-bold text-base">{stats.pendingCheckIns} Units Awaiting Protocol</Text>
                          </View>
                          <ChevronRight size={20} color="#F59E0B" opacity={0.5} />
                      </TouchableOpacity>
                  </MotiView>
              )}

              {/* Command Matrix */}
              <View className="px-6">
                  <Text className="text-slate-600 text-[10px] font-black uppercase tracking-[4px] mb-6 px-1">Command Matrix</Text>
                  <View className="flex-row flex-wrap gap-4">
                      <MatrixAction icon={<Target size={22} color="#3B82F6" />} title="Protocols" desc="Deploy Syncs" onPress={() => router.push('/(coach)/challenges/index')} />
                      <MatrixAction icon={<Zap size={22} color="#F59E0B" />} title="Intelligence" desc="AI Breakdown" />
                      <MatrixAction icon={<Plus size={22} color="#10B981" />} title="Enrollment" desc="Invite Unit" onPress={() => router.push('/(coach)/invite-client')} />
                      <MatrixAction icon={<BrainCircuit size={22} color="#8B5CF6" />} title="Framework" desc="Settings" onPress={() => router.push('/(coach)/settings/ai-brain')} />
                  </View>
              </View>

              {/* Activity Stream */}
              <View className="px-6 mt-12">
                  <View className="flex-row justify-between items-center mb-6">
                      <Text className="text-slate-600 text-[10px] font-black uppercase tracking-[4px] px-1">Live Feed</Text>
                      <TouchableOpacity><Text className="text-blue-500 text-[10px] font-black uppercase tracking-widest">History</Text></TouchableOpacity>
                  </View>
                  <View className="p-10 bg-slate-900/30 rounded-[40px] border border-slate-900 items-center justify-center border-dashed">
                      <Activity size={32} color="#1E293B" />
                      <Text className="text-slate-700 font-black text-xs uppercase tracking-widest mt-6">Stealth Mode Active</Text>
                      <Text className="text-slate-800 font-medium text-[10px] mt-2 text-center">No units currently deploying protocols.</Text>
                  </View>
              </View>
              <View className="mt-12 items-center pb-8">
                <Text className="text-slate-800 text-[10px] font-black uppercase tracking-[4px]">V3.0.Neural-Sync • Coach Build</Text>
            </View>
          </ScrollView>

          {/* Floating Initiator (Outside ScrollView) */}
          <View className="absolute bottom-10 right-6">
            <TouchableOpacity 
                onPress={() => setShowScheduler(true)}
                className="w-16 h-16 bg-blue-600 rounded-[28px] items-center justify-center shadow-2xl shadow-blue-500/40 border-2 border-white/10"
            >
                <Zap size={28} color="white" fill="white" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Support Modals */}
        {newClient && (
            <NewClientModal visible={showNewClientModal} clientName={newClient.name} onSetupSessions={() => setShowScheduler(true)} onDismiss={() => { setShowNewClientModal(false); setNewClient(null); }} />
        )}
        {newClient && (
            <SchedulerModal visible={showScheduler} onClose={() => setShowScheduler(false)} onConfirm={async () => {}} clientContext={newClient as any} existingSessions={[]} targetClientId={newClient.id} />
        )}
      </SafeAreaView>
    </View>
  );
}

const UnitStatCard = ({ label, value, subtext, color, icon, delay = 0 }: any) => (
    <MotiView from={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay }} className="flex-1 min-w-[45%] bg-slate-900/50 p-6 rounded-[32px] border border-slate-900">
        <View style={{ backgroundColor: color + '20' }} className="w-10 h-10 rounded-2xl items-center justify-center mb-4">
            {icon}
        </View>
        <Text className="text-slate-600 text-[10px] font-black uppercase tracking-widest mb-1">{label}</Text>
        <Text className="text-white text-3xl font-black">{value}</Text>
        <Text className="text-slate-500 text-[10px] font-bold mt-2 uppercase tracking-tighter">{subtext}</Text>
    </MotiView>
);

const MatrixAction = ({ icon, title, desc, onPress }: any) => (
    <TouchableOpacity onPress={onPress} className="flex-1 min-w-[45%] bg-slate-900 p-5 rounded-[28px] border border-slate-900 border-b-4 border-b-slate-800">
        <View className="flex-row items-center gap-4 mb-3">
            <View className="w-12 h-12 bg-slate-950 rounded-2xl items-center justify-center border border-slate-800">
                {icon}
            </View>
            <View>
                <Text className="text-white font-black text-sm">{title}</Text>
                <Text className="text-slate-600 text-[10px] font-bold uppercase">{desc}</Text>
            </View>
        </View>
    </TouchableOpacity>
);


