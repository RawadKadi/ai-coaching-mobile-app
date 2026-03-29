import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, SafeAreaView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
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

  if (loading) return <View style={{ flex: 1, backgroundColor: '#020617', justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator color="#3B82F6" /></View>;
  if (!challenge) return <View style={{ flex: 1, backgroundColor: '#020617', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: 'white' }}>Mission protocol not found</Text></View>;

  const completedDays = progress.filter(p => p.completed).length;
  const progressPercent = Math.round((completedDays / challenge.duration_days) * 100);
  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <View style={{ flex: 1, backgroundColor: '#020617' }}>
        <SafeAreaView style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16 }}>
                <TouchableOpacity 
                    onPress={() => router.back()} 
                    style={{ width: 40, height: 40, backgroundColor: '#0f172a', borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#1e293b' }}
                >
                    <ChevronLeft size={20} color="white" />
                </TouchableOpacity>
                <Text style={{ color: 'white', fontWeight: '900', fontSize: 18 }}>Protocol Tracker</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView 
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
              showsVerticalScrollIndicator={false}
            >
                {/* Status Dashboard */}
                <View style={{ backgroundColor: '#2563eb', borderRadius: 32, padding: 24, marginBottom: 32, marginTop: 16 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                        <View style={{ flex: 1 }}>
                            <Text style={{ color: '#ffffff99', fontWeight: '900', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>Active Mission</Text>
                            <Text style={{ color: 'white', fontSize: 20, fontWeight: '900' }}>{challenge.name}</Text>
                        </View>
                        <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: '#ffffff33', alignItems: 'center', justifyContent: 'center' }}>
                            <Zap size={20} color="white" />
                        </View>
                    </View>
                    
                    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                        <View>
                            <Text style={{ color: 'white', fontSize: 32, fontWeight: '900' }}>{progressPercent}%</Text>
                            <Text style={{ color: '#ffffffb3', fontWeight: 'bold', fontSize: 12 }}>Completion Rate</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                            <Text style={{ color: 'white', fontWeight: '900', fontSize: 16 }}>{completedDays}/{challenge.duration_days}</Text>
                            <Text style={{ color: '#ffffffb3', fontWeight: 'bold', fontSize: 12, textTransform: 'uppercase' }}>Days Secured</Text>
                        </View>
                    </View>
                </View>

                {/* Today's Sync */}
                <View style={{ marginBottom: 32 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                        <View style={{ width: 4, height: 16, backgroundColor: '#2563eb', borderRadius: 999 }} />
                        <Text style={{ color: 'white', fontSize: 18, fontWeight: '900' }}>Daily Synchronization</Text>
                    </View>

                    <View style={{ backgroundColor: '#0f172a66', borderWidth: 1, borderColor: '#1e293b', borderRadius: 32, padding: 24 }}>
                        <Text style={{ color: '#64748b', fontWeight: 'bold', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 16 }}>
                            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                        </Text>

                        {todayProgress ? (
                            <View style={{ backgroundColor: '#10b9811a', borderWidth: 1, borderColor: '#10b98133', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
                                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#10b981', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                                    <Check size={16} color="white" />
                                </View>
                                <Text style={{ color: '#10b981', fontWeight: '900', fontSize: 14 }}>Protocol synchronized for this cycle.</Text>
                            </View>
                        ) : (
                            <View style={{ backgroundColor: '#f59e0b1a', borderWidth: 1, borderColor: '#f59e0b33', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
                                <Clock size={16} color="#F59E0B" style={{ marginRight: 12 }} />
                                <Text style={{ color: '#f59e0b', fontWeight: '900', fontSize: 14 }}>Awaiting daily log transmission.</Text>
                            </View>
                        )}

                        <Text style={{ color: '#475569', fontWeight: '900', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8, paddingHorizontal: 4 }}>Mission Notes</Text>
                        <TextInput 
                            style={{ backgroundColor: '#020617', padding: 16, borderRadius: 16, color: 'white', fontWeight: '500', borderWidth: 1, borderColor: '#1e293b', marginBottom: 24, minHeight: 100, textAlignVertical: 'top' }}
                            multiline
                            placeholder="Add mission context..."
                            placeholderTextColor="#1e293b"
                            value={notes}
                            onChangeText={setNotes}
                        />

                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <TouchableOpacity 
                                onPress={() => handleMarkProgress(false)}
                                style={{ flex: 1, padding: 16, backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#1e293b', borderRadius: 16, alignItems: 'center' }}
                            >
                                <Text style={{ color: '#94a3b8', fontWeight: 'bold' }}>Inhibit</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                onPress={() => handleMarkProgress(true)}
                                style={{ flex: 2, padding: 16, backgroundColor: '#2563eb', borderRadius: 16, alignItems: 'center' }}
                            >
                                <Text style={{ color: 'white', fontWeight: '900' }}>Synchronize</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                {/* Performance History */}
                <View style={{ marginBottom: 48 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                        <View style={{ width: 4, height: 16, backgroundColor: '#2563eb', borderRadius: 999 }} />
                        <Text style={{ color: 'white', fontSize: 18, fontWeight: '900' }}>Memory Matrix</Text>
                    </View>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        {Array.from({ length: challenge.duration_days }, (_, i) => {
                            const date = new Date(challenge.start_date);
                            date.setDate(date.getDate() + i);
                            const ds = date.toISOString().split('T')[0];
                            const done = progress.find(p => p.date === ds)?.completed;
                            const isT = ds === todayStr;
                            
                            return (
                                <View 
                                    key={i} 
                                    style={{ 
                                        width: 44, 
                                        height: 44, 
                                        borderRadius: 12, 
                                        alignItems: 'center', 
                                        justifyContent: 'center', 
                                        borderWidth: isT ? 2 : 1,
                                        borderColor: isT ? '#3b82f6' : (done ? '#10b981' : '#1e293b'),
                                        backgroundColor: done ? '#10b981' : '#0f172a',
                                        opacity: (done || isT) ? 1 : 0.4
                                    }}
                                >
                                    <Text style={{ fontSize: 10, fontWeight: '900', color: done ? 'white' : '#64748b' }}>{i + 1}</Text>
                                    {done && (
                                        <View style={{ position: 'absolute', bottom: 4, right: 4 }}>
                                            <Check size={8} color="white" />
                                        </View>
                                    )}
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
