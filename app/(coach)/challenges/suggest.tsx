import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, SafeAreaView, TextInput } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, Sparkles, Calendar, ChevronRight, Zap, Target as FocusIcon, Flame, ShieldCheck, Check, Search } from 'lucide-react-native';
import { generateWeeklyChallenges } from '@/lib/ai-challenge-service';
import { BrandedAvatar } from '@/components/BrandedAvatar';
import { ChallengeFocusType } from '@/types/database';

interface Client {
  id: string;
  full_name: string;
  avatar_url?: string;
}

export default function AISuggestChallengeScreen() {
  const router = useRouter();
  const { clientId } = useLocalSearchParams();
  const { coach } = useAuth();

  // Navigation State
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Form State
  const [clients, setClients] = useState<Client[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [focusType, setFocusType] = useState<ChallengeFocusType>('training');
  const [intensity, setIntensity] = useState<'low' | 'medium' | 'high'>('medium');
  const [durationDays, setDurationDays] = useState(7);

  useEffect(() => {
    if (coach) {
        loadClients();
    }
  }, [coach]);

  const loadClients = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_coach_clients', { p_coach_id: coach?.id });
      if (error) throw error;
      setClients(data || []);
      
      const targetId = Array.isArray(clientId) ? clientId[0] : clientId;
      if (targetId && data) {
        const preSelected = data.find((c: Client) => c.id === targetId);
        if (preSelected) setSelectedClient(preSelected);
      }
    } catch (error) {
      console.error('Load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedClient) return;
    try {
      setGenerating(true);
      const startDate = getNextMonday();
      
      const challenges = await generateWeeklyChallenges(
        selectedClient.id, 
        selectedClient.full_name, 
        startDate,
        { focusType, intensity, durationDays }
      );

      if (!challenges || challenges.length === 0) {
        Alert.alert('AI Engine Busy', 'The AI engine is currently optimizing. Please try generating again in a few seconds.');
        return;
      }

      router.push({
        pathname: '/(coach)/challenges/review',
        params: {
          clientId: selectedClient.id,
          clientName: selectedClient.full_name,
          startDate: startDate.toISOString().split('T')[0],
          challenges: JSON.stringify(challenges)
        }
      });
    } catch (error: any) {
      Alert.alert('Generation Error', error.message || 'AI generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const filteredClients = clients.filter(c => 
    c.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
              <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>AI Strategist</Text>
              <Text style={{ color: '#475569', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' }}>Step {step} of 3</Text>
            </View>
          </View>
          <View style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.2)' }}>
             <Text style={{ color: '#60A5FA', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' }}>V3 Core</Text>
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
                <Text style={{ color: 'white', fontSize: 24, fontWeight: 'bold', marginBottom: 4 }}>Select Target</Text>
                <Text style={{ color: '#64748B', marginBottom: 24 }}>Choose the client for this Intelligence Session.</Text>
                
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#0F172A', paddingHorizontal: 16, height: 56, borderRadius: 16, borderWidth: 1, borderColor: '#1E293B', marginBottom: 24 }}>
                  <Search size={20} color="#475569" />
                  <TextInput
                    placeholder="Search intelligence targets..."
                    placeholderTextColor="#475569"
                    style={{ flex: 1, marginLeft: 12, color: 'white', fontWeight: '500' }}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                </View>

                {loading ? (
                    <ActivityIndicator size="large" color="#3B82F6" style={{ marginTop: 40 }} />
                ) : filteredClients.length === 0 ? (
                    <View style={{ alignItems: 'center', marginTop: 40 }}>
                        <FocusIcon size={40} color="#1E293B" />
                        <Text style={{ color: '#64748B', marginTop: 16, textAlign: 'center' }}>No active clients match your search.</Text>
                    </View>
                ) : (
                    filteredClients.map((client) => (
                        <TouchableOpacity
                            key={client.id}
                            onPress={() => setSelectedClient(client)}
                            style={{
                                marginBottom: 12,
                                padding: 16,
                                borderRadius: 24,
                                borderWidth: 2,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                backgroundColor: selectedClient?.id === client.id ? 'rgba(37, 99, 235, 0.08)' : '#0F172A',
                                borderColor: selectedClient?.id === client.id ? '#3B82F6' : '#1E293B'
                            }}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <BrandedAvatar size={44} name={client.full_name} imageUrl={client.avatar_url} />
                                <View style={{ marginLeft: 12 }}>
                                    <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>{client.full_name}</Text>
                                    <Text style={{ color: '#475569', fontSize: 12 }}>Ready for Optimization</Text>
                                </View>
                            </View>
                            <View style={{
                                width: 22,
                                height: 22,
                                borderRadius: 11,
                                borderWidth: 2,
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: selectedClient?.id === client.id ? '#3B82F6' : 'transparent',
                                borderColor: selectedClient?.id === client.id ? '#3B82F6' : '#1E293B'
                            }}>
                                {selectedClient?.id === client.id && <Check size={12} color="white" />}
                            </View>
                        </TouchableOpacity>
                    ))
                )}
              </View>
            )}

            {step === 2 && (
              <View>
                <Text style={{ color: 'white', fontSize: 24, fontWeight: 'bold', marginBottom: 4 }}>Protocol Context</Text>
                <Text style={{ color: '#64748B', marginBottom: 24 }}>Define the primary focus for the AI engine.</Text>

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                    {(['training', 'nutrition', 'recovery', 'consistency'] as ChallengeFocusType[]).map((f) => {
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

                <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold', marginTop: 24, marginBottom: 16 }}>Intensity Baseline</Text>
                <View style={{ flexDirection: 'row' }}>
                    {(['low', 'medium', 'high'] as const).map((int) => {
                        const isActive = intensity === int;
                        let color = '#475569';
                        if (isActive) {
                            if (int === 'low') color = '#10B981';
                            if (int === 'medium') color = '#F59E0B';
                            if (int === 'high') color = '#EF4444';
                        }
                        return (
                            <TouchableOpacity
                                key={int}
                                onPress={() => setIntensity(int)}
                                style={{
                                    flex: 1,
                                    marginHorizontal: 4,
                                    height: 52,
                                    borderRadius: 16,
                                    borderWidth: 2,
                                    alignItems: 'center',
                                    flexDirection: 'row',
                                    justifyContent: 'center',
                                    backgroundColor: '#0F172A',
                                    borderColor: isActive ? color : '#1E293B'
                                }}
                            >
                                <Flame size={14} color={isActive ? color : '#475569'} style={{ marginRight: 6 }} />
                                <Text style={{ fontWeight: '900', textTransform: 'uppercase', fontSize: 10, color: isActive ? 'white' : '#64748B' }}>
                                    {int}
                                </Text>
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
                    <Text style={{ color: 'white', fontSize: 22, fontWeight: 'bold', textAlign: 'center' }}>Ready for Generation</Text>
                    <Text style={{ color: '#94A3B8', textAlign: 'center', marginTop: 12, lineHeight: 20, paddingHorizontal: 16, fontSize: 14 }}>
                        A {durationDays}-day targeted {focusType} protocol for {selectedClient?.full_name} will be created.
                    </Text>
                </View>

                <View style={{ marginTop: 24 }}>
                    <View style={{ backgroundColor: '#0F172A', padding: 16, borderRadius: 20, borderWidth: 1, borderColor: '#1E293B', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View style={{ width: 36, height: 36, backgroundColor: '#1E293B', borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                                <Calendar size={16} color="#3B82F6" />
                            </View>
                            <View>
                                <Text style={{ color: '#475569', fontSize: 9, fontWeight: 'bold', textTransform: 'uppercase' }}>Schedule</Text>
                                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 13 }}>Next Monday Start</Text>
                            </View>
                        </View>
                        <Text style={{ color: '#60A5FA', fontWeight: '900', fontSize: 13 }}>
                            {getNextMonday().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </Text>
                    </View>

                    <View style={{ backgroundColor: '#0F172A', padding: 16, borderRadius: 20, borderWidth: 1, borderColor: '#1E293B', flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ width: 36, height: 36, backgroundColor: '#1E293B', borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                            <ShieldCheck size={16} color="#10B981" />
                        </View>
                        <View>
                            <Text style={{ color: '#475569', fontSize: 9, fontWeight: 'bold', textTransform: 'uppercase' }}>Security</Text>
                            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 13 }}>Verification Layer Active</Text>
                        </View>
                    </View>
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
              disabled={(step === 1 && !selectedClient) || generating}
              style={{
                height: 60,
                borderRadius: 20,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: (step === 1 && !selectedClient) ? '#0F172A' : '#2563EB',
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
                           <Text style={{ color: 'white', fontWeight: '900', fontSize: 16, textTransform: 'uppercase' }}>Generate Strategy</Text>
                        </>
                      ) : (
                        <>
                           <Text style={{ fontWeight: '900', fontSize: 16, textTransform: 'uppercase', color: step === 1 && !selectedClient ? '#475569' : 'white', marginRight: 8 }}>
                             Continue Session
                           </Text>
                           <ChevronRight size={18} color={step === 1 && !selectedClient ? '#1E293B' : 'white'} />
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

function getNextMonday(): Date {
  const today = new Date();
  const day = today.getDay();
  const daysUntilMonday = day === 0 ? 1 : (8 - day) % 7 || 7;
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + daysUntilMonday);
  nextMonday.setHours(0, 0, 0, 0);
  return nextMonday;
}
