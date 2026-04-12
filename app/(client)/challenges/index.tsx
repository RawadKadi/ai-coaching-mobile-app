import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert, ActivityIndicator, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Target, CheckCircle, Circle, Lock, ChevronRight, Zap, Info, MessageSquare, ArrowLeft } from 'lucide-react-native';
import { useTheme } from '@/contexts/BrandContext';
import type { TodaysSubChallenge } from '@/types/challenges-v3';

export default function ClientChallengesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const theme = useTheme();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [todaysChallenges, setTodaysChallenges] = useState<TodaysSubChallenge[]>([]);
  const [upcomingChallenges, setUpcomingChallenges] = useState<any[]>([]);
  const [coachName, setCoachName] = useState('');

  useEffect(() => { loadChallenges(); }, []);

  // Real-time listener for sub_challenges updates
  useEffect(() => {
    if (!user) return;

    const channelId = `dashboard-challenges-realtime-${user.id}`;
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sub_challenges'
        },
        async (payload) => {
          // Refresh list when any challenge state changes
          loadChallenges();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

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
    if (!acc[key]) acc[key] = { 
        motherId: sub.mother_challenge_id, 
        motherName: sub.mother_name, 
        subs: [] 
    };
    acc[key].subs.push(sub);
    return acc;
  }, {} as Record<string, { motherId: string; motherName: string; subs: TodaysSubChallenge[] }>);

  const motherChallenges = Object.values(grouped);
  const completedCount = todaysChallenges.filter(s => s.completed).length;
  const totalCount = todaysChallenges.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <View style={{ flex: 1, backgroundColor: '#020617' }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView 
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#3B82F6" />}
          showsVerticalScrollIndicator={false}
        >
            {/* Header Content */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingTop: 40, paddingBottom: 16 }}>
                <TouchableOpacity 
                    onPress={() => router.back()} 
                    style={{ padding: 12, backgroundColor: '#0f172a', borderRadius: 16, borderWidth: 1, borderColor: '#1e293b', marginRight: 16 }}
                >
                    <ArrowLeft size={20} color="#94A3B8" />
                </TouchableOpacity>
                <View>
                    <Text style={{ color: 'white', fontSize: 24, fontWeight: '900' }}>Daily Missions</Text>
                    <Text style={{ color: '#64748b', fontWeight: 'bold', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.5 }}>
                        {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                    </Text>
                </View>
            </View>

            {/* Progress Engine Card */}
            <View style={{ paddingHorizontal: 24, marginBottom: 32 }}>
                <View style={{ backgroundColor: '#0f172a80', borderWidth: 1, borderColor: '#0f172a', borderRadius: 32, padding: 24 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <View style={{ width: 32, height: 32, borderRadius: 12, backgroundColor: '#3b82f61a', alignItems: 'center', justifyContent: 'center' }}>
                                <Zap size={16} color="#3B82F6" />
                            </View>
                            <Text style={{ color: 'white', fontWeight: '900' }}>Deployment Status</Text>
                        </View>
                        <Text style={{ color: '#3B82F6', fontWeight: '900', fontSize: 18 }}>{Math.round(progressPercent)}%</Text>
                    </View>
                    <View style={{ height: 8, backgroundColor: '#020617', borderRadius: 999, overflow: 'hidden' }}>
                        <View 
                            style={{ height: '100%', backgroundColor: '#2563eb', borderRadius: 999, width: `${progressPercent}%` }}
                        />
                    </View>
                    <Text style={{ color: '#475569', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 16 }}>
                        {completedCount} of {totalCount} objectives secured
                    </Text>
                </View>
            </View>

            {/* Mother Groupings */}
            {motherChallenges.length === 0 ? (
                <View style={{ marginHorizontal: 24, padding: 48, backgroundColor: '#0f172a4d', borderRadius: 32, borderWidth: 1, borderColor: '#0f172a', alignItems: 'center' }}>
                    <Target size={48} color="#1E293B" />
                    <Text style={{ color: '#475569', fontWeight: 'bold', marginTop: 16, fontStyle: 'italic' }}>No protocols active for local sector</Text>
                </View>
            ) : (
                motherChallenges.map((mother, mIdx) => (
                    <View key={mother.motherId} style={{ marginBottom: 32 }}>
                        <TouchableOpacity 
                            onPress={() => router.push(`/(client)/challenges/${mother.motherId}`)}
                            style={{ paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}
                        >
                            <View style={{ width: 4, height: 16, backgroundColor: '#2563eb', borderRadius: 999 }} />
                            <Text style={{ color: '#94a3b8', fontWeight: '900', fontSize: 14, textTransform: 'uppercase', letterSpacing: 1.5, flex: 1 }}>{mother.motherName}</Text>
                            <ChevronRight size={14} color="#475569" />
                        </TouchableOpacity>
                        <View style={{ paddingHorizontal: 24, gap: 12 }}>
                            {mother.subs.map((sub, sIdx) => (
                                <TouchableOpacity 
                                    key={sub.id}
                                    onPress={() => toggleSubChallenge(sub)}
                                    style={{ 
                                        flexDirection: 'row', 
                                        alignItems: 'flex-start', 
                                        padding: 20, 
                                        borderRadius: 32, 
                                        borderWidth: 2, 
                                        backgroundColor: sub.completed ? '#0f172a' : '#0f172a4d',
                                        borderColor: sub.completed ? '#1e293b' : '#0f172a',
                                        opacity: sub.completed ? 0.6 : 1
                                    }}
                                >
                                    <Text style={{ fontSize: 24, marginRight: 16 }}>{getFocusEmoji(sub.focus_type)}</Text>
                                    <View style={{ flex: 1, paddingRight: 8 }}>
                                        <Text style={{ fontSize: 16, fontWeight: '900', color: sub.completed ? '#64748b' : 'white', textDecorationLine: sub.completed ? 'line-through' : 'none' }}>{sub.name}</Text>
                                        <Text style={{ color: '#64748b', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 4 }}>
                                            {sub.focus_type} • {sub.intensity}
                                        </Text>
                                    </View>
                                    <View style={{ paddingTop: 4 }}>
                                        {sub.completed ? (
                                            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center' }}>
                                                <CheckCircle size={16} color="white" />
                                            </View>
                                        ) : (
                                            <View style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: '#1e293b', alignItems: 'center', justifyContent: 'center' }}>
                                                <Info size={12} color="#1E293B" />
                                            </View>
                                        )}
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                ))
            )}

            {/* Upcoming protocols */}
            {upcomingChallenges.length > 0 && (
                <View style={{ paddingHorizontal: 24, marginTop: 16 }}>
                    <Text style={{ color: '#475569', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 16, paddingHorizontal: 4 }}>Upcoming Sequences</Text>
                    {upcomingChallenges.map((c, i) => (
                        <View key={c.id} style={{ padding: 20, backgroundColor: '#0f172a33', borderRadius: 28, borderWidth: 1, borderColor: '#0f172a', marginBottom: 8, opacity: 0.5, flexDirection: 'row', alignItems: 'center' }}>
                            <Lock size={16} color="#475569" style={{ marginRight: 16 }} />
                            <Text style={{ color: '#94a3b8', fontWeight: 'bold', flex: 1 }}>{c.name}</Text>
                            <Text style={{ color: '#475569', fontSize: 10, fontWeight: '900' }}>LOCKED</Text>
                        </View>
                    ))}
                </View>
            )}

            {/* Coach Signal */}
            {coachName ? (
                <View style={{ marginHorizontal: 24, marginTop: 48, marginBottom: 48, padding: 24, backgroundColor: '#2563eb0d', borderRadius: 32, borderWidth: 1, borderColor: '#2563eb1a', flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: '#2563eb1a', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                        <MessageSquare size={20} color="#3B82F6" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={{ color: '#3B82F6', fontWeight: '900', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.5 }}>Signal from {coachName}</Text>
                        <Text style={{ color: '#94a3b8', fontWeight: 'bold', marginTop: 4, fontSize: 14, fontStyle: 'italic' }}>"Complete today's protocols to advance to the next stage."</Text>
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
