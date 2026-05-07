import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StatusBar, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { MotiView, AnimatePresence } from 'moti';
import { 
  Calendar, 
  TrendingUp, 
  Target, 
  Heart, 
  Camera, 
  ChevronRight, 
  Zap, 
  Brain, 
  Sparkles,
  ClipboardCheck,
  Award,
  CheckCircle2
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { CheckIn, Habit, HabitLog } from '@/types/database';
import { BrandedAvatar } from '@/components/BrandedAvatar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ClientDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, client, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [todayCheckIn, setTodayCheckIn] = useState<CheckIn | null>(null);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [todayHabitLogs, setTodayHabitLogs] = useState<HabitLog[]>([]);

  useEffect(() => {
    if (client) loadDashboardData();
    else if (!authLoading) setLoading(false);
  }, [client, authLoading]);

  // Real-time subscription for dashboard updates (check-ins, habits, logs)
  useEffect(() => {
    if (!client) return;
    
    const today = new Date().toISOString().split('T')[0];
    const channel = supabase.channel('client_dashboard_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'check_ins',
          filter: `client_id=eq.${client.id}`
        },
        (payload) => {
          // If the payload date is today, update the todayCheckIn state
          if (payload.new && payload.new.date === today) {
            setTodayCheckIn(payload.new as CheckIn);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'habit_logs',
          filter: `client_id=eq.${client.id}`
        },
        () => loadDashboardData()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'habits',
          filter: `client_id=eq.${client.id}`
        },
        () => loadDashboardData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [client]);

  const loadDashboardData = async () => {
    if (!client) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      const [checkInResult, habitsResult, habitLogsResult] = await Promise.all([
        supabase.from('check_ins').select('*').eq('client_id', client.id).eq('date', today).maybeSingle(),
        supabase.from('habits').select('*').eq('client_id', client.id).eq('is_active', true),
        supabase.from('habit_logs').select('*').eq('client_id', client.id).eq('date', today),
      ]);
      
      let checkIn = checkInResult.data;

      // Auto-recover missing AI analysis for existing check-ins
      if (checkIn && !checkIn.ai_analysis) {
        try {
          const { generateText } = await import('@/lib/google-ai');
          const prompt = `Act as an elite AI fitness coach. Analyze this daily check-in:
Weight: ${checkIn.weight_kg ? checkIn.weight_kg + 'kg' : 'Not provided'}
Sleep: ${checkIn.sleep_hours ? checkIn.sleep_hours + 'hrs' : 'Not provided'}
Energy (1-10): ${checkIn.energy_level}
Stress (1-10): ${checkIn.stress_level}
Hunger (1-10): ${checkIn.hunger_level}
Mood: ${checkIn.mood}
Notes: ${checkIn.notes}

Provide exactly 2 short, punchy sentences of encouraging insight or advice based on these metrics. Be direct and premium.`;
          
          const analysis = await generateText(prompt);
          if (analysis) {
            const { data: updated } = await supabase
              .from('check_ins')
              .update({ ai_analysis: analysis.trim() })
              .eq('id', checkIn.id)
              .select()
              .single();
            if (updated) checkIn = updated;
          }
        } catch (e) {
          console.error("Auto-recovery AI Analysis failed:", e);
        }
      }

      setTodayCheckIn(checkIn);
      setHabits(habitsResult.data || []);
      setTodayHabitLogs(habitLogsResult.data || []);
    } catch (e) { console.error(e); } finally { setLoading(false); setRefreshing(false); }
  };

  const onRefresh = () => { setRefreshing(true); loadDashboardData(); };

  if (loading && !refreshing) {
    return (
      <View className="flex-1 bg-slate-950 justify-center items-center">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  const completedHabitsCount = todayHabitLogs.filter(log => log.completed).length;

  return (
    <View style={{ flex: 1 }} className="bg-slate-950">
      <StatusBar barStyle="light-content" translucent />
      <View style={{ flex: 1, paddingTop: insets.top }}>
          {/* Refined Client Header */}
          <MotiView 
              from={{ opacity: 0, translateY: -10 }}
              animate={{ opacity: 1, translateY: 0 }}
              className="px-6 py-10 flex-row items-center justify-between"
          >
              <View>
                  <Text className="text-white text-3xl font-black tracking-tighter">Good morning,</Text>
                  <Text className="text-blue-500 text-3xl font-black tracking-tighter">{profile?.full_name?.split(' ')[0]}</Text>
              </View>
              <TouchableOpacity
                onPress={() => router.push('/(client)/(tabs)/profile')}
                className="p-1.5 bg-slate-900 rounded-[24px] border border-white/5 shadow-2xl"
              >
                <BrandedAvatar size={60} name={profile?.full_name || 'U'} imageUrl={profile?.avatar_url} />
                <View className="absolute bottom-1 right-1 w-4 h-4 bg-blue-500 rounded-full border-2 border-slate-900" />
              </TouchableOpacity>
          </MotiView>

          <ScrollView 
            className="flex-1 px-3" 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 140 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" progressViewOffset={insets.top} />}
          >
            {/* Status Grid */}
            <View className="flex-row flex-wrap justify-between gap-4 mb-4">
                <MetricCard 
                  label="Coach Review" 
                  value={todayCheckIn ? 'Synced' : 'Waiting'} 
                  icon={<ClipboardCheck size={20} color="#3B82F6" />} 
                  active={!!todayCheckIn}
                  onPress={() => !todayCheckIn && router.push('/(client)/activity')}
                />
                <MetricCard 
                  label="Daily Tasks" 
                  value={`${completedHabitsCount}/${habits.length}`} 
                  icon={<Award size={20} color="#10B981" />} 
                  active={completedHabitsCount === habits.length && habits.length > 0}
                />
                <MetricCard 
                  label="Weight" 
                  value={todayCheckIn?.weight_kg ? `${todayCheckIn.weight_kg}kg` : '--'} 
                  icon={<TrendingUp size={20} color="#F59E0B" />} 
                  active={!!todayCheckIn?.weight_kg}
                />
                <MetricCard 
                  label="Vitality" 
                  value={todayCheckIn?.energy_level ? `${todayCheckIn.energy_level}/10` : '--'} 
                  icon={<Heart size={20} color="#EF4444" />} 
                  active={!!todayCheckIn?.energy_level}
                />
            </View>

            {/* Daily Call to Action / Status */}
            {!todayCheckIn ? (
                <MotiView 
                  key="checkin-cta"
                  from={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-6 overflow-hidden rounded-[40px] bg-blue-600 shadow-2xl shadow-blue-500/30 border border-white/10"
                >
                    <TouchableOpacity 
                      className="p-8"
                      onPress={() => router.push('/(client)/check-in')}
                    >
                        <View className="flex-row items-center gap-2 mb-3">
                          <Zap size={14} color="white" />
                          <Text className="text-white/80 text-[10px] font-black uppercase tracking-[3px]">Daily Goal</Text>
                        </View>
                        <Text className="text-white text-3xl font-black tracking-tight leading-8">Complete Your Check-in</Text>
                        <Text className="text-white/80 mt-3 font-medium text-sm leading-6">Update your coach on your energy, weight, and meal progress today.</Text>
                        <View className="mt-8 flex-row items-center justify-between">
                            <View className="bg-white px-5 py-2.5 rounded-full">
                                <Text className="text-blue-600 font-black text-xs uppercase tracking-widest">Start Now</Text>
                            </View>
                            <ChevronRight size={24} color="white" opacity={0.5} />
                        </View>
                    </TouchableOpacity>
                </MotiView>
            ) : !todayCheckIn.ai_analysis ? (
                <MotiView 
                  key="checkin-done"
                  from={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-6 overflow-hidden rounded-[40px] bg-slate-900 border border-blue-500/20 shadow-2xl shadow-blue-500/10 relative"
                >
                  <View className="absolute -top-24 -right-24 w-48 h-48 bg-blue-500/10 rounded-full" />
                  
                  <View className="p-8">
                      <View className="flex-row items-center gap-2 mb-3">
                        <View className="w-6 h-6 bg-blue-500/20 rounded-full items-center justify-center border border-blue-500/30">
                          <CheckCircle2 size={12} color="#3B82F6" />
                        </View>
                        <Text className="text-blue-500 text-[10px] font-black uppercase tracking-[3px]">Protocol Synced</Text>
                      </View>
                      
                      <Text className="text-white text-3xl font-black tracking-tight leading-8 mb-2">Metrics Logged</Text>
                      <Text className="text-slate-400 font-medium text-sm leading-6">Your data is securely stored. The AI and your coach are analyzing your progress.</Text>
                      
                      <View className="mt-8 flex-row items-center justify-between">
                          <MotiView
                              from={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: 400 }}
                              className="flex-row items-center gap-2 bg-blue-500/10 px-4 py-2 rounded-full border border-blue-500/20"
                          >
                              <ActivityIndicator size="small" color="#3B82F6" />
                              <Text className="text-blue-400 font-black text-[10px] uppercase tracking-widest">AI Processing</Text>
                          </MotiView>
                          
                          <View className="flex-row items-center">
                            <View className="w-8 h-8 rounded-full bg-slate-800 border-2 border-slate-900 items-center justify-center z-20">
                              <Brain size={14} color="#818CF8" />
                            </View>
                            <View className="w-8 h-8 rounded-full bg-slate-800 border-2 border-slate-900 items-center justify-center z-10 -ml-2">
                              <Zap size={14} color="#F59E0B" />
                            </View>
                          </View>
                      </View>
                  </View>
                </MotiView>
            ) : null}

            {/* Coach's Insights */}
            {todayCheckIn?.ai_analysis && (
                <MotiView 
                  from={{ opacity: 0, translateY: 10 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  className="mt-10 p-8 rounded-[48px] bg-slate-900 border border-white/5 shadow-xl"
                >
                    <View className="flex-row items-center gap-4 mb-8">
                        <View className="w-12 h-12 bg-blue-600/10 border border-blue-600/20 rounded-2xl items-center justify-center">
                            <Brain size={24} color="#3B82F6" />
                        </View>
                        <View>
                          <Text className="text-white font-black text-lg tracking-tight">Today's Strategy</Text>
                          <Text className="text-slate-500 text-[9px] font-black uppercase tracking-widest">Feedback Loop</Text>
                        </View>
                    </View>
                    <Text className="text-slate-200 leading-7 font-medium text-lg">
                        {todayCheckIn.ai_analysis}
                    </Text>
                    <View className="mt-8 pt-8 border-t border-white/5 flex-row items-center gap-2">
                        <Sparkles size={16} color="#818CF8" />
                        <Text className="text-slate-600 text-[10px] font-black uppercase tracking-[3px]">AI-Assisted Guidance</Text>
                    </View>
                </MotiView>
            )}

            {/* Quick Actions Grid */}
            <View className="mt-12">
                <Text className="text-white text-2xl font-black tracking-tighter mb-8 px-1">Quick Access</Text>
                <View className="flex-row gap-4">
                    <ActionCard 
                        label="Log Meal" 
                        sub="Photo Analysis"
                        icon={<Camera size={28} color="#3B82F6" />} 
                        onPress={() => router.push('/(client)/log-meal')}
                    />
                    <ActionCard 
                        label="Challenges" 
                        sub="Active Goals"
                        icon={<Award size={28} color="#10B981" />} 
                        onPress={() => router.push('/(client)/challenges')}
                    />
                </View>
            </View>
          </ScrollView>
      </View>
    </View>
  );
}

const MetricCard = ({ label, value, icon, active, onPress }: any) => (
    <TouchableOpacity 
        onPress={onPress}
        disabled={!onPress}
        className={`w-[47%] p-6 rounded-[36px] border-2 transition-all shadow-lg ${active ? 'bg-slate-900/50 border-white/10' : 'bg-slate-900/20 border-white/5 border-dashed'}`}
    >
        <View className="w-12 h-12 bg-slate-950 rounded-2xl items-center justify-center border border-white/5 mb-6 shadow-sm">
            {icon}
        </View>
        <Text className="text-white text-xl font-black tracking-tight">{value}</Text>
        <Text className="text-slate-500 text-[9px] font-black uppercase tracking-widest mt-1.5">{label}</Text>
    </TouchableOpacity>
);

const ActionCard = ({ label, sub, icon, onPress }: any) => (
    <TouchableOpacity 
        onPress={onPress}
        className="flex-1 bg-slate-900/40 p-8 rounded-[40px] border border-white/5 items-center justify-center gap-4 shadow-xl"
    >
        <View className="w-16 h-16 bg-slate-950 rounded-[24px] items-center justify-center border border-white/5 shadow-inner">
            {icon}
        </View>
        <View className="items-center">
            <Text className="text-white font-black text-lg tracking-tight">{label}</Text>
            <Text className="text-slate-600 text-[9px] font-black uppercase tracking-widest mt-1">{sub}</Text>
        </View>
    </TouchableOpacity>
);
