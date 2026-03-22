import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert, ActivityIndicator, SafeAreaView } from 'react-native';
import { MotiView } from 'moti';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Target, CheckCircle, Circle, Lock, ChevronRight, Zap, Info, MessageSquare } from 'lucide-react-native';
import { useTheme } from '@/contexts/BrandContext';
import type { TodaysSubChallenge } from '@/types/challenges-v3';

export default function ClientChallengesScreen() {
  const { user } = useAuth();
  const theme = useTheme();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [todaysChallenges, setTodaysChallenges] = useState<TodaysSubChallenge[]>([]);
  const [upcomingChallenges, setUpcomingChallenges] = useState<any[]>([]);
  const [coachName, setCoachName] = useState('');

  useEffect(() => { loadChallenges(); }, []);

  const loadChallenges = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const { data: clientData } = await supabase.from('clients').select('id').eq('user_id', user.id).single();
      if (!clientData) return;

      const today = new Date().toISOString().split('T')[0];
      const { data: todaysData } = await supabase.rpc('get_todays_sub_challenges', { p_client_id: clientData.id, p_date: today });
      setTodaysChallenges(todaysData || []);

      const { data: upcomingData } = await supabase.rpc('get_client_mother_challenges', { p_client_id: clientData.id, p_status: 'upcoming' });
      setUpcomingChallenges(upcomingData || []);

      if (todaysData?.length > 0) {
        const { data: motherData } = await supabase.from('mother_challenges').select('coach_id').eq('id', todaysData[0].mother_challenge_id).single();
        if (motherData) {
          const { data: coachData } = await supabase.from('coaches').select('profiles:user_id(full_name)').eq('id', motherData.coach_id).single();
          if (coachData) {
            const p: any = coachData.profiles;
            setCoachName(p?.full_name || 'Coach');
          }
        }
      }
    } catch (e) { console.error(e); } finally { setLoading(false); setRefreshing(false); }
  };

  const handleRefresh = () => { setRefreshing(true); loadChallenges(); };

  const toggleSubChallenge = async (sub: TodaysSubChallenge) => {
    try {
      const newCompleted = !sub.completed;
      setTodaysChallenges(prev => prev.map(s => s.id === sub.id ? { ...s, completed: newCompleted } : s));
      const { data: cData } = await supabase.from('clients').select('id').eq('user_id', user!.id).single();
      if (!cData) return;
      await supabase.rpc('mark_sub_challenge', { p_sub_challenge_id: sub.id, p_client_id: cData.id, p_completed: newCompleted });
    } catch (e) { loadChallenges(); }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-slate-950 justify-center items-center">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  const grouped = todaysChallenges.reduce((acc, sub) => {
    const key = sub.mother_challenge_id;
    if (!acc[key]) acc[key] = { motherName: sub.mother_name, subs: [] };
    acc[key].subs.push(sub);
    return acc;
  }, {} as Record<string, { motherName: string; subs: TodaysSubChallenge[] }>);

  const motherChallenges = Object.values(grouped);
  const completedCount = todaysChallenges.filter(s => s.completed).length;
  const totalCount = todaysChallenges.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <View className="flex-1 bg-slate-950">
      <SafeAreaView className="flex-1">
        <ScrollView className="flex-1" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#3B82F6" />}>
            {/* Header Content */}
            <MotiView from={{ opacity: 0, translateY: -10 }} animate={{ opacity: 1, translateY: 0 }} className="px-6 pt-10 pb-6">
                <Text className="text-white text-3xl font-black">Daily Missions</Text>
                <Text className="text-slate-500 font-bold text-xs uppercase tracking-widest mt-1">
                    {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                </Text>
            </MotiView>

            {/* Progress Engine Card */}
            <View className="px-6 mb-8">
                <View className="bg-slate-900/50 border border-slate-900 rounded-[32px] p-6">
                    <View className="flex-row justify-between items-center mb-4">
                        <View className="flex-row items-center gap-2">
                            <View className="w-8 h-8 rounded-xl bg-blue-600/10 items-center justify-center">
                                <Zap size={16} color="#3B82F6" />
                            </View>
                            <Text className="text-white font-black">Deployment Status</Text>
                        </View>
                        <Text className="text-blue-500 font-black text-lg">{Math.round(progressPercent)}%</Text>
                    </View>
                    <View className="h-2 bg-slate-950 rounded-full overflow-hidden">
                        <MotiView 
                            from={{ width: '0%' }}
                            animate={{ width: `${progressPercent}%` }}
                            className="h-full bg-blue-600 rounded-full"
                        />
                    </View>
                    <Text className="text-slate-600 text-[10px] font-bold uppercase tracking-widest mt-4">
                        {completedCount} of {totalCount} objectives secured
                    </Text>
                </View>
            </View>

            {/* Mother Groupings */}
            {motherChallenges.length === 0 ? (
                <View className="mx-6 p-12 bg-slate-900/30 rounded-[32px] border border-slate-900 items-center">
                    <Target size={48} color="#1E293B" />
                    <Text className="text-slate-600 font-bold mt-4 italic">No protocols active for local sector</Text>
                </View>
            ) : (
                motherChallenges.map((mother, mIdx) => (
                    <View key={mother.motherName} className="mb-8">
                        <View className="px-6 flex-row items-center gap-3 mb-4">
                            <View className="w-1 h-4 bg-blue-600 rounded-full" />
                            <Text className="text-slate-400 font-black text-sm uppercase tracking-widest">{mother.motherName}</Text>
                        </View>
                        <View className="px-6 space-y-3">
                            {mother.subs.map((sub, sIdx) => (
                                <MotiView 
                                    key={sub.id}
                                    from={{ opacity: 0, translateX: -20 }}
                                    animate={{ opacity: 1, translateX: 0 }}
                                    transition={{ delay: (mIdx * 100) + (sIdx * 50) }}
                                >
                                    <TouchableOpacity 
                                        onPress={() => toggleSubChallenge(sub)}
                                        className={`flex-row items-start p-5 rounded-[32px] border-2 ${sub.completed ? 'bg-slate-900 border-slate-800 opacity-60' : 'bg-slate-900/30 border-slate-900'}`}
                                    >
                                        <Text className="text-2xl mr-4">{getFocusEmoji(sub.focus_type)}</Text>
                                        <View className="flex-1 pr-2">
                                            <Text className={`text-base font-black ${sub.completed ? 'text-slate-500 line-through' : 'text-white'}`}>{sub.name}</Text>
                                            <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1">
                                                {sub.focus_type} • {sub.intensity}
                                            </Text>
                                        </View>
                                        <View className="pt-1">
                                            {sub.completed ? (
                                                <View className="w-7 h-7 rounded-full bg-blue-600 items-center justify-center">
                                                    <CheckCircle size={16} color="white" />
                                                </View>
                                            ) : (
                                                <View className="w-7 h-7 rounded-full border-2 border-slate-800 items-center justify-center">
                                                    <Info size={12} color="#1E293B" />
                                                </View>
                                            )}
                                        </View>
                                    </TouchableOpacity>
                                </MotiView>
                            ))}
                        </View>
                    </View>
                ))
            )}

            {/* Upcoming protocols */}
            {upcomingChallenges.length > 0 && (
                <View className="px-6 mt-4">
                    <Text className="text-slate-600 text-[10px] font-black uppercase tracking-widest mb-4 px-1">Upcoming Sequences</Text>
                    {upcomingChallenges.map((c, i) => (
                        <View key={c.id} className="p-5 bg-slate-900/20 rounded-[28px] border border-slate-900 mb-2 opacity-50 flex-row items-center">
                            <Lock size={16} color="#475569" className="mr-4" />
                            <Text className="text-slate-400 font-bold flex-1">{c.name}</Text>
                            <Text className="text-slate-600 text-[10px] font-black">LOCKED</Text>
                        </View>
                    ))}
                </View>
            )}

            {/* Coach Signal */}
            {coachName ? (
                <View className="mx-6 mt-12 mb-12 p-6 bg-blue-600/5 rounded-[32px] border border-blue-600/10 flex-row items-center">
                    <View className="w-12 h-12 rounded-2xl bg-blue-600/10 items-center justify-center mr-4">
                        <MessageSquare size={20} color="#3B82F6" />
                    </View>
                    <View className="flex-1">
                        <Text className="text-blue-500 font-black text-xs uppercase tracking-widest">Signal from {coachName}</Text>
                        <Text className="text-slate-400 font-bold mt-1 text-sm italic">"Complete today's protocols to advance to the next stage."</Text>
                    </View>
                </View>
            ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function getFocusEmoji(focusType: string): string {
  const emojis: Record<string, string> = { training: '💪', nutrition: '🥗', recovery: '😴', consistency: '🎯' };
  return emojis[focusType] || '🎯';
}
