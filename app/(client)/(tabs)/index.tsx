import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, SafeAreaView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { MotiView, AnimatePresence } from 'moti';
import { Calendar, TrendingUp, Target, Heart, Camera, ChevronRight, Zap, Brain, Sparkles } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { CheckIn, Habit, HabitLog } from '@/types/database';
import { BrandedAvatar } from '@/components/BrandedAvatar';

export default function ClientDashboard() {
  const router = useRouter();
  const { profile, client, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [todayCheckIn, setTodayCheckIn] = useState<CheckIn | null>(null);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [todayHabitLogs, setTodayHabitLogs] = useState<HabitLog[]>([]);

  useEffect(() => {
    if (client) loadDashboardData();
    else if (!authLoading) setLoading(false);
  }, [client, authLoading]);

  const loadDashboardData = async () => {
    if (!client) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      const [checkInResult, habitsResult, habitLogsResult] = await Promise.all([
        supabase.from('check_ins').select('*').eq('client_id', client.id).eq('date', today).maybeSingle(),
        supabase.from('habits').select('*').eq('client_id', client.id).eq('is_active', true),
        supabase.from('habit_logs').select('*').eq('client_id', client.id).eq('date', today),
      ]);
      setTodayCheckIn(checkInResult.data);
      setHabits(habitsResult.data || []);
      setTodayHabitLogs(habitLogsResult.data || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-slate-950 justify-center items-center">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  const completedHabitsCount = todayHabitLogs.filter(log => log.completed).length;

  return (
    <View className="flex-1 bg-slate-950">
      <SafeAreaView className="flex-1">
        {/* Animated Header */}
        <MotiView 
            from={{ opacity: 0, translateY: -20 }}
            animate={{ opacity: 1, translateY: 0 }}
            className="px-6 pt-8 pb-4 flex-row items-center justify-between"
        >
            <View>
                <Text className="text-white text-3xl font-black">Morning, {profile?.full_name?.split(' ')[0]}</Text>
                <Text className="text-slate-500 font-bold text-xs uppercase tracking-widest mt-1">
                    {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                </Text>
            </View>
            <BrandedAvatar size={52} name={profile?.full_name || 'U'} imageUrl={profile?.avatar_url} />
        </MotiView>

        <ScrollView className="flex-1 px-6 mt-4" showsVerticalScrollIndicator={false}>
          {/* Key Metrics Mosaic */}
          <View className="flex-row flex-wrap justify-between gap-4">
              <MetricCard 
                label="Check-in" 
                value={todayCheckIn ? 'Locked' : 'Empty'} 
                icon={<Calendar size={20} color="#3B82F6" />} 
                active={!!todayCheckIn}
                onPress={() => !todayCheckIn && router.push('/(client)/activity')}
              />
              <MetricCard 
                label="Missions" 
                value={`${completedHabitsCount}/${habits.length}`} 
                icon={<Target size={20} color="#10B981" />} 
                active={completedHabitsCount === habits.length && habits.length > 0}
              />
              <MetricCard 
                label="Body Mass" 
                value={todayCheckIn?.weight_kg ? `${todayCheckIn.weight_kg}kg` : '--'} 
                icon={<TrendingUp size={20} color="#F59E0B" />} 
                active={!!todayCheckIn?.weight_kg}
              />
              <MetricCard 
                label="Metabolism" 
                value={todayCheckIn?.energy_level ? `${todayCheckIn.energy_level}/10` : '--'} 
                icon={<Heart size={20} color="#EF4444" />} 
                active={!!todayCheckIn?.energy_level}
              />
          </View>

          {/* Critical Path Action */}
          {!todayCheckIn && (
              <MotiView 
                from={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="mt-8 overflow-hidden rounded-[32px] bg-blue-600 shadow-2xl shadow-blue-500/20"
              >
                  <TouchableOpacity 
                    className="p-8 relative"
                    onPress={() => router.push('/(client)/activity')}
                  >
                      <View className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl" />
                      <View className="flex-row items-center gap-2 mb-2">
                        <Zap size={16} color="white" />
                        <Text className="text-white/80 text-[10px] font-black uppercase tracking-[2px]">Primary Protocol</Text>
                      </View>
                      <Text className="text-white text-2xl font-black">Sync Daily Progress</Text>
                      <Text className="text-white/70 mt-2 font-medium">Your coach is waiting for today's state analysis.</Text>
                      <View className="mt-6 flex-row items-center gap-2">
                          <Text className="text-white font-bold">Initialize Sync</Text>
                          <ChevronRight size={18} color="white" />
                      </View>
                  </TouchableOpacity>
              </MotiView>
          )}

          {/* AI Strategy Insights */}
          {todayCheckIn?.ai_analysis && (
              <MotiView 
                from={{ opacity: 0, translateY: 10 }}
                animate={{ opacity: 1, translateY: 0 }}
                className="mt-8 p-8 rounded-[40px] bg-slate-900 border border-slate-800"
              >
                  <View className="flex-row items-center gap-3 mb-6">
                      <View className="w-10 h-10 bg-slate-950 border border-slate-800 rounded-xl items-center justify-center">
                          <Brain size={20} color="#818CF8" />
                      </View>
                      <View>
                        <Text className="text-white font-black text-sm">Neural Insights</Text>
                        <Text className="text-slate-500 text-[10px] font-bold uppercase">Today's Strategy</Text>
                      </View>
                  </View>
                  <Text className="text-slate-300 leading-6 font-medium text-base">
                      {todayCheckIn.ai_analysis}
                  </Text>
                  <View className="mt-6 pt-6 border-t border-slate-800 flex-row items-center gap-2">
                      <Sparkles size={14} color="#818CF8" />
                      <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Analysis active</Text>
                  </View>
              </MotiView>
          )}

          {/* Quick Logic Grid */}
          <View className="mt-10 pb-12">
              <Text className="text-white text-lg font-bold mb-6 px-1">Quick Access</Text>
              <View className="flex-row gap-4">
                  <ActionCard 
                    label="Log Meal" 
                    icon={<Camera size={24} color="#3B82F6" />} 
                    onPress={() => router.push('/(client)/log-meal')}
                  />
                  <ActionCard 
                    label="Challenges" 
                    icon={<Target size={24} color="#10B981" />} 
                    onPress={() => router.push('/(client)/challenges')}
                  />
              </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const MetricCard = ({ label, value, icon, active, onPress }: any) => (
    <TouchableOpacity 
        onPress={onPress}
        disabled={!onPress}
        className={`w-[47%] p-5 rounded-[28px] border-2 transition-all ${active ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-900/20 border-slate-900 border-dashed'}`}
    >
        <View className="w-10 h-10 bg-slate-950 rounded-xl items-center justify-center border border-slate-800 mb-4 shadow-sm">
            {icon}
        </View>
        <Text className="text-white text-lg font-black">{value}</Text>
        <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1">{label}</Text>
    </TouchableOpacity>
);

const ActionCard = ({ label, icon, onPress }: any) => (
    <TouchableOpacity 
        onPress={onPress}
        className="flex-1 bg-slate-900 p-6 rounded-[32px] border border-slate-800 items-center justify-center gap-3 shadow-md"
    >
        <View className="w-12 h-12 bg-slate-950 rounded-full items-center justify-center border border-slate-800">
            {icon}
        </View>
        <Text className="text-white font-bold">{label}</Text>
    </TouchableOpacity>
);
