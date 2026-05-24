import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, SafeAreaView, Platform, KeyboardAvoidingView, BackHandler } from 'react-native';
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
  id?: string;
  name: string;
  description: string;
  assigned_date: string;
  focus_type: ChallengeFocusType;
  intensity: 'low' | 'medium' | 'high';
  completed?: boolean;
}

export default function EditChallengeScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { coach } = useAuth();

  // Form State
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [mode, setMode] = useState<'relative' | 'fixed'>('relative');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [durationDays, setDurationDays] = useState('7');
  const [subChallenges, setSubChallenges] = useState<SubChallenge[]>([]);
  const [deletedSubIds, setDeletedSubIds] = useState<string[]>([]);
  const [initialData, setInitialData] = useState<{
    name: string;
    description: string;
    subChallenges: SubChallenge[];
  } | null>(null);

  // UI State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const loadChallengeData = async () => {
    if (!id || !coach) return;
    try {
      setLoading(true);
      
      // Fetch Mother Challenge
      const { data: mother, error: motherError } = await supabase
        .from('mother_challenges')
        .select('*, client:clients!mother_challenges_client_id_fkey(id, profiles(full_name, avatar_url))')
        .eq('id', id)
        .single();

      if (motherError) throw motherError;
      if (!mother) throw new Error('Challenge not found');

      setName(mother.name);
      setDescription(mother.description || '');
      setStartDate(mother.start_date);
      setDurationDays(mother.duration_days.toString());
      setMode(mother.mode || 'relative');
      
      if (mother.client && mother.client.profiles) {
        setSelectedClient({
          id: mother.client.id,
          full_name: mother.client.profiles.full_name,
          avatar_url: mother.client.profiles.avatar_url
        });
      }

      // Fetch Sub Challenges
      const { data: subs, error: subsError } = await supabase
        .from('sub_challenges')
        .select('*')
        .eq('mother_challenge_id', id)
        .order('assigned_date', { ascending: true });

      if (subsError) throw subsError;
      setSubChallenges(subs || []);
      setInitialData({
        name: mother.name,
        description: mother.description || '',
        subChallenges: subs ? JSON.parse(JSON.stringify(subs)) : []
      });

    } catch (e: any) {
      console.error('Error loading challenge:', e);
      Alert.alert('Error', 'Failed to load challenge details');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadChallengeData(); }, [id, coach]);

  const hasUnsavedChanges = useCallback(() => {
    if (!initialData) return false;
    
    if (name.trim() !== initialData.name.trim()) return true;
    if (description.trim() !== initialData.description.trim()) return true;
    if (deletedSubIds.length > 0) return true;
    if (subChallenges.length !== initialData.subChallenges.length) return true;
    
    for (let i = 0; i < subChallenges.length; i++) {
      const current = subChallenges[i];
      const initial = initialData.subChallenges[i];
      if (!initial) return true;
      if ((current.name || '').trim() !== (initial.name || '').trim()) return true;
      if ((current.description || '').trim() !== (initial.description || '').trim()) return true;
      if (current.focus_type !== initial.focus_type) return true;
      if (current.intensity !== initial.intensity) return true;
    }
    
    return false;
  }, [initialData, name, description, subChallenges, deletedSubIds]);

  const handleBack = useCallback(() => {
    if (hasUnsavedChanges()) {
      Alert.alert(
        'Discard changes?',
        'You have unsaved changes. Are you sure you want to go back?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          { text: 'Yes', style: 'destructive', onPress: () => router.back() }
        ]
      );
    } else {
      router.back();
    }
  }, [hasUnsavedChanges]);

  useEffect(() => {
    const onBackPress = () => {
      if (hasUnsavedChanges()) {
        Alert.alert(
          'Discard changes?',
          'You have unsaved changes. Are you sure you want to go back?',
          [
            { text: 'Keep Editing', style: 'cancel' },
            { text: 'Yes', style: 'destructive', onPress: () => router.back() }
          ]
        );
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [hasUnsavedChanges]);

  const updateSubChallenge = (index: number, field: keyof SubChallenge, value: any) => {
    const updated = [...subChallenges];
    updated[index] = { ...updated[index], [field]: value };
    setSubChallenges(updated);
  };

  const handleDeleteSubChallenge = (index: number) => {
    Alert.alert(
      'Delete Mission',
      'Are you sure you want to remove this day from the challenge?',
      [
        { text: 'Keep', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive', 
          onPress: () => {
            const sub = subChallenges[index];
            if (sub.id) {
              setDeletedSubIds(prev => [...prev, sub.id!]);
            }
            const updated = subChallenges.filter((_, i) => i !== index);
            setSubChallenges(updated);
            setDurationDays(updated.length.toString());
          } 
        }
      ]
    );
  };

  const validate = () => {
    const newErrors: { [key: string]: string } = {};
    if (!name.trim()) newErrors.name = 'Plan identity is required';
    
    const duration = parseInt(durationDays);
    if (isNaN(duration) || duration < 1) {
        newErrors.durationDays = 'Invalid duration';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      Alert.alert('Incomplete Form', 'Please correct the highlighted fields.');
      return;
    }

    if (!coach || !id) return;

    try {
      setSaving(true);

      // Delete any removed sub-challenges if any
      if (deletedSubIds.length > 0) {
        const { error: deleteError } = await supabase
          .from('sub_challenges')
          .delete()
          .in('id', deletedSubIds);
        if (deleteError) throw deleteError;
      }

      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + parseInt(durationDays) - 1);

      // Update Mother Challenge
      const { error: motherUpdateError } = await supabase
        .from('mother_challenges')
        .update({
          name: name.trim(),
          description: description.trim() || null,
          start_date: startDate,
          end_date: endDate.toISOString().split('T')[0],
          duration_days: parseInt(durationDays),
          mode: mode,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (motherUpdateError) throw motherUpdateError;

      // Update Sub Challenges
      // For simplicity, we'll upsert them
      const subsToUpsert = subChallenges.map(sub => ({
        ...sub,
        mother_challenge_id: id,
        updated_at: new Date().toISOString()
      }));

      const { error: subsUpdateError } = await supabase
        .from('sub_challenges')
        .upsert(subsToUpsert);

      if (subsUpdateError) throw subsUpdateError;
      
      Alert.alert('Success', 'Challenge successfully updated!', [
        { text: 'Done', onPress: () => router.back() }
      ]);
    } catch (e: any) {
      Alert.alert('Save Failed', e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
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
            onPress={handleBack} 
            style={{ padding: 12, backgroundColor: '#0f172a', borderRadius: 16, borderWidth: 1, borderColor: '#1e293b' }}
          >
            <ArrowLeft size={20} color="#94A3B8" />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
              <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold' }}>Edit Challenge</Text>
              <Text style={{ color: '#64748b', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 4 }}>Refine Protocol</Text>
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
                {/* Client Read-only */}
                <View style={{ marginTop: 24 }}>
                    <Text style={{ color: '#64748b', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8, marginLeft: 4 }}>Recipient</Text>
                    <View 
                        style={{ 
                            backgroundColor: '#0f172a', 
                            padding: 16, 
                            borderRadius: 16, 
                            borderWidth: 1, 
                            borderColor: '#1e293b',
                            flexDirection: 'row',
                            alignItems: 'center',
                            opacity: 0.7
                        }}
                    >
                        <BrandedAvatar size={36} name={selectedClient?.full_name || '?'} imageUrl={selectedClient?.avatar_url} />
                        <View style={{ marginLeft: 12 }}>
                            <Text style={{ fontSize: 16, fontWeight: 'bold', color: 'white' }}>
                                {selectedClient?.full_name}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Details */}
                <View style={{ marginTop: 32 }}>
                    <View>
                        <Text style={{ color: '#64748b', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8, marginLeft: 4 }}>Plan Identity</Text>
                        <TextInput 
                            style={{ backgroundColor: '#0f172a', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: errors.name ? '#ef444466' : '#1e293b', color: 'white', fontWeight: 'bold', fontSize: 18 }}
                            placeholder="Challenge Name" 
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
                </View>
            </View>

            {/* Phase 2: Daily Missions */}
            <View style={{ marginTop: 48 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24, paddingHorizontal: 4 }}>
                    <View>
                        <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold' }}>Daily Missions</Text>
                        <Text style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>Configure each day's requirements</Text>
                    </View>
                </View>

                {subChallenges.map((sub, i) => (
                    <View 
                        key={sub.id || i} 
                        style={{ backgroundColor: '#0f172a', padding: 20, borderRadius: 28, borderWidth: 1, borderColor: '#1e293b', marginBottom: 24 }}
                    >
                        {/* Day Header */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#1e293b80', paddingBottom: 12 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: sub.completed ? '#10b981' : '#2563eb', alignItems: 'center', justifyContent: 'center' }}>
                                    {sub.completed ? <Check size={14} color="white" /> : <Text style={{ color: 'white', fontSize: 10, fontWeight: '900' }}>{i + 1}</Text>}
                                </View>
                                <Text style={{ color: sub.completed ? '#10b981' : '#3b82f6', fontWeight: 'bold', fontSize: 12, textTransform: 'uppercase' }}>Day {i + 1}</Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, opacity: 0.6 }}>
                                    <Calendar size={10} color="#64748B" />
                                    <Text style={{ color: '#64748b', fontWeight: '500', fontSize: 10 }}>{sub.assigned_date}</Text>
                                </View>
                                <TouchableOpacity 
                                    onPress={() => handleDeleteSubChallenge(i)}
                                    style={{ padding: 4 }}
                                >
                                    <Trash2 size={14} color="#EF4444" />
                                </TouchableOpacity>
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
                onPress={handleSave} 
                disabled={saving}
                style={{ 
                    height: 64, 
                    borderRadius: 24, 
                    backgroundColor: saving ? '#1e293b' : '#2563eb',
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
                {saving ? (
                    <>
                        <ActivityIndicator color="white" />
                        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 18 }}>Saving Changes...</Text>
                    </>
                ) : (
                    <>
                        <ShieldCheck size={22} color="white" />
                        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 18 }}>Save Protocol</Text>
                    </>
                )}
              </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
