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
  Smile
} from 'lucide-react-native';
import { BrandedAvatar } from '@/components/BrandedAvatar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function CoachDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, coach } = useAuth();
  const { unreadCount } = useUnread();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recentCheckins, setRecentCheckins] = useState<any[]>([]);
  const [stats, setStats] = useState({ 
    totalClients: 0, 
    activeClients: 0, 
    pendingCheckIns: 0, 
    unreadMessages: 0 
  });

  useEffect(() => {
    if (coach) {
      loadDashboardData();
    } else {
      setLoading(false);
    }
  }, [coach, unreadCount]);

  const loadDashboardData = async () => {
    if (!coach) return;
    try {
      const [statsResult, checkinsResult] = await Promise.all([
        supabase.rpc('get_coach_stats'),
        supabase.rpc('get_recent_checkins')
      ]);

      if (statsResult.data) {
        setStats({
          ...statsResult.data,
          unreadMessages: unreadCount,
        });
      }

      setRecentCheckins(checkinsResult.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
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

                    <View className="flex-1 bg-slate-900/40 rounded-[36px] p-8 border border-white/5 shadow-xl">
                        <View className="w-12 h-12 bg-purple-600/10 rounded-2xl items-center justify-center mb-6 border border-purple-600/20">
                            <Award size={24} color="#A855F7" />
                        </View>
                        <Text className="text-white text-4xl font-black tracking-tighter">{stats.activeClients}</Text>
                        <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1">Active Now</Text>
                        <View className="w-full h-1.5 bg-slate-800 rounded-full mt-4 overflow-hidden">
                            <View className="bg-purple-500 h-full rounded-full" style={{ width: '87%' }} />
                        </View>
                    </View>
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
                  icon={<Dumbbell size={28} color="#A855F7" />} 
                  title="Workout Library" 
                  desc="Protocols & routines" 
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
                      onPress={() => router.push(`/(coach)/chat/${item.client_id}`)}
                      className="bg-slate-900/40 rounded-[32px] p-5 border border-white/5 flex-row items-center"
                    >
                      <BrandedAvatar name={item.client_name} imageUrl={item.client_avatar} size={48} />
                      <View className="flex-1 ml-4">
                        <View className="flex-row items-center justify-between">
                          <Text className="text-white font-bold text-sm tracking-tight">{item.client_name}</Text>
                          <Text className="text-slate-500 text-[9px] font-black uppercase tracking-widest">
                            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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

          {/* Precision Floating Action Button */}
          <View className="absolute bottom-10 right-6">
            <TouchableOpacity 
              className="w-20 h-20 bg-blue-600 rounded-[32px] items-center justify-center shadow-2xl shadow-blue-500/50 border-2 border-white/10"
              onPress={() => {/* Open Strategic Action Modal */}}
            >
              <Plus size={36} color="white" strokeWidth={3} />
            </TouchableOpacity>
          </View>
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
