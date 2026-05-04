import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, SafeAreaView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, Sparkles, ChevronRight, Zap, Target as FocusIcon, Flame, Check } from 'lucide-react-native';
import { generateDailyProtocol } from '@/lib/ai-protocol-service';

export default function AIProtocolSuggestScreen() {
  const router = useRouter();
  const { clientId } = useLocalSearchParams();
  const { coach } = useAuth();

  // Navigation State
  const [step, setStep] = useState(1); // 1: Focus, 2: Difficulty, 3: Review/Generate
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Form State
  const [clientInfo, setClientInfo] = useState<{ id: string, full_name: string } | null>(null);
  const [focusType, setFocusType] = useState<'training' | 'nutrition' | 'recovery' | 'consistency'>('consistency');
  const [intensity, setIntensity] = useState<'low' | 'medium' | 'high'>('medium');

  useEffect(() => {
    if (clientId) {
      loadClient();
    }
  }, [clientId]);

  const loadClient = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_client_details', { target_client_id: clientId });
      
      if (error) throw error;
      if (data) {
        setClientInfo({
          id: data.id,
          full_name: data.profiles?.full_name || 'Client'
        });
      }
    } catch (error) {
      console.error('Load error:', error);
      Alert.alert('Error', 'Could not load client information.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!clientInfo) return;
    try {
      setGenerating(true);
      
      const habits = await generateDailyProtocol(
        clientInfo.id, 
        clientInfo.full_name, 
        { focusType, intensity }
      );

      if (!habits || habits.length === 0) {
        Alert.alert('AI Busy', 'The AI is thinking. Please try again in a few seconds.');
        return;
      }

      router.push({
        pathname: '/(coach)/clients/ai-protocol-review',
        params: {
          clientId: clientInfo.id,
          clientName: clientInfo.full_name,
          suggestions: JSON.stringify(habits),
          focusType,
          intensity
        }
      });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'AI failed to generate tasks');
    } finally {
      setGenerating(false);
    }
  };

  const renderStepIndicator = () => (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, marginTop: 8, paddingHorizontal: 24 }}>
      {[1, 2, 3].map((s) => (
        <View key={s} style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
          <View 
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 2,
              backgroundColor: step >= s ? '#2563EB' : '#0F172A',
              borderColor: step >= s ? '#3B82F6' : '#1E293B'
            }}
          >
            {step > s ? (
              <Check size={14} color="white" />
            ) : (
              <Text style={{ fontWeight: 'bold', fontSize: 12, color: step >= s ? 'white' : '#475569' }}>{s}</Text>
            )}
          </View>
          {s < 3 && (
            <View style={{ flex: 1, height: 2, marginHorizontal: 8, backgroundColor: step > s ? '#2563EB' : '#1E293B' }} />
          )}
        </View>
      ))}
    </View>
  );

  if (loading) {
    return (
      <View className="flex-1 bg-slate-950 justify-center items-center">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#020617' }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity 
              onPress={() => step > 1 ? setStep(step - 1) : router.back()} 
              style={{ padding: 10, backgroundColor: '#0F172A', borderRadius: 12, borderWidth: 1, borderColor: '#1E293B', marginRight: 16 }}
            >
              <ArrowLeft size={18} color="#94A3B8" />
            </TouchableOpacity>
            <View>
              <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>AI Task Generator</Text>
              <Text style={{ color: '#475569', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' }}>Step {step} of 3</Text>
            </View>
          </View>
        </View>

        {renderStepIndicator()}

        <ScrollView 
            style={{ flex: 1 }} 
            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
        >
            {step === 1 && (
              <View>
                <Text style={{ color: 'white', fontSize: 24, fontWeight: 'bold', marginBottom: 4 }}>Main Focus</Text>
                <Text style={{ color: '#64748B', marginBottom: 24 }}>What should the AI focus on for {clientInfo?.full_name}?</Text>

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                    {(['training', 'nutrition', 'recovery', 'consistency'] as const).map((f) => {
                        const isActive = focusType === f;
                        const emojis: Record<string, string> = { training: '💪', nutrition: '🥗', recovery: '😴', consistency: '🎯' };
                        return (
                            <TouchableOpacity 
                                key={f}
                                onPress={() => setFocusType(f)}
                                style={{
                                    width: '48%',
                                    marginBottom: 16,
                                    padding: 20,
                                    borderRadius: 24,
                                    borderWidth: 2,
                                    alignItems: 'center',
                                    backgroundColor: isActive ? 'rgba(37, 99, 235, 0.1)' : '#0F172A',
                                    borderColor: isActive ? '#3B82F6' : '#1E293B'
                                }}
                            >
                                <Text style={{ fontSize: 24, marginBottom: 8 }}>{emojis[f]}</Text>
                                <Text style={{ fontWeight: 'bold', textTransform: 'capitalize', color: isActive ? 'white' : '#64748B' }}>{f}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
              </View>
            )}

            {step === 2 && (
              <View>
                <Text style={{ color: 'white', fontSize: 24, fontWeight: 'bold', marginBottom: 4 }}>How hard?</Text>
                <Text style={{ color: '#64748B', marginBottom: 24 }}>Select the daily difficulty level.</Text>
                
                <View style={{ gap: 16 }}>
                    {(['low', 'medium', 'high'] as const).map((int) => {
                        const isActive = intensity === int;
                        let color = '#475569';
                        let desc = '';
                        if (int === 'low') { color = '#10B981'; desc = 'Focus on core basics and getting started.'; }
                        if (int === 'medium') { color = '#F59E0B'; desc = 'A balanced set of tasks for steady progress.'; }
                        if (int === 'high') { color = '#EF4444'; desc = 'Challenging tasks for fast results.'; }
                        
                        return (
                            <TouchableOpacity
                                key={int}
                                onPress={() => setIntensity(int)}
                                style={{
                                    padding: 24,
                                    borderRadius: 24,
                                    borderWidth: 2,
                                    backgroundColor: isActive ? 'rgba(37, 99, 235, 0.05)' : '#0F172A',
                                    borderColor: isActive ? color : '#1E293B'
                                }}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                    <Flame size={20} color={color} style={{ marginRight: 10 }} />
                                    <Text style={{ fontWeight: '900', textTransform: 'uppercase', fontSize: 16, color: isActive ? 'white' : '#64748B' }}>
                                        {int} Level
                                    </Text>
                                </View>
                                <Text style={{ color: '#475569', fontSize: 14 }}>{desc}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
              </View>
            )}

            {step === 3 && (
              <View>
                <View style={{ padding: 32, borderRadius: 32, backgroundColor: 'rgba(37, 99, 235, 0.05)', borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.2)', alignItems: 'center' }}>
                    <View style={{ width: 64, height: 64, backgroundColor: '#2563EB', borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                        <Zap size={32} color="white" />
                    </View>
                    <Text style={{ color: 'white', fontSize: 22, fontWeight: 'bold', textAlign: 'center' }}>Ready to build</Text>
                    <Text style={{ color: '#94A3B8', textAlign: 'center', marginTop: 12, lineHeight: 20, paddingHorizontal: 16, fontSize: 14 }}>
                        The AI will create a set of daily tasks for {clientInfo?.full_name}.
                    </Text>
                </View>
              </View>
            )}
        </ScrollView>

        {/* Footer Navigation */}
        <View style={{ paddingHorizontal: 24, paddingVertical: 24, backgroundColor: '#020617', borderTopWidth: 1, borderTopColor: '#0F172A' }}>
            <TouchableOpacity 
              onPress={() => {
                if (step < 3) setStep(step + 1);
                else handleGenerate();
              }}
              disabled={generating}
              style={{
                height: 60,
                borderRadius: 20,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#2563EB',
                opacity: generating ? 0.7 : 1
              }}
            >
                {generating ? (
                    <ActivityIndicator color="white" />
                ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      {step === 3 ? (
                        <>
                           <Sparkles size={20} color="white" style={{ marginRight: 10 }} />
                           <Text style={{ color: 'white', fontWeight: '900', fontSize: 16, textTransform: 'uppercase' }}>Generate Tasks</Text>
                        </>
                      ) : (
                        <>
                           <Text style={{ fontWeight: '900', fontSize: 16, textTransform: 'uppercase', color: 'white', marginRight: 8 }}>
                             Next
                           </Text>
                           <ChevronRight size={18} color="white" />
                        </>
                      )}
                    </View>
                )}
            </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}
