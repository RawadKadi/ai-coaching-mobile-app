import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, StatusBar, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import { useAuth } from '@/contexts/AuthContext';
import { useUnread } from '@/contexts/UnreadContext';
import { supabase } from '@/lib/supabase';
import { 
  Users, 
  MessageSquare, 
  ClipboardCheck, 
  Trophy, 
  Dumbbell, 
  UserPlus, 
  BarChart3, 
  Plus,
  ChevronRight,
  TrendingUp,
  Award,
  Zap,
  Smile,
  Activity,
  ArrowUpRight
} from 'lucide-react-native';
import { BrandedAvatar } from '@/components/BrandedAvatar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePresence } from '@/contexts/PresenceContext';
import SchedulerModal from '@/components/SchedulerModal';
import { AnalyticsSparkline } from '@/components/AnalyticsSparkline';
import { AnalyticsDetailedModal } from '@/components/AnalyticsDetailedModal';
import { AnimatePresence } from 'moti';
import { X, Search } from 'lucide-react-native';
import { Modal, TextInput } from 'react-native';

const formatActivityDate = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const checkDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  if (checkDate.getTime() === today.getTime()) {
    return `Today, ${timeStr}`;
  } else if (checkDate.getTime() === yesterday.getTime()) {
    return `Yesterday, ${timeStr}`;
  } else {
    return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`;
  }
};

export default function CoachDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, coach } = useAuth();
  const { unreadCount } = useUnread();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recentCheckins, setRecentCheckins] = useState<any[]>([]);
  const { onlineUserIds } = usePresence();
  const [clientUserIds, setClientUserIds] = useState<string[]>([]);
  const [stats, setStats] = useState({ 
    totalClients: 0, 
    activeClients: 0, 
    compliantToday: 0,
    pendingCheckIns: 0, 
    unreadMessages: 0,
    activeChallenges: 0,
    todaysSessions: 0
  });

  // AI Scheduler State
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [selectedClientForAI, setSelectedClientForAI] = useState<any>(null);
  const [showAIScheduler, setShowAIScheduler] = useState(false);
  const [allSessions, setAllSessions] = useState<any[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [analyticsData, setAnalyticsData] = useState<any[]>([]);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);

  // Calculate real-time active count based on Presence (excluding the coach themselves)
  const realTimeActiveCount = clientUserIds
    .filter(id => id !== profile?.id)
    .filter(id => onlineUserIds.has(id)).length;
    
  // Use the higher of the two (DB last_seen or Realtime Presence) for immediate responsiveness
  const displayActiveCount = Math.max(stats.activeClients, realTimeActiveCount);

  useEffect(() => {
    if (coach) {
      loadDashboardData();
      
      // Subscribe to real-time check-in updates
      const checkinSubscription = supabase.channel('coach_dashboard_checkins')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'check_ins' },
          () => {
            // Reload dashboard data when any check-in changes
            loadDashboardData();
          }
        )
        .subscribe();

      return () => {
        checkinSubscription.unsubscribe();
      };
    } else {
      setLoading(false);
    }
  }, [coach, unreadCount]);

  const loadDashboardData = async () => {
    if (!coach) return;
    try {
      const [statsResult, checkinsResult, clientsResult, challengesResult] = await Promise.all([
        supabase.rpc('get_coach_stats'),
        supabase.rpc('get_recent_checkins'),
        supabase.rpc('get_my_clients'),
        supabase.rpc('get_coach_mother_challenges', { p_coach_id: coach?.id })
      ]);

      const activeChallengesCount = (challengesResult?.data || [])
        .filter((c: any) => c.status === 'active').length;

      if (statsResult.data) {
        // Handle both object and array response (Supabase returns array for RETURNS TABLE)
        const statsData = Array.isArray(statsResult.data) ? statsResult.data[0] : statsResult.data;
        
        setStats({
          totalClients: statsData?.totalClients || 0,
          activeClients: statsData?.activeClients || 0,
          compliantToday: statsData?.compliantToday || 0,
          pendingCheckIns: statsData?.pendingCheckIns || 0,
          unreadMessages: unreadCount,
          activeChallenges: activeChallengesCount,
          todaysSessions: statsData?.todaysSessions || 0,
        });
      }

      if (clientsResult.data) {
        const ids = clientsResult.data
          .filter((c: any) => c.status === 'active')
          .map((c: any) => c.user_id || c.client_user_id)
          .filter(Boolean);
        
        setClientUserIds(ids);
      }

      setRecentCheckins(checkinsResult.data || []);

      // Fetch analytics trend data
      setLoadingAnalytics(true);
      const analyticsResult = await supabase.rpc('get_coach_analytics_trend');
      if (analyticsResult.data) {
        setAnalyticsData(analyticsResult.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingAnalytics(false);
    }
  };

  const handleOpenAIScheduler = async () => {
    setLoadingClients(true);
    setShowClientPicker(true);
    try {
      const [clientsResult, sessionsResult] = await Promise.all([
        supabase.rpc('get_my_clients'),
        supabase.from('sessions').select('*, client:clients(profiles(full_name, avatar_url))').eq('coach_id', coach?.id)
      ]);
      
      if (clientsResult.data) {
        setClients(clientsResult.data.map((c: any) => ({
          id: c.client_id,
          name: c.client_name,
          avatar: c.client_avatar,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone // Default to current or fetch from profile if available
        })));
      }
      setAllSessions(sessionsResult.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingClients(false);
    }
  };

  const startAIScheduler = (client: any) => {
    setSelectedClientForAI(client);
    setShowClientPicker(false);
    setShowAIScheduler(true);
  };

  if (loading && !refreshing) {
    return (
      <View className="flex-1 bg-slate-950 justify-center items-center">
        <ActivityIndicator color="#3B82F6" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }} className="bg-slate-950">
      <StatusBar barStyle="light-content" translucent />
      <View style={{ flex: 1, paddingTop: insets.top }}>
          <ScrollView 
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 140 }}
            refreshControl={
              <RefreshControl 
                refreshing={refreshing} 
                onRefresh={() => { setRefreshing(true); loadDashboardData(); }} 
                tintColor="#3B82F6" 
                progressViewOffset={insets.top}
              />
            }
          >
            {/* New Premium Identity Header */}
            <MotiView 
              from={{ opacity: 0, translateY: -10 }} 
              animate={{ opacity: 1, translateY: 0 }} 
              className="px-6 py-10 flex-row justify-between items-center"
            >
              <View>
                <Text className="text-slate-500 text-[10px] font-black uppercase tracking-[4px] mb-2">Performance Center</Text>
                <View className="flex-row items-baseline gap-2">
                    <Text className="text-white text-4xl font-black tracking-tighter">Welcome back,</Text>
                </View>
                <Text className="text-blue-500 text-4xl font-black tracking-tighter">{profile?.full_name?.split(' ')[0]}</Text>
              </View>
              <TouchableOpacity 
                onPress={() => router.push('/(coach)/(tabs)/profile')}
                className="p-1.5 bg-slate-900 rounded-[24px] border border-white/5 shadow-2xl"
              >
                <BrandedAvatar name={profile?.full_name || 'Coach'} imageUrl={profile?.avatar_url} size={64} />
                <View className="absolute bottom-1 right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-slate-900" />
              </TouchableOpacity>
            </MotiView>

            {/* Strategic Stats Section */}
            <View className="px-6 mb-10">
                <View className="flex-row gap-4">
                    <View className="flex-1 bg-slate-900/40 rounded-[36px] p-8 border border-white/5 shadow-xl">
                        <View className="w-12 h-12 bg-blue-600/10 rounded-2xl items-center justify-center mb-6 border border-blue-600/20">
                            <Users size={24} color="#3B82F6" />
                        </View>
                        <Text className="text-white text-4xl font-black tracking-tighter">{stats.totalClients}</Text>
                        <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1">Total Roster</Text>
                        <View className="flex-row items-center gap-1.5 mt-4">
                            <TrendingUp size={12} color="#34D399" />
                            <Text className="text-emerald-500 font-bold text-[10px]">+12% growth</Text>
                        </View>
                    </View>

                    <TouchableOpacity 
                        onPress={() => setShowAnalyticsModal(true)}
                        className="flex-1 bg-slate-900/40 rounded-[36px] p-8 border border-white/5 shadow-xl overflow-hidden relative"
                    >
                        <View className="w-12 h-12 bg-purple-600/10 rounded-2xl items-center justify-center mb-6 border border-purple-600/20">
                            <Activity size={24} color="#A855F7" />
                        </View>
                        <View className="absolute top-8 right-8">
                            <ArrowUpRight size={22} color="#475569" />
                        </View>
                        
                        <Text className="text-white text-4xl font-black tracking-tighter">{displayActiveCount}</Text>
                        <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1">Active Clients</Text>

                        <View className="h-12 mt-2 opacity-40">
                          <AnalyticsSparkline 
                            data={analyticsData} 
                            heroNumber={displayActiveCount} 
                            label="Active Clients"
                            loading={loadingAnalytics}
                            dataKey="high_performers"
                          />
                        </View>

                        <View className="flex-row items-center gap-1.5 mt-4">
                            <TrendingUp size={12} color="#34D399" />
                            <Text className="text-emerald-500 font-bold text-[10px]">{stats.compliantToday}/{stats.activeClients} Compliant today</Text>
                        </View>
                    </TouchableOpacity>
                </View>

                {/* New Strategic Stats Row */}
                <View className="flex-row gap-4 mt-4">
                    <TouchableOpacity 
                      onPress={() => router.push({ pathname: '/(coach)/(tabs)/calendar', params: { resetToToday: 'true' } })}
                      className="flex-1 bg-slate-900/40 rounded-[36px] p-8 border border-white/5 shadow-xl relative"
                    >
                        <View className="w-12 h-12 bg-orange-600/10 rounded-2xl items-center justify-center mb-6 border border-orange-600/20">
                            <Zap size={24} color="#F59E0B" />
                        </View>
                        <View className="absolute top-8 right-8">
                            <ArrowUpRight size={22} color="#475569" />
                        </View>
                        <Text className="text-white text-4xl font-black tracking-tighter">{stats.todaysSessions}</Text>
                        <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1">Today's Sessions</Text>
                        <View className="flex-row items-center gap-1.5 mt-4">
                            <Text className="text-orange-500 font-bold text-[10px]">{stats.todaysSessions === 0 ? 'Clear Schedule' : 'Live Focus'}</Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      onPress={() => router.push('/(coach)/challenges')}
                      className="flex-1 bg-slate-900/40 rounded-[36px] p-8 border border-white/5 shadow-xl relative"
                    >
                        <View className="w-12 h-12 bg-emerald-600/10 rounded-2xl items-center justify-center mb-6 border border-emerald-600/20">
                            <Trophy size={24} color="#10B981" />
                        </View>
                        <View className="absolute top-8 right-8">
                            <ArrowUpRight size={22} color="#475569" />
                        </View>
                        <Text className="text-white text-4xl font-black tracking-tighter">{stats.activeChallenges}</Text>
                        <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1">Active Challenges</Text>
                        <View className="flex-row items-center gap-1.5 mt-4">
                            <TrendingUp size={12} color="#10B981" />
                            <Text className="text-emerald-500 font-bold text-[10px]">High Engagement</Text>
                        </View>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Notification/Status Bar */}
            <View className="mx-6 bg-slate-900/40 rounded-[32px] p-1 border border-white/5 mb-10">
              <TouchableOpacity className="flex-row items-center p-5">
                <View className="w-12 h-12 rounded-2xl bg-slate-950 items-center justify-center mr-5 border border-white/5">
                  <ClipboardCheck size={22} color="#94A3B8" />
                </View>
                <View className="flex-1">
                  <Text className="text-white font-bold text-sm tracking-tight">Check-ins Required</Text>
                  <Text className="text-slate-500 text-[10px] font-medium mt-0.5 uppercase tracking-widest">{stats.pendingCheckIns} Athletes pending</Text>
                </View>
                <ChevronRight size={18} color="#334155" />
              </TouchableOpacity>
              <View className="h-px bg-white/5 mx-5" />
              <TouchableOpacity 
                className="flex-row items-center p-5"
                onPress={() => router.push('/(coach)/(tabs)/messages')}
              >
                <View className="w-12 h-12 rounded-2xl bg-slate-950 items-center justify-center mr-5 border border-white/5">
                  <MessageSquare size={22} color="#94A3B8" />
                </View>
                <View className="flex-1">
                  <Text className="text-white font-bold text-sm tracking-tight">Communication</Text>
                  <Text className="text-slate-500 text-[10px] font-medium mt-0.5 uppercase tracking-widest">{stats.unreadMessages === 0 ? 'Clear Inbox' : `${stats.unreadMessages} New Unread`}</Text>
                </View>
                {stats.unreadMessages > 0 && (
                    <View className="bg-blue-600 w-2.5 h-2.5 rounded-full mr-4 shadow-lg shadow-blue-500/50" />
                )}
                <ChevronRight size={18} color="#334155" />
              </TouchableOpacity>
            </View>

            {/* Grid-based Quick Actions */}
            <View className="px-6 mb-10">
              <View className="flex-row justify-between items-end mb-8">
                  <Text className="text-white text-3xl font-black tracking-tighter">Actions</Text>
                  <TouchableOpacity onPress={() => router.push('/(coach)/(tabs)/clients')}>
                      <Text className="text-blue-500 font-black text-[10px] uppercase tracking-widest">View Roster</Text>
                  </TouchableOpacity>
              </View>
              <View className="flex-row flex-wrap gap-4">
                <ActionCard 
                  icon={<Trophy size={28} color="#F59E0B" />} 
                  title="Challenges" 
                  desc="Competitions & goals" 
                  onPress={() => router.push('/(coach)/challenges')}
                />
                <ActionCard 
                  icon={<Zap size={28} color="#A855F7" />} 
                  title="AI Scheduler" 
                  desc="Smart session planning" 
                  onPress={handleOpenAIScheduler}
                />
                <ActionCard 
                  icon={<UserPlus size={28} color="#3B82F6" />} 
                  title="Onboard Client" 
                  desc="Invite new athlete" 
                  onPress={() => router.push('/(coach)/invite-client')}
                />
                <ActionCard 
                  icon={<BarChart3 size={28} color="#10B981" />} 
                  title="Analytics" 
                  desc="Growth & metrics" 
                />
              </View>
            </View>

            {/* Activity Indicator / Placeholder */}
            <View className="px-6">
              <Text className="text-white text-2xl font-black tracking-tighter mb-8">Current Feed</Text>
              
              {recentCheckins.length === 0 ? (
                <View className="p-16 bg-slate-900/20 rounded-[48px] border border-white/5 border-dashed items-center justify-center">
                  <View className="w-16 h-16 bg-slate-900 rounded-[28px] items-center justify-center border border-white/5 mb-6">
                      <TrendingUp size={28} color="#1e293b" />
                  </View>
                  <Text className="text-slate-700 font-black text-[10px] uppercase tracking-[3px]">Real-time activity</Text>
                  <Text className="text-slate-800 font-medium text-[10px] mt-2 text-center leading-4">Recent events will surface here as they happen.</Text>
                </View>
              ) : (
                <View className="gap-4">
                  {recentCheckins.map((item) => (
                    <TouchableOpacity 
                      key={item.checkin_id}
                      onPress={() => router.push(`/(coach)/clients/${item.client_id}?tab=checkins`)}
                      className="bg-slate-900/40 rounded-[32px] p-5 border border-white/5 flex-row items-center"
                    >
                      <BrandedAvatar name={item.client_name} imageUrl={item.client_avatar} size={48} />
                      <View className="flex-1 ml-4">
                        <View className="flex-row items-center justify-between">
                          <Text className="text-white font-bold text-sm tracking-tight">{item.client_name}</Text>
                          <Text className="text-slate-500 text-[9px] font-black uppercase tracking-widest">
                            {formatActivityDate(item.created_at)}
                          </Text>
                        </View>
                        <Text className="text-blue-500 font-black text-[10px] uppercase tracking-[2px] mt-1">Daily Check-in Synced</Text>
                        <View className="flex-row items-center gap-3 mt-3">
                          <View className="flex-row items-center gap-1">
                            <TrendingUp size={10} color="#94A3B8" />
                            <Text className="text-slate-400 text-[10px] font-bold">{item.weight_kg}kg</Text>
                          </View>
                          <View className="flex-row items-center gap-1">
                            <Zap size={10} color="#94A3B8" />
                            <Text className="text-slate-400 text-[10px] font-bold">Energy {item.energy_level}/10</Text>
                          </View>
                          <View className="flex-row items-center gap-1">
                            <Smile size={10} color="#94A3B8" />
                            <Text className="text-slate-400 text-[10px] font-bold" numberOfLines={1}>{item.mood}</Text>
                          </View>
                        </View>
                      </View>
                      <ChevronRight size={16} color="#334155" style={{ marginLeft: 8 }} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </ScrollView>

        

          {/* Client Picker Modal */}
          <Modal visible={showClientPicker} animationType="slide" presentationStyle="pageSheet">
            <View className="flex-1 bg-slate-950">
              <View className="px-6 pt-6 pb-4 flex-row justify-between items-center border-b border-slate-900">
                <View>
                  <Text className="text-white text-xl font-bold">Select Athlete</Text>
                  <Text className="text-slate-500 text-xs uppercase tracking-widest font-bold">Launch AI Scheduler</Text>
                </View>
                <TouchableOpacity onPress={() => setShowClientPicker(false)} className="p-2 bg-slate-900 rounded-full">
                  <X size={20} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              <View className="px-6 py-4">
                <View className="bg-slate-900/50 border border-slate-800 rounded-2xl px-4 py-3 flex-row items-center">
                  <Search size={18} color="#475569" />
                  <TextInput 
                    className="flex-1 ml-3 text-white font-bold"
                    placeholder="Search roster..."
                    placeholderTextColor="#475569"
                    value={clientSearch}
                    onChangeText={setClientSearch}
                  />
                </View>
              </View>

              {loadingClients ? (
                <View className="flex-1 justify-center items-center">
                  <ActivityIndicator color="#3B82F6" />
                </View>
              ) : (
                <ScrollView className="flex-1 px-6 pt-4">
                  {clients
                    .filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase()))
                    .map((client) => (
                    <TouchableOpacity 
                      key={client.id}
                      onPress={() => startAIScheduler(client)}
                      className="bg-slate-900/40 p-5 rounded-[28px] border border-white/5 mb-4 flex-row items-center"
                    >
                      <BrandedAvatar name={client.name} imageUrl={client.avatar} size={48} />
                      <View className="ml-4 flex-1">
                        <Text className="text-white font-bold text-lg">{client.name}</Text>
                        <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-0.5">Active Client</Text>
                      </View>
                      <View className="w-10 h-10 bg-blue-600/10 rounded-full items-center justify-center border border-blue-500/20">
                        <ChevronRight size={18} color="#3B82F6" />
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
          </Modal>

          {/* AI Scheduler Modal */}
          {selectedClientForAI && (
            <SchedulerModal 
              visible={showAIScheduler}
              onClose={() => { setShowAIScheduler(false); setSelectedClientForAI(null); }}
              onConfirm={async (sessions) => {
                // Handle session confirmation (similar to calendar.tsx)
                try {
                  const { error } = await supabase.from('sessions').insert(
                    sessions.map(s => ({
                      coach_id: coach?.id,
                      client_id: selectedClientForAI.id,
                      scheduled_at: s.scheduled_at,
                      duration_minutes: s.duration_minutes,
                      session_type: s.session_type,
                      status: 'scheduled'
                    }))
                  );
                  if (error) throw error;
                  loadDashboardData();
                } catch (e) {
                  console.error(e);
                  throw e;
                }
              } }
              clientContext={{
                name: selectedClientForAI.name,
                timezone: selectedClientForAI.timezone,
                avatar_url: selectedClientForAI.avatar
              }}
              targetClientId={selectedClientForAI.id}
              existingSessions={allSessions}
            />
          )}

          <AnalyticsDetailedModal 
            visible={showAnalyticsModal}
            onClose={() => setShowAnalyticsModal(false)}
            data={analyticsData}
            currentActive={displayActiveCount}
          />
      </View>
    </View>
  );
}

const ActionCard = ({ icon, title, desc, onPress }: any) => (
  <TouchableOpacity 
    onPress={onPress}
    className="bg-slate-900/40 border border-white/5 p-7 rounded-[40px] w-[47%] shadow-lg shadow-black/20"
  >
    <View className="w-14 h-14 bg-slate-950 rounded-[22px] items-center justify-center mb-8 border border-white/5">
      {icon}
    </View>
    <Text className="text-white font-black text-lg tracking-tight mb-2 leading-5">{title}</Text>
    <Text className="text-slate-600 text-[10px] font-black uppercase tracking-widest">{desc}</Text>
  </TouchableOpacity>
);
