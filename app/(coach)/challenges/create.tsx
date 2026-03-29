import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, SafeAreaView, Platform, KeyboardAvoidingView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MotiView, AnimatePresence } from 'moti';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { ChallengeFocusType } from '@/types/database';
import { X, Plus, Calendar, Target, Trash2, ArrowLeft, ChevronDown, Check, Info, Flame, Zap, ShieldCheck } from 'lucide-react-native';
import { BrandedAvatar } from '@/components/BrandedAvatar';

interface Client {
  id: string;
  full_name: string;
  avatar_url?: string;
}

interface SubChallenge {
  name: string;
  description: string;
  assigned_date: string;
  focus_type: ChallengeFocusType;
  intensity: 'low' | 'medium' | 'high';
}

export default function CreateChallengeScreen() {
  const router = useRouter();
  const { clientId } = useLocalSearchParams();
  const { coach } = useAuth();

  // Form State
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [mode, setMode] = useState<'relative' | 'fixed'>('relative');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [durationDays, setDurationDays] = useState('7');
  const [subChallenges, setSubChallenges] = useState<SubChallenge[]>([]);

  // UI State
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const generateSubChallenges = useCallback((days: number, start: string) => {
    const startDateObj = new Date(start);
    const subs: SubChallenge[] = [];
    for (let i = 0; i < days; i++) {
        const d = new Date(startDateObj);
        d.setDate(startDateObj.getDate() + i);
        subs.push({
            name: `Day ${i + 1} Mission`,
            description: '',
            assigned_date: d.toISOString().split('T')[0],
            focus_type: 'training',
            intensity: 'medium'
        });
    }
    setSubChallenges(subs);
  }, []);

  const loadClients = async () => {
    if (!coach) return;
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_coach_clients', { p_coach_id: coach.id });
      if (error) throw error;
      setClients(data || []);
      
      const targetId = Array.isArray(clientId) ? clientId[0] : clientId;
      if (targetId && data) {
        const preSelected = data.find((c: any) => c.id === targetId);
        if (preSelected) setSelectedClient(preSelected);
      }
    } catch (e) {
      console.error('Error loading clients:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadClients(); }, [coach, clientId]);

  useEffect(() => {
    const duration = parseInt(durationDays);
    if (!isNaN(duration) && duration >= 3 && duration <= 14) {
      generateSubChallenges(duration, startDate);
      if (errors.durationDays) {
        const newErrors = { ...errors };
        delete newErrors.durationDays;
        setErrors(newErrors);
      }
    } else if (!isNaN(duration)) {
       setErrors(prev => ({ ...prev, durationDays: 'Duration must be between 3 and 14 days' }));
    }
  }, [durationDays, startDate, generateSubChallenges]);

  const updateSubChallenge = (index: number, field: keyof SubChallenge, value: any) => {
    const updated = [...subChallenges];
    updated[index] = { ...updated[index], [field]: value };
    setSubChallenges(updated);
  };

  const validate = () => {
    const newErrors: { [key: string]: string } = {};
    if (!selectedClient) newErrors.client = 'Please select a recipient';
    if (!name.trim()) newErrors.name = 'Plan identity is required';
    
    const duration = parseInt(durationDays);
    if (isNaN(duration) || duration < 3 || duration > 14) {
        newErrors.durationDays = 'Must be 3-14 days';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreate = async () => {
    if (!validate()) {
      Alert.alert('Incomplete Form', 'Please correct the highlighted fields before launching.');
      return;
    }

    if (!coach) return;

    try {
      setCreating(true);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + parseInt(durationDays) - 1);

      const { error } = await supabase.rpc('create_mother_challenge', {
        p_coach_id: coach.id,
        p_client_id: selectedClient!.id,
        p_name: name.trim(),
        p_description: description.trim() || null,
        p_start_date: startDate,
        p_end_date: endDate.toISOString().split('T')[0],
        p_sub_challenges: subChallenges,
        p_created_by: 'coach',
        p_mode: mode,
      });

      if (error) throw error;
      
      Alert.alert('Success', 'Challenge sequence successfully launched!', [
        { text: 'View Dashboard', onPress: () => router.back() }
      ]);
    } catch (e: any) {
      Alert.alert('Launch Failed', e.message);
    } finally {
      setCreating(false);
    }
  };

  if (loading && !selectedClient) {
    return (
      <View className="flex-1 bg-slate-950 items-center justify-center">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#020617' }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <TouchableOpacity 
            onPress={() => router.back()} 
            style={{ padding: 12, backgroundColor: '#0f172a', borderRadius: 16, borderWidth: 1, borderColor: '#1e293b' }}
          >
            <ArrowLeft size={20} color="#94A3B8" />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
              <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold' }}>Manual Create</Text>
              <Text style={{ color: '#64748b', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 4 }}>Challenge Protocol</Text>
          </View>
          <View style={{ width: 48 }} />
        </View>

        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <ScrollView 
            style={{ flex: 1 }}
            contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Phase 1: Configuration */}
            <View>
                {/* Client Selection */}
                <View style={{ marginTop: 24 }}>
                    <Text style={{ color: '#64748b', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8, marginLeft: 4 }}>Target Client</Text>
                    <TouchableOpacity 
                        onPress={() => setShowClientPicker(!showClientPicker)}
                        style={{ 
                            backgroundColor: '#0f172a', 
                            padding: 16, 
                            borderRadius: 16, 
                            borderWidth: 1, 
                            borderColor: errors.client ? '#ef4444' : '#1e293b',
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            <BrandedAvatar size={36} name={selectedClient?.full_name || '?'} imageUrl={selectedClient?.avatar_url} />
                            <View>
                                <Text style={{ fontSize: 16, fontWeight: 'bold', color: selectedClient ? 'white' : '#64748b' }}>
                                    {selectedClient ? selectedClient.full_name : 'Select Recipient'}
                                </Text>
                                {errors.client && <Text style={{ color: '#f87171', fontSize: 10, marginTop: 2 }}>{errors.client}</Text>}
                            </View>
                        </View>
                        <ChevronDown size={18} color={errors.client ? '#EF4444' : '#475569'} />
                    </TouchableOpacity>

                    {showClientPicker && (
                        <View style={{ backgroundColor: '#0f172a', marginTop: 8, borderRadius: 16, borderWidth: 1, borderColor: '#1e293b', overflow: 'hidden' }}>
                            {clients.map((c) => (
                            <TouchableOpacity 
                                key={c.id} 
                                onPress={() => { setSelectedClient(c); setShowClientPicker(false); setErrors(prev => ({ ...prev, client: '' })); }} 
                                style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: '#1e293b' }}
                            >
                                <BrandedAvatar size={28} name={c.full_name} imageUrl={c.avatar_url} />
                                <Text style={{ color: 'white', fontWeight: '500' }}>{c.full_name}</Text>
                                {selectedClient?.id === c.id && <Check size={16} color="#3B82F6" style={{ marginLeft: 'auto' }} />}
                            </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </View>

                {/* Mode Switch */}
                <View style={{ marginTop: 32 }}>
                    <Text style={{ color: '#64748b', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12, marginLeft: 4 }}>Execution Mode</Text>
                    <View style={{ flexDirection: 'row', backgroundColor: '#0f172a', padding: 6, borderRadius: 16, borderWidth: 1, borderColor: '#1e293b' }}>
                        <TouchableOpacity 
                            onPress={() => setMode('relative')} 
                            style={{ 
                                flex: 1, 
                                paddingVertical: 14, 
                                alignItems: 'center', 
                                borderRadius: 12, 
                                flexDirection: 'row', 
                                justifyContent: 'center', 
                                gap: 8,
                                backgroundColor: mode === 'relative' ? '#2563eb' : 'transparent'
                            }}
                        >
                            <Zap size={16} color={mode === 'relative' ? 'white' : '#475569'} />
                            <Text style={{ fontSize: 12, fontWeight: 'bold', color: mode === 'relative' ? 'white' : '#64748b' }}>Adaptive</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            onPress={() => setMode('fixed')} 
                            style={{ 
                                flex: 1, 
                                paddingVertical: 14, 
                                alignItems: 'center', 
                                borderRadius: 12, 
                                flexDirection: 'row', 
                                justifyContent: 'center', 
                                gap: 8,
                                backgroundColor: mode === 'fixed' ? '#2563eb' : 'transparent'
                            }}
                        >
                            <Calendar size={16} color={mode === 'fixed' ? 'white' : '#475569'} />
                            <Text style={{ fontSize: 12, fontWeight: 'bold', color: mode === 'fixed' ? 'white' : '#64748b' }}>Fixed Date</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Details */}
                <View style={{ marginTop: 32 }}>
                    <View>
                        <Text style={{ color: '#64748b', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8, marginLeft: 4 }}>Plan Identity</Text>
                        <TextInput 
                            style={{ backgroundColor: '#0f172a', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: errors.name ? '#ef444466' : '#1e293b', color: 'white', fontWeight: 'bold', fontSize: 18 }}
                            placeholder="e.g. 10-Day Hypertrophy Push" 
                            placeholderTextColor="#334155"
                            value={name} 
                            onChangeText={(t) => { setName(t); setErrors(prev => ({ ...prev, name: '' })); }}
                        />
                        {errors.name && <Text style={{ color: '#f87171', fontSize: 10, marginTop: 8, marginLeft: 4 }}>{errors.name}</Text>}
                    </View>

                    <View style={{ marginTop: 24 }}>
                        <Text style={{ color: '#64748b', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8, marginLeft: 4 }}>Protocol Objectives</Text>
                        <TextInput 
                            style={{ backgroundColor: '#0f172a', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#1e293b', color: 'white', fontWeight: '500', minHeight: 100 }}
                            placeholder="Briefly describe the focus of this challenge..." 
                            placeholderTextColor="#334155"
                            multiline 
                            value={description} 
                            onChangeText={setDescription}
                            textAlignVertical="top"
                        />
                    </View>

                    <View style={{ flexDirection: 'row', gap: 16, marginTop: 24 }}>
                        <View style={{ flex: 1 }}>
                            <Text style={{ color: '#64748b', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8, marginLeft: 4 }}>Cycle Days (3-14)</Text>
                            <TextInput 
                                style={{ backgroundColor: '#0f172a', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: errors.durationDays ? '#ef444466' : '#1e293b', color: 'white', fontWeight: 'bold', textAlign: 'center' }}
                                keyboardType="number-pad" 
                                value={durationDays} 
                                onChangeText={setDurationDays}
                            />
                        </View>
                        {mode === 'fixed' && (
                            <View style={{ flex: 1.5 }}>
                                <Text style={{ color: '#64748b', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8, marginLeft: 4 }}>Launch Date</Text>
                                <View style={{ backgroundColor: '#0f172a', borderRadius: 16, borderWidth: 1, borderColor: '#1e293b', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 }}>
                                    <Calendar size={18} color="#475569" />
                                    <TextInput 
                                        style={{ flex: 1, padding: 20, color: 'white', fontWeight: 'bold', textAlign: 'center' }} 
                                        value={startDate} 
                                        onChangeText={setStartDate} 
                                        placeholder="YYYY-MM-DD" 
                                        placeholderTextColor="#334155" 
                                    />
                                </View>
                            </View>
                        )}
                    </View>
                </View>
            </View>

            {/* Phase 2: Daily Missions */}
            <View style={{ marginTop: 48 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24, paddingHorizontal: 4 }}>
                    <View>
                        <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold' }}>Daily Missions</Text>
                        <Text style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>Configure each day's requirements</Text>
                    </View>
                    <View style={{ paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#3b82f61a', borderRadius: 12, borderWidth: 1, borderColor: '#3b82f633' }}>
                        <Text style={{ color: '#60a5fa', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5 }}>{subChallenges.length} Days</Text>
                    </View>
                </View>

                {subChallenges.map((sub, i) => (
                    <View 
                        key={i} 
                        style={{ backgroundColor: '#0f172a', padding: 20, borderRadius: 28, borderWidth: 1, borderColor: '#1e293b', marginBottom: 24 }}
                    >
                        {/* Day Header */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#1e293b80', paddingBottom: 12 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center' }}>
                                    <Text style={{ color: 'white', fontSize: 10, fontWeight: '900' }}>{i + 1}</Text>
                                </View>
                                <Text style={{ color: '#3b82f6', fontWeight: 'bold', fontSize: 12, textTransform: 'uppercase' }}>Day {i + 1}</Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, opacity: 0.6 }}>
                                <Calendar size={10} color="#64748B" />
                                <Text style={{ color: '#64748b', fontWeight: '500', fontSize: 10 }}>{sub.assigned_date}</Text>
                            </View>
                        </View>

                        {/* Mission Name */}
                        <TextInput 
                            style={{ backgroundColor: '#1e293b80', padding: 16, borderRadius: 12, color: 'white', fontWeight: 'bold', fontSize: 16, marginBottom: 12 }}
                            placeholder="Mission Name" 
                            placeholderTextColor="#475569"
                            value={sub.name} 
                            onChangeText={(v) => updateSubChallenge(i, 'name', v)}
                        />

                        {/* Mission Description */}
                        <TextInput 
                            style={{ backgroundColor: '#1e293b80', padding: 16, borderRadius: 12, color: '#cbd5e1', fontWeight: '500', fontSize: 14, marginBottom: 16, minHeight: 60 }}
                            placeholder="Add specific instructions for this day..." 
                            placeholderTextColor="#475569"
                            multiline
                            value={sub.description} 
                            onChangeText={(v) => updateSubChallenge(i, 'description', v)}
                            textAlignVertical="top"
                        />
                        
                        {/* Focus Type Tags */}
                        <Text style={{ color: '#64748b', fontSize: 9, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8, marginLeft: 4 }}>Focus Area</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', marginBottom: 16 }}>
                            {(['training', 'nutrition', 'recovery', 'consistency'] as ChallengeFocusType[]).map((f) => {
                                const isActive = sub.focus_type === f;
                                return (
                                    <TouchableOpacity 
                                        key={f} 
                                        onPress={() => updateSubChallenge(i, 'focus_type', f)} 
                                        style={{ 
                                            paddingHorizontal: 16, 
                                            paddingVertical: 10, 
                                            borderRadius: 12, 
                                            borderWidth: 1, 
                                            marginRight: 8,
                                            backgroundColor: isActive ? '#2563eb' : '#020617',
                                            borderColor: isActive ? '#60a5fa' : '#1e293b'
                                        }}
                                    >
                                        <Text style={{ fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', color: isActive ? 'white' : '#64748b' }}>{f}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>

                        {/* Intensity Level */}
                        <Text style={{ color: '#64748b', fontSize: 9, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8, marginLeft: 4 }}>Intensity Level</Text>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            {(['low', 'medium', 'high'] as const).map((int) => {
                                const isActive = sub.intensity === int;
                                let color = '#64748B';
                                if (isActive) {
                                    if (int === 'low') color = '#10B981';
                                    if (int === 'medium') color = '#F59E0B';
                                    if (int === 'high') color = '#EF4444';
                                }

                                return (
                                    <TouchableOpacity 
                                        key={int} 
                                        onPress={() => updateSubChallenge(i, 'intensity', int)} 
                                        style={{ 
                                            flex: 1, 
                                            paddingVertical: 10, 
                                            borderRadius: 12, 
                                            borderWidth: 1.5,
                                            alignItems: 'center',
                                            flexDirection: 'row',
                                            justifyContent: 'center',
                                            gap: 6,
                                            backgroundColor: '#020617',
                                            borderColor: isActive ? color : '#1e293b'
                                        }}
                                    >
                                        <Flame size={12} color={isActive ? color : '#334155'} />
                                        <Text style={{ fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', color: isActive ? 'white' : '#64748b' }}>{int}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                ))}
            </View>
          </ScrollView>

          {/* Action Bar */}
          <View style={{ paddingHorizontal: 24, paddingVertical: 16, backgroundColor: '#020617', borderTopWidth: 1, borderTopColor: '#0f172a' }}>
              <TouchableOpacity 
                onPress={handleCreate} 
                disabled={creating}
                style={{ 
                    height: 64, 
                    borderRadius: 24, 
                    backgroundColor: creating ? '#1e293b' : '#2563eb',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 12,
                    shadowColor: '#3b82f6',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.2,
                    shadowRadius: 8,
                    elevation: 5
                }}
                activeOpacity={0.8}
              >
                {creating ? (
                    <>
                        <ActivityIndicator color="white" />
                        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 18 }}>Launching Protocol...</Text>
                    </>
                ) : (
                    <>
                        <ShieldCheck size={22} color="white" />
                        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 18 }}>Launch Sequence</Text>
                    </>
                )}
              </TouchableOpacity>
              <Text style={{ textAlign: 'center', color: '#475569', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 12 }}>Encrypted Link to Client Hub</Text>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
