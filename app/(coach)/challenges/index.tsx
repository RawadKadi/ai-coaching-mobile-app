import React, { useState, useCallback, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { MotiView, MotiText, AnimatePresence } from 'moti';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Target, Sparkles, Clock, ChevronRight, Activity, TrendingUp } from 'lucide-react-native';
import type { MotherChallengeWithProgress } from '@/types/challenges-v3';

export default function CoachChallengesDashboard() {
  const router = useRouter();
  const { user, coach } = useAuth();

  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeChallenges, setActiveChallenges] = useState<MotherChallengeWithProgress[]>([]);
  const [historyChallenges, setHistoryChallenges] = useState<MotherChallengeWithProgress[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadChallenges();
    }, [coach])
  );

  useEffect(() => {
    if (!user) return;
    const subscription = supabase
      .channel('sub-challenges-updates')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sub_challenges' }, () => {
          loadChallenges();
      })
      .subscribe();
    return () => { supabase.removeChannel(subscription); };
  }, [user]);

  const loadChallenges = async () => {
    if (!coach) return;
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_coach_mother_challenges', {
        p_coach_id: coach.id,
      });
      if (error) throw error;
      const active = (data || []).filter((c: any) => c.status === 'active');
      const history = (data || []).filter((c: any) => c.status !== 'active');
      setActiveChallenges(active);
      setHistoryChallenges(history);
    } catch (error) {
      console.error('Error loading challenges:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadChallenges();
  };

  if (loading && !refreshing) {
    return (
      <View className="flex-1 bg-slate-950 justify-center items-center">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  const challenges = activeTab === 'active' ? activeChallenges : historyChallenges;

  return (
    <View className="flex-1 bg-slate-950">
      {/* Header */}
      <View className="px-6 pt-20 pb-6 flex-row justify-between items-center bg-slate-950 shadow-2xl z-10">
        <View>
          <Text className="text-slate-400 text-sm font-semibold uppercase tracking-widest">Growth Tracking</Text>
          <Text className="text-white text-3xl font-bold mt-1">Challenges</Text>
        </View>
        <TouchableOpacity 
          className="w-12 h-12 bg-blue-600 rounded-full items-center justify-center shadow-lg"
          onPress={() => router.push('/(coach)/challenges/suggest')}
        >
          <Sparkles size={22} color="white" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View className="px-6 py-4 flex-row gap-4">
        <TabButton 
          title="Active Plans" 
          active={activeTab === 'active'} 
          count={activeChallenges.length}
          onPress={() => setActiveTab('active')} 
        />
        <TabButton 
          title="Past History" 
          active={activeTab === 'history'} 
          count={historyChallenges.length}
          onPress={() => setActiveTab('history')} 
        />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#3B82F6" />}
      >
        <AnimatePresence>
          {challenges.length === 0 ? (
            <MotiView 
              from={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="px-6 mt-12 items-center"
            >
              <View className="w-20 h-20 bg-slate-900 rounded-full items-center justify-center border border-slate-800 mb-6">
                <Target size={32} color="#475569" />
              </View>
              <Text className="text-white text-xl font-bold mb-2">No {activeTab} challenges</Text>
              <Text className="text-slate-500 text-center px-8 leading-5">
                {activeTab === 'active' 
                  ? "Launch an AI-assisted training plan to keep your clients engaged." 
                  : "Completed plans will appear in your history tab."
                }
              </Text>
              <TouchableOpacity 
                className="mt-8 bg-slate-900 border border-slate-800 py-3 px-8 rounded-2xl"
                onPress={() => router.push('/(coach)/challenges/create')}
              >
                <Text className="text-white font-bold">Create Manually</Text>
              </TouchableOpacity>
            </MotiView>
          ) : (
            challenges.map((challenge, index) => (
              <ChallengeCard key={challenge.id} challenge={challenge} index={index} />
            ))
          )}
        </AnimatePresence>
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity 
        className="absolute bottom-8 right-6 w-14 h-14 bg-blue-600 rounded-full items-center justify-center shadow-2xl elevation-5"
        onPress={() => router.push('/(coach)/challenges/create')}
      >
        <Plus size={28} color="white" />
      </TouchableOpacity>
    </View>
  );
}

const TabButton = ({ title, active, count, onPress }: any) => (
  <TouchableOpacity 
    onPress={onPress}
    className={`px-6 py-3 rounded-2xl flex-row items-center gap-3 border ${active ? 'bg-blue-600/10 border-blue-500/20' : 'bg-slate-900 border-slate-800'}`}
  >
    <Text className={`font-bold ${active ? 'text-blue-400' : 'text-slate-500'}`}>{title}</Text>
    {count > 0 && (
      <View className={`px-2 py-0.5 rounded-lg ${active ? 'bg-blue-500' : 'bg-slate-800'}`}>
         <Text className="text-white text-[10px] font-bold">{count}</Text>
      </View>
    )}
  </TouchableOpacity>
);

const ChallengeCard = ({ challenge, index }: { challenge: MotherChallengeWithProgress, index: number }) => {
  const router = useRouter();
  
  return (
    <MotiView
      from={{ opacity: 0, translateY: 20 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ delay: index * 100 }}
      className="mx-6 mt-4 bg-slate-900 rounded-[32px] border border-slate-800 overflow-hidden shadow-xl"
    >
      <TouchableOpacity onPress={() => router.push(`/(coach)/challenges/${challenge.id}`)}>
        <View className="p-6">
          <View className="flex-row justify-between items-start mb-6">
            <View className="flex-1">
              <View className="flex-row items-center gap-2 mb-1">
                {challenge.created_by === 'ai' && (
                  <View className="bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-md flex-row items-center gap-1">
                    <Sparkles size={10} color="#818CF8" />
                    <Text className="text-indigo-400 text-[10px] font-bold uppercase">AI Plan</Text>
                  </View>
                )}
                <Text className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">In Progress</Text>
              </View>
              <Text className="text-white text-xl font-bold leading-tight">Manage {challenge.client_name.split(' ')[0]}'s Training Plan</Text>
              <Text className="text-slate-400 text-sm mt-1">{challenge.name}</Text>
            </View>
            <TouchableOpacity className="w-10 h-10 bg-slate-950 rounded-full items-center justify-center border border-slate-800">
              <ChevronRight size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Stats Bar */}
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center gap-2">
               <Activity size={14} color="#3B82F6" />
               <Text className="text-slate-500 text-xs font-medium">Completion Rate</Text>
            </View>
            <Text className="text-white font-bold text-sm">{challenge.completion_rate}%</Text>
          </View>

          {/* Progress Visualization */}
          <View className="h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
             <View 
                className="h-full bg-blue-500 rounded-full" 
                style={{ width: `${challenge.completion_rate}%` }} 
             />
          </View>
          
          <View className="flex-row justify-between items-center mt-6 pt-6 border-t border-slate-950">
             <View className="flex-row items-center gap-3">
                <View className="w-8 h-8 rounded-full bg-slate-800 items-center justify-center border border-slate-700">
                   <Clock size={16} color="#94A3B8" />
                </View>
                <View>
                   <Text className="text-slate-300 text-xs font-bold">Next Deadline</Text>
                   <Text className="text-slate-500 text-[10px]">Tomorrow at 10:00 AM</Text>
                </View>
             </View>
             <View className="flex-row -space-x-2">
                {[1, 2, 3].map(i => (
                  <View key={i} className={`w-6 h-6 rounded-full border-2 border-slate-900 ${i === 1 ? 'bg-blue-500' : 'bg-slate-700'}`} />
                ))}
             </View>
          </View>
        </View>
      </TouchableOpacity>
    </MotiView>
  );
};
