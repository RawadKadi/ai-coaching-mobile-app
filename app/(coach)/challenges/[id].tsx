import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MotiView, MotiText, AnimatePresence } from 'moti';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, X, AlertCircle, CheckCircle, Calendar, Target, Clock, Dumbbell, Apple, Moon, Zap, ChevronRight } from 'lucide-react-native';

export default function ChallengeDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [challenge, setChallenge] = useState<any>(null);

  useEffect(() => {
    loadChallengeDetails();
    if (!id) return;
    const subscription = supabase
      .channel(`challenge-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sub_challenges', filter: `mother_challenge_id=eq.${id}` }, (payload) => {
          setChallenge((current: any) => {
            if (!current) return current;
            const updatedSubChallenges = current.sub_challenges.map((sub: any) => sub.id === payload.new.id ? { ...sub, completed: payload.new.completed, completed_at: payload.new.completed_at } : sub);
            return { ...current, sub_challenges: updatedSubChallenges };
          });
      })
      .subscribe();
    return () => { supabase.removeChannel(subscription); };
  }, [id]);

  const loadChallengeDetails = async () => {
    if (!id || !user) return;
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_mother_challenge_details', { p_mother_challenge_id: id });
      if (error) throw error;
      if (!data || data.length === 0) { router.back(); return; }
      setChallenge(data[0]);
    } catch (error) {
      console.error('Error loading challenge:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    Alert.alert('Cancel Challenge', 'Are you sure you want to cancel this challenge?', [
      { text: 'No', style: 'cancel' },
      { text: 'Yes, Cancel', style: 'destructive', onPress: async () => {
          try {
            await supabase.rpc('cancel_mother_challenge', { p_mother_challenge_id: id });
            router.back();
          } catch (e) {
            Alert.alert('Error', 'Failed to cancel');
          }
      }},
    ]);
  };

  if (loading) {
    return (
      <View className="flex-1 bg-slate-950 justify-center items-center">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (!challenge) return null;

  const completedCount = challenge.sub_challenges?.filter((s: any) => s.completed).length || 0;
  const totalCount = challenge.sub_challenges?.length || 0;
  const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <View className="flex-1 bg-slate-950">
      {/* Header */}
      <View className="px-6 pt-16 pb-6 flex-row items-center gap-4 bg-slate-950 border-b border-slate-900">
        <TouchableOpacity onPress={() => router.back()} className="p-2 bg-slate-900 rounded-full">
          <ArrowLeft size={20} color="#94A3B8" />
        </TouchableOpacity>
        <View className="flex-1">
           <Text className="text-white text-xl font-bold" numberOfLines={1}>{challenge.name}</Text>
           <Text className="text-slate-500 text-xs font-medium">Tracking {challenge.client_name.split(' ')[0]}'s progress</Text>
        </View>
        <TouchableOpacity onPress={handleCancel} className="p-2 bg-red-500/10 rounded-full border border-red-500/20">
          <X size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        {/* Performance Overview */}
        <MotiView 
          from={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mx-6 mt-8 bg-slate-900 p-6 rounded-[32px] border border-slate-800"
        >
          <View className="flex-row justify-between items-center mb-6">
            <View className="bg-blue-600/10 border border-blue-500/20 px-3 py-1 rounded-full">
              <Text className="text-blue-400 text-[10px] font-bold uppercase tracking-widest">Active Phase</Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Calendar size={14} color="#64748B" />
              <Text className="text-slate-500 text-xs font-medium">Until {new Date(challenge.end_date).toLocaleDateString()}</Text>
            </View>
          </View>

          <View className="flex-row items-baseline gap-2 mb-2">
            <Text className="text-white text-4xl font-bold">{completionRate}%</Text>
            <Text className="text-slate-500 font-medium">Compliance</Text>
          </View>

          <View className="h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800 mb-6">
             <View className="h-full bg-blue-500 rounded-full" style={{ width: `${completionRate}%` }} />
          </View>

          <View className="flex-row gap-8">
             <View>
                <Text className="text-slate-500 text-[10px] font-bold uppercase">Completed</Text>
                <Text className="text-white font-bold text-lg">{completedCount}</Text>
             </View>
             <View>
                <Text className="text-slate-500 text-[10px] font-bold uppercase">Remaining</Text>
                <Text className="text-white font-bold text-lg">{totalCount - completedCount}</Text>
             </View>
          </View>
        </MotiView>

        {/* Task List */}
        <View className="mt-10 px-6">
           <Text className="text-white text-lg font-bold mb-6">Daily Breakdown</Text>
           {challenge.sub_challenges?.map((task: any, index: number) => (
             <TaskCard key={task.id} task={task} index={index} />
           ))}
        </View>
      </ScrollView>
    </View>
  );
}

const TaskCard = ({ task, index }: { task: any, index: number }) => {
  const getIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'training': return <Dumbbell size={24} color="#3B82F6" />;
      case 'nutrition': return <Apple size={24} color="#10B981" />;
      case 'recovery': return <Moon size={24} color="#8B5CF6" />;
      default: return <Zap size={24} color="#F59E0B" />;
    }
  };

  const isPast = new Date(task.assigned_date) < new Date(new Date().setHours(0,0,0,0));

  return (
    <MotiView
      from={{ opacity: 0, translateX: -20 }}
      animate={{ opacity: 1, translateX: 0 }}
      transition={{ delay: index * 100 }}
      className="bg-slate-900 mb-4 p-5 rounded-[24px] border border-slate-800"
    >
      <View className="flex-row justify-between items-center mb-4">
        <View className="flex-row items-center gap-3">
          <View className="w-10 h-10 bg-slate-950 rounded-xl items-center justify-center border border-slate-800">
             {getIcon(task.focus_type)}
          </View>
          <View>
            <Text className="text-white font-bold text-base">{task.name}</Text>
            <Text className="text-slate-500 text-xs font-medium capitalize">{task.focus_type} • {task.intensity}</Text>
          </View>
        </View>
        {task.completed ? (
          <View className="bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
             <Text className="text-emerald-500 text-[10px] font-bold uppercase">Success</Text>
          </View>
        ) : isPast ? (
            <View className="bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20">
                <Text className="text-red-500 text-[10px] font-bold uppercase">Missed</Text>
            </View>
        ) : (
          <View className="bg-slate-800 px-3 py-1 rounded-full">
             <Text className="text-slate-400 text-[10px] font-bold uppercase">Pending</Text>
          </View>
        )}
      </View>

      <View className="pl-[52px]">
         <Text className="text-slate-400 text-sm leading-5 mb-4" numberOfLines={2}>{task.description}</Text>
         <View className="flex-row justify-between items-center pt-4 border-t border-slate-950/50">
           <View className="flex-row items-center gap-2">
              <Clock size={12} color="#475569" />
              <Text className="text-slate-500 text-[10px] font-bold uppercase">
                {new Date(task.assigned_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </Text>
           </View>
           <TouchableOpacity className="flex-row items-center gap-1">
              <Text className="text-blue-500 text-xs font-bold">Edit Plan</Text>
              <ChevronRight size={14} color="#3B82F6" />
           </TouchableOpacity>
         </View>
      </View>
    </MotiView>
  );
};
