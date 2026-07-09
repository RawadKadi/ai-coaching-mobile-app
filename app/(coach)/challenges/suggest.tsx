import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, SafeAreaView, TextInput, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, Sparkles, Calendar, ChevronRight, ChevronLeft, Zap, Target as FocusIcon, Flame, ShieldCheck, Check, Search } from 'lucide-react-native';
import { generateWeeklyChallenges } from '@/lib/ai-challenge-service';
import { BrandedAvatar } from '@/components/BrandedAvatar';
import { BrandedCalendar } from '@/components/BrandedCalendar';
import { BrandedDurationPicker } from '@/components/BrandedDurationPicker';
import { BrandedAIInput } from '@/components/BrandedAIInput';
import { ChallengeFocusType } from '@/types/database';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing, withSequence, FadeInDown, FadeOutUp, LinearTransition } from 'react-native-reanimated';

interface Client {
  id: string;
  full_name: string;
  avatar_url?: string;
}

const GENERATION_STATES = [
  'Gathering requirements...',
  'Analyzing client profile...',
  'Personalizing experience...',
  'Locking in tasks...',
  'Finalizing challenge...'
];

function GenerationLoader() {
  const [activeStateIdx, setActiveStateIdx] = useState(0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.2, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    const interval = setInterval(() => {
      setActiveStateIdx(prev => {
        if (prev < GENERATION_STATES.length - 1) {
            return prev + 1;
        }
        return prev;
      });
    }, 1200);

    return () => clearInterval(interval);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }]
  }));

  const startIndex = Math.max(0, Math.min(activeStateIdx - 1, GENERATION_STATES.length - 3));
  const visibleStates = GENERATION_STATES.map((state, idx) => ({ state, idx }))
                        .slice(startIndex, startIndex + 3);

  return (
    <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(2, 6, 23, 0.95)', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }]}>
      <Animated.View style={[{ width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(59, 130, 246, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 32 }, animatedStyle]}>
        <Zap size={32} color="#3B82F6" />
      </Animated.View>
      
      <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold', marginBottom: 24 }}>
        Building Your Challenge...
      </Text>
      
      <View style={{ height: 120, width: '100%', alignItems: 'center' }}>
        {visibleStates.map(({ state, idx }) => {
            const isPassed = idx < activeStateIdx;
            const isActive = idx === activeStateIdx;

            return (
                <Animated.View 
                    key={state}
                    layout={LinearTransition.springify()}
                    entering={FadeInDown}
                    exiting={FadeOutUp}
                    style={{ 
                        flexDirection: 'row',
                        alignItems: 'center',
                        height: 30,
                        opacity: isPassed ? 0.3 : isActive ? 1 : 0.5,
                        marginBottom: 12
                    }}
                >
                    {isActive && (
                        <Animated.View style={[{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#3B82F6', marginRight: 12 }, animatedStyle]} />
                    )}
                    <Text style={{ 
                        color: 'white', 
                        fontSize: isActive ? 16 : 14, 
                        fontWeight: isActive ? 'bold' : '500',
                        textDecorationLine: isPassed ? 'line-through' : 'none'
                    }}>
                        {state}
                    </Text>
                </Animated.View>
            );
        })}
      </View>
    </View>
  );
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
  const [coachCustomDirectives, setCoachCustomDirectives] = useState('');
  const [durationDays, setDurationDays] = useState(7);
  const [scheduleMode, setScheduleMode] = useState<'now' | 'later'>('now');
  const [customStartDate, setCustomStartDate] = useState(new Date());

  useEffect(() => {
    if (coach) {
        loadClients();
    }
  }, [coach]);

  useEffect(() => {
    if (clientId && clients.length > 0) {
      const targetId = Array.isArray(clientId) ? clientId[0] : clientId;
      const preSelected = clients.find((c: Client) => c.id === targetId);
      if (preSelected) {
        setSelectedClient(preSelected);
        setStep(2); // Skip step 1 if client is already known
      }
    }
  }, [clientId, clients]);

  const loadClients = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_coach_clients', { p_coach_id: coach?.id });
      if (error) throw error;
      setClients(data || []);
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
      const startDate = scheduleMode === 'now' ? new Date() : customStartDate;
      
      const challenges = await generateWeeklyChallenges(
        selectedClient.id, 
        selectedClient.full_name, 
        startDate,
        { durationDays, coachCustomDirectives }
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
          clientAvatar: selectedClient.avatar_url || '',
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
      {[1, 2, 3, 4].map((s) => (
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
          {s < 4 && (
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
            <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>AI Help</Text>
              <Text style={{ color: '#475569', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' }}>Step {step} of 4</Text>
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
                <Text style={{ color: 'white', fontSize: 24, fontWeight: 'bold', marginBottom: 4 }}>Select Client</Text>
                <Text style={{ color: '#64748B', marginBottom: 24 }}>Choose a client.</Text>
                
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#0F172A', paddingHorizontal: 16, height: 56, borderRadius: 16, borderWidth: 1, borderColor: '#1E293B', marginBottom: 24 }}>
                  <Search size={20} color="#475569" />
                  <TextInput
                    placeholder="Search clients..."
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
                                    <Text style={{ color: '#475569', fontSize: 12 }}>Ready</Text>
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
                <View style={{ marginBottom: 24 }}>
                  <Text style={{ color: 'white', fontSize: 24, fontWeight: 'bold', marginBottom: 4 }}>Challenge Directives</Text>
                  <Text style={{ color: '#64748B', lineHeight: 20 }}>
                    Describe the precise focus or daily routine rules for this client's program.
                  </Text>
                </View>

                <BrandedAIInput 
                  value={coachCustomDirectives}
                  onChangeText={setCoachCustomDirectives}
                  onSubmit={() => setStep(3)}
                  placeholder="Type your instructions here..."
                />
              </View>
            )}

            {step === 3 && (
              <View>
                <Text style={{ color: 'white', fontSize: 24, fontWeight: 'bold', marginBottom: 4 }}>Start Date</Text>
                <Text style={{ color: '#64748B', marginBottom: 32 }}>Select length and start date.</Text>

                <View style={styles.container}>
                  <BrandedDurationPicker 
                    value={durationDays}
                    onSelect={setDurationDays}
                    label="Duration"
                  />
                </View>

                <View style={styles.container}>
                  <Text style={styles.sectionTitle}>Start Date</Text>
                  <View style={styles.rowGap}>
                    <TouchableOpacity 
                      onPress={() => setScheduleMode('now')}
                      activeOpacity={0.8}
                      style={[
                        styles.buttonBase,
                        scheduleMode === 'now' ? styles.buttonActive : styles.buttonInactive
                      ]}
                    >
                      <Zap size={24} color={scheduleMode === 'now' ? 'white' : '#475569'} />
                      <Text style={[
                        styles.buttonText,
                        scheduleMode === 'now' ? styles.buttonTextActive : styles.buttonTextInactive
                      ]}>Start Now</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      onPress={() => setScheduleMode('later')}
                      activeOpacity={0.8}
                      style={[
                        styles.buttonBase,
                        scheduleMode === 'later' ? styles.buttonActive : styles.buttonInactive
                      ]}
                    >
                      <Calendar size={24} color={scheduleMode === 'later' ? 'white' : '#475569'} />
                      <Text style={[
                        styles.buttonText,
                        scheduleMode === 'later' ? styles.buttonTextActive : styles.buttonTextInactive
                      ]}>Pick Date</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {scheduleMode === 'later' && (
                  <View>
                    <BrandedCalendar 
                      selectedDate={customStartDate}
                      onSelect={setCustomStartDate}
                    />
                  </View>
                )}
              </View>
            )}

            {step === 4 && (
              <View>
                <View style={{ padding: 32, borderRadius: 32, backgroundColor: 'rgba(37, 99, 235, 0.05)', borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.2)', alignItems: 'center' }}>
                    <View style={{ width: 64, height: 64, backgroundColor: '#2563EB', borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                        <Zap size={32} color="white" />
                    </View>
                    <Text style={{ color: 'white', fontSize: 22, fontWeight: 'bold', textAlign: 'center' }}>Ready to create</Text>
                    <Text style={{ color: '#94A3B8', textAlign: 'center', marginTop: 12, lineHeight: 20, paddingHorizontal: 16, fontSize: 14 }}>
                        We will create a custom {durationDays}-day plan for {selectedClient?.full_name}.
                    </Text>
                </View>

                <View style={{ marginTop: 24 }}>
                    <View style={{ backgroundColor: '#0F172A', padding: 16, borderRadius: 20, borderWidth: 1, borderColor: '#1E293B', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View style={{ width: 36, height: 36, backgroundColor: '#1E293B', borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                                <Calendar size={16} color="#3B82F6" />
                            </View>
                            <View>
                                <Text style={{ color: '#475569', fontSize: 9, fontWeight: 'bold', textTransform: 'uppercase' }}>Start Date</Text>
                                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 13 }}>{scheduleMode === 'now' ? 'Starts today' : 'Starts later'}</Text>
                            </View>
                        </View>
                        <Text style={{ color: '#60A5FA', fontWeight: '900', fontSize: 13 }}>
                            {scheduleMode === 'now' ? 'Today' : (() => {
                              try {
                                if (customStartDate instanceof Date && !isNaN(customStartDate.getTime())) {
                                  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                                  return `${months[customStartDate.getMonth()]} ${customStartDate.getDate()}, ${customStartDate.getFullYear()}`;
                                }
                              } catch (e) {
                                console.error('Error formatting date:', e);
                              }
                              return 'Custom Date';
                            })()}
                        </Text>
                    </View>

                    <View style={{ backgroundColor: '#0F172A', padding: 16, borderRadius: 20, borderWidth: 1, borderColor: '#1E293B', flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ width: 36, height: 36, backgroundColor: '#1E293B', borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                            <ShieldCheck size={16} color="#10B981" />
                        </View>
                        <View>
                            <Text style={{ color: '#475569', fontSize: 9, fontWeight: 'bold', textTransform: 'uppercase' }}>Secure</Text>
                            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 13 }}>Secure connection</Text>
                        </View>
                    </View>
                </View>
              </View>
            )}
        </ScrollView>

        {/* Footer Navigation */}
        <View style={{ paddingHorizontal: 24, paddingVertical: 24, backgroundColor: '#020617', borderTopWidth: 1, borderTopColor: '#0F172A' }}>
            {step > 1 ? (
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity 
                  onPress={() => setStep(step - 1)}
                  disabled={generating}
                  style={{
                    flex: 1,
                    height: 60,
                    borderRadius: 20,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#0F172A',
                    borderWidth: 1,
                    borderColor: '#1E293B',
                    opacity: generating ? 0.7 : 1
                  }}
                >
                  <ChevronLeft size={18} color="#94A3B8" style={{ marginRight: 4 }} />
                  <Text style={{ color: '#94A3B8', fontWeight: '900', fontSize: 16, textTransform: 'uppercase' }}>
                    Back
                  </Text>
                </TouchableOpacity>

                {step !== 2 && (
                  <TouchableOpacity 
                    onPress={() => {
                      if (step < 4) setStep(step + 1);
                      else handleGenerate();
                    }}
                    disabled={generating}
                    style={{
                      flex: 2,
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
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                           <ActivityIndicator color="white" style={{ marginRight: 12 }} />
                           <Text style={{ color: 'white', fontWeight: '900', fontSize: 13, letterSpacing: 0.5 }}>Compiling...</Text>
                        </View>
                    ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          {step === 4 ? (
                            <>
                               <Sparkles size={20} color="white" style={{ marginRight: 10 }} />
                               <Text style={{ color: 'white', fontWeight: '900', fontSize: 16, textTransform: 'uppercase' }}>Create Plan</Text>
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
                )}
              </View>
            ) : (
              <TouchableOpacity 
                onPress={() => {
                  if (step < 4) setStep(step + 1);
                  else handleGenerate();
                }}
                disabled={generating}
                style={{
                  flex: 2,
                  height: 60,
                  borderRadius: 20,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#2563EB',
                  opacity: generating ? 0.7 : 1
                }}
              >
                <Text style={{ color: 'white', fontWeight: '900', fontSize: 16, textTransform: 'uppercase', marginRight: 4 }}>
                  {step === 4 ? 'Create Plan' : 'Next'}
                </Text>
                {step !== 4 && <ChevronRight size={18} color="white" />}
              </TouchableOpacity>
            )}
        </View>

        {/* Full-screen Loading Overlay */}
        {generating && <GenerationLoader />}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 40,
  },
  sectionTitle: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 16,
    marginLeft: 4,
  },
  rowGap: {
    flexDirection: 'row',
    gap: 16,
  },
  buttonBase: {
    flex: 1,
    height: 96,
    borderRadius: 32,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonActive: {
    backgroundColor: '#2563EB',
    borderColor: '#3B82F6',
  },
  buttonInactive: {
    backgroundColor: '#0F172A',
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  buttonText: {
    fontWeight: '900',
    fontSize: 12,
    textTransform: 'uppercase',
    marginTop: 8,
    letterSpacing: 1.5,
  },
  buttonTextActive: {
    color: '#FFFFFF',
  },
  buttonTextInactive: {
    color: '#64748B',
  },
});
