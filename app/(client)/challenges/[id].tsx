import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, SafeAreaView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MotiView } from 'moti';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { X, Check, TrendingUp, Calendar, ChevronLeft, Zap, Info, Clock, AlertCircle } from 'lucide-react-native';

interface ProgressEntry {
  id: string;
  date: string;
  completed: boolean;
  notes: string | null;
}

interface Challenge {
  id: string;
  name: string;
  description: string;
  focus_type: string;
  duration_days: number;
  start_date: string;
  end_date: string;
}

export default function ChallengeProgressScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [progress, setProgress] = useState<ProgressEntry[]>([]);
  const [todayProgress, setTodayProgress] = useState<ProgressEntry | null>(null);
  const [notes, setNotes] = useState('');

  useEffect(() => { loadChallengeAndProgress(); }, [id]);

  const loadChallengeAndProgress = async () => {
    if (!id || !user) return;
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_challenge_with_progress', { p_challenge_id: id });
      if (error) throw error;
      if (data) {
        setChallenge(data.challenge);
        setProgress(data.progress || []);
        const todayStr = new Date().toISOString().split('T')[0];
        const todayEntry = data.progress?.find((p: any) => p.date === todayStr);
        if (todayEntry) { setTodayProgress(todayEntry); setNotes(todayEntry.notes || ''); }
      }
    } catch (e) { Alert.alert('Error'); } finally { setLoading(false); }
  };

  const handleMarkProgress = async (completed: boolean) => {
    if (!challenge || !user) return;
    try {
      setSubmitting(true);
      const { data: cData } = await supabase.from('clients').select('id').eq('user_id', user.id).single();
      if (!cData) return;
      
      const { error } = await supabase.rpc('mark_challenge_progress', {
        p_challenge_id: id,
        p_client_id: cData.id,
        p_date: new Date().toISOString().split('T')[0],
        p_completed: completed,
        p_notes: notes.trim() || null,
        p_proof_url: null,
      });
      if (error) throw error;
      loadChallengeAndProgress();
      if (completed) Alert.alert('Objective Secured', 'Neural link synchronized.');
    } catch (e) { Alert.alert('Error saving'); } finally { setSubmitting(false); }
  };

  if (loading) return <View className="flex-1 bg-slate-950 justify-center items-center"><ActivityIndicator color="#3B82F6" /></View>;
  if (!challenge) return <View className="flex-1 bg-slate-950 items-center justify-center"><Text className="text-white">Not found</Text></View>;

  const completedDays = progress.filter(p => p.completed).length;
  const progressPercent = Math.round((completedDays / challenge.duration_days) * 100);
  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <View className="flex-1 bg-slate-950">
        <SafeAreaView className="flex-1">
            <View className="flex-row justify-between items-center px-6 py-4">
                <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 bg-slate-900 rounded-full items-center justify-center">
                    <ChevronLeft size={20} color="white" />
                </TouchableOpacity>
                <Text className="text-white font-black text-lg">Protocol Tracker</Text>
                <View className="w-10" />
            </View>

            <ScrollView className="flex-1 px-6">
                {/* Status Dashboard */}
                <MotiView 
                    from={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-blue-600 rounded-[32px] p-6 mb-8 mt-4 shadow-xl shadow-blue-500/20"
                >
                    <View className="flex-row justify-between items-start mb-6">
                        <View className="flex-1">
                            <Text className="text-white/60 font-black text-[10px] uppercase tracking-widest mb-1">Active Mission</Text>
                            <Text className="text-white text-xl font-black">{challenge.name}</Text>
                        </View>
                        <View className="w-12 h-12 rounded-2xl bg-white/20 items-center justify-center">
                            <Zap size={20} color="white" />
                        </View>
                    </View>
                    
                    <View className="flex-row items-end justify-between">
                        <View>
                            <Text className="text-white text-3xl font-black">{progressPercent}%</Text>
                            <Text className="text-white/70 font-bold text-xs">Completion Rate</Text>
                        </View>
                        <View className="items-end">
                            <Text className="text-white font-black text-base">{completedDays}/{challenge.duration_days}</Text>
                            <Text className="text-white/70 font-bold text-xs uppercase">Days Secured</Text>
                        </View>
                    </View>
                </MotiView>

                {/* Today's Sync */}
                <View className="mb-8">
                    <View className="flex-row items-center gap-3 mb-4">
                        <View className="w-1 h-4 bg-blue-600 rounded-full" />
                        <Text className="text-white text-lg font-black">Daily Synchronization</Text>
                    </View>

                    <View className="bg-slate-900/40 border border-slate-900 rounded-[32px] p-6">
                        <Text className="text-slate-500 font-bold text-xs uppercase tracking-widest mb-4">
                            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                        </Text>

                        {todayProgress ? (
                            <View className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex-row items-center mb-6">
                                <View className="w-8 h-8 rounded-full bg-emerald-500 items-center justify-center mr-3">
                                    <Check size={16} color="white" />
                                </View>
                                <Text className="text-emerald-500 font-black text-sm">Protocol synchronized for this cycle.</Text>
                            </View>
                        ) : (
                            <View className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex-row items-center mb-6">
                                <Clock size={16} color="#F59E0B" className="mr-3" />
                                <Text className="text-amber-500 font-black text-sm">Awaiting daily log transmission.</Text>
                            </View>
                        )}

                        <Text className="text-slate-500 font-black text-[10px] uppercase tracking-widest mb-2 px-1">Mission Notes</Text>
                        <TextInput 
                            className="bg-slate-950 p-4 rounded-2xl text-white font-medium border border-slate-800 mb-6 min-h-[100px]"
                            multiline
                            placeholder="Add mission context..."
                            placeholderTextColor="#1E293B"
                            value={notes}
                            onChangeText={setNotes}
                        />

                        <View className="flex-row gap-3">
                            <TouchableOpacity 
                                onPress={() => handleMarkProgress(false)}
                                className="flex-1 p-4 bg-slate-900 border border-slate-800 rounded-2xl items-center"
                            >
                                <Text className="text-slate-400 font-bold">Inhibit</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                onPress={() => handleMarkProgress(true)}
                                className="flex-2 p-4 bg-blue-600 rounded-2xl items-center shadow-lg shadow-blue-500/20"
                            >
                                <Text className="text-white font-black">Synchronize</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                {/* Performance History */}
                <View className="mb-12">
                    <View className="flex-row items-center gap-3 mb-4">
                        <View className="w-1 h-4 bg-blue-600 rounded-full" />
                        <Text className="text-white text-lg font-black">Memory Matrix</Text>
                    </View>
                    <View className="flex-row flex-wrap gap-2">
                        {Array.from({ length: challenge.duration_days }, (_, i) => {
                            const date = new Date(challenge.start_date);
                            date.setDate(date.getDate() + i);
                            const ds = date.toISOString().split('T')[0];
                            const done = progress.find(p => p.date === ds)?.completed;
                            const isT = ds === todayStr;
                            
                            return (
                                <View 
                                    key={i} 
                                    className={`w-10 h-10 rounded-xl items-center justify-center border ${done ? 'bg-emerald-500 border-emerald-400' : 'bg-slate-900 border-slate-800 opacity-40'} ${isT ? 'border-blue-500 border-2 scale-110 opacity-100 shadow-lg shadow-blue-500/40' : ''}`}
                                >
                                    <Text className={`text-[10px] font-black ${done ? 'text-white' : 'text-slate-600'}`}>{i + 1}</Text>
                                    {done && <Check size={8} color="white" className="absolute bottom-1 right-1" />}
                                </View>
                            );
                        })}
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    </View>
  );
}
