import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MotiView, AnimatePresence } from 'moti';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, Check, RefreshCw, Plus, Trash2, Edit3, Sparkles, Calendar, Clock, ChevronRight, Zap, Dumbbell, Apple, Moon } from 'lucide-react-native';
import { SubChallengeTemplate } from '@/lib/ai-challenge-service';

export default function ReviewChallengesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { coach } = useAuth();

  const initialChallenges: SubChallengeTemplate[] = params.challenges ? JSON.parse(params.challenges as string) : [];
  const [challenges, setChallenges] = useState<SubChallengeTemplate[]>(initialChallenges);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

  const clientId = params.clientId as string;
  const clientName = params.clientName as string;
  const startDate = params.startDate as string;

  const challengesByDate = challenges.reduce((acc, challenge, idx) => {
    const date = challenge.assigned_date;
    if (!acc[date]) acc[date] = [];
    acc[date].push({ ...challenge, index: idx });
    return acc;
  }, {} as Record<string, (SubChallengeTemplate & { index: number })[]>);

  const dates = Object.keys(challengesByDate).sort();

  const handleEdit = (index: number, field: string, value: string) => {
    const updated = [...challenges];
    updated[index] = { ...updated[index], [field]: value };
    setChallenges(updated);
  };

  const handleDelete = (index: number) => {
    Alert.alert('Remove Task', 'Remove this from the training plan?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => setChallenges(challenges.filter((_, i) => i !== index)) }
    ]);
  };

  const handleApprove = async () => {
    if (challenges.length === 0) return;
    try {
      setCreating(true);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6);

      const { error } = await supabase.rpc('create_mother_challenge', {
        p_coach_id: coach!.id,
        p_client_id: clientId,
        p_name: `Elite Performance: Week starting ${new Date(startDate).toLocaleDateString()}`,
        p_description: `Personalized 7-day adaptive training strategy for ${clientName}`,
        p_start_date: startDate,
        p_end_date: endDate.toISOString().split('T')[0],
        p_sub_challenges: challenges.map(c => ({
          name: c.name,
          description: c.description,
          assigned_date: c.assigned_date,
          focus_type: c.focus_type,
          intensity: c.intensity
        })),
        p_created_by: 'coach',
        p_mode: 'relative'
      });

      if (error) throw error;
      router.push('/(coach)/challenges');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to launch plan');
    } finally {
      setCreating(false);
    }
  };

  const getFocusIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'training': return <Dumbbell size={20} color="#3B82F6" />;
      case 'nutrition': return <Apple size={20} color="#10B981" />;
      case 'recovery': return <Moon size={20} color="#8B5CF6" />;
      default: return <Zap size={20} color="#F59E0B" />;
    }
  };

  return (
    <View className="flex-1 bg-slate-950">
      {/* Header */}
      <View className="px-6 pt-16 pb-6 flex-row items-center gap-4 border-b border-slate-900 bg-slate-950">
        <TouchableOpacity onPress={() => router.back()} className="p-2 bg-slate-900 rounded-full">
          <ArrowLeft size={20} color="#94A3B8" />
        </TouchableOpacity>
        <View className="flex-1">
            <Text className="text-white text-xl font-bold">Review Strategy</Text>
            <Text className="text-slate-500 text-xs font-medium">Assigned to {clientName}</Text>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 120 }}>
          {/* Strategy Summary */}
          <MotiView 
            from={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mx-6 mt-8 bg-blue-600 p-8 rounded-[40px] shadow-2xl shadow-blue-500/30"
          >
              <View className="flex-row justify-between items-center mb-6">
                <View className="bg-white/20 px-3 py-1 rounded-full border border-white/30">
                   <Text className="text-white text-[10px] font-bold uppercase tracking-widest">AI Performance Strategy</Text>
                </View>
                <Sparkles size={20} color="white" />
              </View>
              <Text className="text-white text-2xl font-bold leading-tight">Adaptive Weekly Protocol</Text>
              <Text className="text-white/80 mt-2 text-sm leading-5"> This logic optimizes for high-compliance tasks tailored to recent activity levels.</Text>
          </MotiView>

          {/* Timeline Tasks */}
          <View className="mt-10">
              {dates.map((date) => {
                  const dayTasks = challengesByDate[date];
                  const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'long' });
                  const dateStr = new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

                  return (
                      <View key={date} className="mb-8">
                          <View className="px-6 flex-row items-center gap-4 mb-4">
                              <View className="w-10 h-10 bg-slate-900 rounded-full items-center justify-center border border-slate-800">
                                  <Calendar size={18} color="#475569" />
                              </View>
                              <View>
                                  <Text className="text-white font-bold">{dayName}</Text>
                                  <Text className="text-slate-500 text-xs font-medium">{dateStr}</Text>
                              </View>
                          </View>

                          <View className="px-6">
                              {dayTasks.map((task, tidx) => (
                                  <MotiView 
                                    key={task.index}
                                    from={{ opacity: 0, translateX: -20 }}
                                    animate={{ opacity: 1, translateX: 0 }}
                                    transition={{ delay: tidx * 100 }}
                                    className="bg-slate-900 mb-3 p-5 rounded-[28px] border border-slate-800"
                                  >
                                      <View className="flex-row justify-between items-start mb-3">
                                          <View className="flex-row items-center gap-3">
                                              <View className="w-8 h-8 bg-slate-950 rounded-lg items-center justify-center border border-slate-800">
                                                  {getFocusIcon(task.focus_type)}
                                              </View>
                                              <Text className="text-white font-bold text-base">{task.name}</Text>
                                          </View>
                                          <View className="flex-row gap-3">
                                              <TouchableOpacity onPress={() => setEditingId(task.index)}>
                                                  <Edit3 size={18} color="#64748B" />
                                              </TouchableOpacity>
                                              <TouchableOpacity onPress={() => handleDelete(task.index)}>
                                                  <Trash2 size={18} color="#EF4444" />
                                              </TouchableOpacity>
                                          </View>
                                      </View>
                                      <Text className="text-slate-400 text-sm leading-5" numberOfLines={2}>{task.description}</Text>
                                      <View className="flex-row gap-2 mt-4">
                                          <View className="bg-slate-950 px-2 py-1 rounded-md border border-slate-800">
                                              <Text className="text-slate-500 text-[10px] font-bold uppercase">{task.intensity} intensity</Text>
                                          </View>
                                      </View>
                                  </MotiView>
                              ))}
                          </View>
                      </View>
                  );
              })}
          </View>
      </ScrollView>

      {/* Action Bar */}
      <View className="absolute bottom-0 w-full p-6 bg-slate-950/90 border-t border-slate-900">
          <TouchableOpacity 
            className={`h-16 rounded-2xl flex-row items-center justify-center gap-3 ${challenges.length > 0 ? 'bg-blue-600 shadow-xl shadow-blue-500/20' : 'bg-slate-800'}`}
            onPress={handleApprove}
            disabled={creating || challenges.length === 0}
          >
              {creating ? (
                  <ActivityIndicator color="white" />
              ) : (
                  <>
                    <Check size={22} color="white" />
                    <Text className="text-white font-bold text-lg">Approve & Launch Protocol</Text>
                  </>
              )}
          </TouchableOpacity>
      </View>
    </View>
  );
}
