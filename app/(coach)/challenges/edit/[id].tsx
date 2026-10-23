import { useBrandColors } from '@/contexts/BrandContext';
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, SafeAreaView, Platform, KeyboardAvoidingView, BackHandler } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MotiView, AnimatePresence } from 'moti';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { ChallengeFocusType } from '@/types/database';
import { X, Plus, Minus, Calendar, Target, Trash2, ArrowLeft, ChevronDown, Check, Info, Flame, Zap, ShieldCheck } from 'lucide-react-native';
import { BrandedAvatar } from '@/components/BrandedAvatar';

interface Client {
  id: string;
  full_name: string;
  avatar_url?: string;
}

interface ExerciseItem {
  id: string;
  exercise: string;
  sets: number;
  notes: string;
}

interface SubChallenge {
  id?: string;
  name: string;
  description: string;
  assigned_date: string;
  focus_type: ChallengeFocusType;
  intensity: 'low' | 'medium' | 'high';
  completed?: boolean;
  isStructured: boolean;
  rule: string;
  exercises: ExerciseItem[];
}

const parseDayContent = (rawDescription: string) => {
  if (!rawDescription || typeof rawDescription !== 'string') {
    return {
      isStructured: false,
      rule: '',
      exercises: [] as ExerciseItem[],
    };
  }

  const trimmed = rawDescription.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object') {
        const subTasksList = Array.isArray(parsed.sub_tasks)
          ? parsed.sub_tasks
          : Array.isArray(parsed.exercises)
            ? parsed.exercises
            : Array.isArray(parsed)
              ? parsed
              : null;

        if (subTasksList && subTasksList.length > 0) {
          const rule = parsed.global_rule || parsed.rule || parsed.instructions || '';
          const exercises: ExerciseItem[] = subTasksList.map((st: any, i: number) => ({
            id: st.id || `ex_${Date.now()}_${i}`,
            exercise: st.exercise || st.name || '',
            sets: typeof st.sets === 'number' ? st.sets : (Number(st.sets) || 1),
            notes: st.notes || '',
          }));
          return {
            isStructured: true,
            rule,
            exercises,
          };
        }
      }
    } catch {
      // not JSON
    }
  }

  return {
    isStructured: false,
    rule: '',
    exercises: [] as ExerciseItem[],
  };
};

const serializeDayContent = (sub: SubChallenge): string => {
  if (sub.isStructured) {
    return JSON.stringify({
      global_rule: (sub.rule || '').trim(),
      sub_tasks: sub.exercises.map((ex, i) => ({
        id: ex.id || `ex_${i + 1}`,
        exercise: ex.exercise.trim(),
        sets: Number(ex.sets) || 1,
        notes: (ex.notes || '').trim(),
      })),
    });
  }
  return (sub.description || '').trim();
};

export default function EditChallengeScreen() {
  const colors = useBrandColors();
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

      const formattedSubs: SubChallenge[] = (subs || []).map((sub: any) => {
        const parsed = parseDayContent(sub.description);
        return {
          id: sub.id,
          name: sub.name,
          description: sub.description || '',
          assigned_date: sub.assigned_date,
          focus_type: sub.focus_type,
          intensity: sub.intensity,
          completed: sub.completed,
          isStructured: parsed.isStructured,
          rule: parsed.rule,
          exercises: parsed.exercises,
        };
      });

      setSubChallenges(formattedSubs);
      setInitialData({
        name: mother.name,
        description: mother.description || '',
        subChallenges: JSON.parse(JSON.stringify(formattedSubs))
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
      if (current.focus_type !== initial.focus_type) return true;
      if (current.intensity !== initial.intensity) return true;
      if (serializeDayContent(current) !== serializeDayContent(initial)) return true;
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

  const updateSubChallengeRule = (dayIndex: number, rule: string) => {
    setSubChallenges(prev => {
      const next = [...prev];
      next[dayIndex] = { ...next[dayIndex], rule };
      return next;
    });
  };

  const updateExercise = (dayIndex: number, exIndex: number, field: keyof ExerciseItem, value: any) => {
    setSubChallenges(prev => {
      const next = [...prev];
      const targetDay = { ...next[dayIndex] };
      const exercises = [...targetDay.exercises];
      exercises[exIndex] = { ...exercises[exIndex], [field]: value };
      targetDay.exercises = exercises;
      next[dayIndex] = targetDay;
      return next;
    });
  };

  const addExercise = (dayIndex: number) => {
    setSubChallenges(prev => {
      const next = [...prev];
      const targetDay = { ...next[dayIndex] };
      targetDay.exercises = [
        ...targetDay.exercises,
        {
          id: `ex_${Date.now()}_${targetDay.exercises.length + 1}`,
          exercise: '',
          sets: 1,
          notes: '',
        },
      ];
      targetDay.isStructured = true;
      next[dayIndex] = targetDay;
      return next;
    });
  };

  const removeExercise = (dayIndex: number, exIndex: number) => {
    setSubChallenges(prev => {
      const next = [...prev];
      const targetDay = { ...next[dayIndex] };
      targetDay.exercises = targetDay.exercises.filter((_, i) => i !== exIndex);
      next[dayIndex] = targetDay;
      return next;
    });
  };

  const toggleDayFormat = (dayIndex: number) => {
    setSubChallenges(prev => {
      const next = [...prev];
      const targetDay = { ...next[dayIndex] };
      if (targetDay.isStructured) {
        // Convert to plain text note
        const textParts: string[] = [];
        if (targetDay.rule) textParts.push(targetDay.rule);
        targetDay.exercises.forEach(ex => {
          const parts = [ex.exercise];
          if (ex.sets) parts.push(`(${ex.sets} ${ex.sets === 1 ? 'set' : 'sets'})`);
          if (ex.notes) parts.push(`- ${ex.notes}`);
          textParts.push(parts.join(' '));
        });
        targetDay.description = textParts.join('\n');
        targetDay.isStructured = false;
      } else {
        // Convert to structured exercises
        targetDay.isStructured = true;
        if (targetDay.exercises.length === 0) {
          targetDay.exercises = [
            {
              id: `ex_${Date.now()}_1`,
              exercise: targetDay.description.trim(),
              sets: 1,
              notes: '',
            },
          ];
        }
      }
      next[dayIndex] = targetDay;
      return next;
    });
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

      // Update Sub Challenges with properly serialized description
      const subsToUpsert = subChallenges.map(sub => {
        const payload: any = {
          mother_challenge_id: id,
          name: sub.name.trim(),
          description: serializeDayContent(sub),
          assigned_date: sub.assigned_date,
          focus_type: sub.focus_type,
          intensity: sub.intensity,
          completed: sub.completed ?? false,
          updated_at: new Date().toISOString()
        };
        if (sub.id) {
          payload.id = sub.id;
        }
        return payload;
      });

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
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <TouchableOpacity 
            onPress={handleBack} 
            style={{ padding: 12, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border }}
          >
            <ArrowLeft size={20} color={colors.text} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
              <Text style={{ color: colors.text, fontSize: 20, fontWeight: 'bold' }}>Edit Challenge</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 4 }}>Plan Details</Text>
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
                    <Text style={{ color: colors.textSecondary, fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8, marginLeft: 4 }}>Recipient</Text>
                    <View 
                        style={{ 
                            backgroundColor: colors.surface, 
                            padding: 16, 
                            borderRadius: 16, 
                            borderWidth: 1, 
                            borderColor: colors.border,
                            flexDirection: 'row',
                            alignItems: 'center',
                            opacity: 0.85
                        }}
                    >
                        <BrandedAvatar size={36} name={selectedClient?.full_name || '?'} imageUrl={selectedClient?.avatar_url} />
                        <View style={{ marginLeft: 12 }}>
                            <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text }}>
                                {selectedClient?.full_name}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Details */}
                <View style={{ marginTop: 32 }}>
                    <View>
                        <Text style={{ color: colors.textSecondary, fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8, marginLeft: 4 }}>Plan Name</Text>
                        <TextInput 
                            style={{ backgroundColor: colors.surface, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: errors.name ? '#ef444466' : colors.border, color: colors.text, fontWeight: 'bold', fontSize: 18 }}
                            placeholder="Challenge Name" 
                            placeholderTextColor={colors.textTertiary}
                            value={name} 
                            onChangeText={(t) => { setName(t); setErrors(prev => ({ ...prev, name: '' })); }}
                        />
                        {errors.name && <Text style={{ color: '#f87171', fontSize: 10, marginTop: 8, marginLeft: 4 }}>{errors.name}</Text>}
                    </View>

                    <View style={{ marginTop: 24 }}>
                        <Text style={{ color: colors.textSecondary, fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8, marginLeft: 4 }}>Description</Text>
                        <TextInput 
                            style={{ backgroundColor: colors.surface, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: colors.border, color: colors.text, fontWeight: '500', minHeight: 100 }}
                            placeholder="Briefly describe the focus of this challenge..." 
                            placeholderTextColor={colors.textTertiary}
                            multiline 
                            value={description} 
                            onChangeText={setDescription}
                            textAlignVertical="top"
                        />
                    </View>
                </View>
            </View>

            {/* Phase 2: Daily Tasks */}
            <View style={{ marginTop: 48 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24, paddingHorizontal: 4 }}>
                    <View>
                        <Text style={{ color: colors.text, fontSize: 20, fontWeight: 'bold' }}>Daily Tasks</Text>
                        <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>Configure each day's requirements</Text>
                    </View>
                </View>

                {subChallenges.map((sub, i) => (
                    <View 
                        key={sub.id || i} 
                        style={{ backgroundColor: colors.surface, padding: 20, borderRadius: 28, borderWidth: 1, borderColor: colors.border, marginBottom: 24 }}
                    >
                        {/* Day Header */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 12 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: sub.completed ? '#10b981' : colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                                    {sub.completed ? <Check size={14} color="white" /> : <Text style={{ color: colors.textOnPrimary || 'white', fontSize: 10, fontWeight: '900' }}>{i + 1}</Text>}
                                </View>
                                <Text style={{ color: sub.completed ? '#10b981' : colors.primary, fontWeight: 'bold', fontSize: 12, textTransform: 'uppercase' }}>Day {i + 1}</Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, opacity: 0.6 }}>
                                    <Calendar size={10} color={colors.textSecondary} />
                                    <Text style={{ color: colors.textSecondary, fontWeight: '500', fontSize: 10 }}>{sub.assigned_date}</Text>
                                </View>
                                <TouchableOpacity 
                                    onPress={() => handleDeleteSubChallenge(i)}
                                    style={{ padding: 4 }}
                                >
                                    <Trash2 size={14} color="#EF4444" />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Task Name */}
                        <TextInput 
                            style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, padding: 16, borderRadius: 12, color: colors.text, fontWeight: 'bold', fontSize: 16, marginBottom: 12 }}
                            placeholder="Task Name" 
                            placeholderTextColor={colors.textTertiary}
                            value={sub.name} 
                            onChangeText={(v) => updateSubChallenge(i, 'name', v)}
                        />

                        {/* Task Content: Structured Exercises or Plain Note */}
                        {sub.isStructured ? (
                          <View style={{ marginBottom: 16 }}>
                            {/* Daily Note / Instructions */}
                            <View style={{ marginBottom: 14 }}>
                              <Text style={{ color: colors.textSecondary, fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 6, marginLeft: 4 }}>
                                Instructions
                              </Text>
                              <TextInput
                                style={{
                                  backgroundColor: colors.background,
                                  borderWidth: 1,
                                  borderColor: colors.border,
                                  padding: 14,
                                  borderRadius: 14,
                                  color: colors.text,
                                  fontSize: 14,
                                  fontWeight: '500',
                                  minHeight: 50,
                                }}
                                placeholder="Optional daily guidance (e.g. Complete before breakfast)..."
                                placeholderTextColor={colors.textTertiary}
                                multiline
                                value={sub.rule}
                                onChangeText={(v) => updateSubChallengeRule(i, v)}
                                textAlignVertical="top"
                              />
                            </View>

                            {/* Exercises Section */}
                            <View>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingHorizontal: 4 }}>
                                <Text style={{ color: colors.textSecondary, fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1.2 }}>
                                  Exercises {sub.exercises.length > 0 ? `(${sub.exercises.length})` : ''}
                                </Text>
                                <TouchableOpacity
                                  onPress={() => addExercise(i)}
                                  style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 4,
                                    paddingHorizontal: 10,
                                    paddingVertical: 5,
                                    borderRadius: 12,
                                    backgroundColor: `${colors.primary}18`,
                                    borderWidth: 1,
                                    borderColor: `${colors.primary}35`,
                                  }}
                                >
                                  <Plus size={12} color={colors.primary} />
                                  <Text style={{ color: colors.primary, fontSize: 11, fontWeight: 'bold' }}>Add Exercise</Text>
                                </TouchableOpacity>
                              </View>

                              {sub.exercises.map((ex, exIdx) => (
                                <View
                                  key={ex.id || exIdx}
                                  style={{
                                    backgroundColor: colors.background,
                                    borderWidth: 1,
                                    borderColor: colors.border,
                                    borderRadius: 16,
                                    padding: 14,
                                    marginBottom: 10,
                                  }}
                                >
                                  {/* Exercise Name and Delete */}
                                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 8 }}>
                                    <View
                                      style={{
                                        width: 22,
                                        height: 22,
                                        borderRadius: 11,
                                        backgroundColor: `${colors.primary}20`,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                      }}
                                    >
                                      <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '900' }}>
                                        {exIdx + 1}
                                      </Text>
                                    </View>
                                    <TextInput
                                      style={{
                                        flex: 1,
                                        color: colors.text,
                                        fontWeight: 'bold',
                                        fontSize: 15,
                                        paddingVertical: 2,
                                      }}
                                      placeholder="Exercise name"
                                      placeholderTextColor={colors.textTertiary}
                                      value={ex.exercise}
                                      onChangeText={(v) => updateExercise(i, exIdx, 'exercise', v)}
                                    />
                                    {sub.exercises.length > 1 && (
                                      <TouchableOpacity
                                        onPress={() => removeExercise(i, exIdx)}
                                        style={{ padding: 4 }}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                      >
                                        <Trash2 size={15} color="#EF4444" />
                                      </TouchableOpacity>
                                    )}
                                  </View>

                                  {/* Sets & Notes Row */}
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                    {/* Sets Stepper */}
                                    <View
                                      style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        backgroundColor: colors.surface,
                                        borderRadius: 10,
                                        borderWidth: 1,
                                        borderColor: colors.border,
                                        paddingHorizontal: 4,
                                        paddingVertical: 2,
                                      }}
                                    >
                                      <TouchableOpacity
                                        onPress={() => updateExercise(i, exIdx, 'sets', Math.max(1, (ex.sets || 1) - 1))}
                                        style={{ padding: 6 }}
                                      >
                                        <Minus size={12} color={colors.text} />
                                      </TouchableOpacity>
                                      <Text
                                        style={{
                                          color: colors.text,
                                          fontWeight: 'bold',
                                          fontSize: 11,
                                          minWidth: 44,
                                          textAlign: 'center',
                                        }}
                                      >
                                        {ex.sets || 1} {ex.sets === 1 ? 'Set' : 'Sets'}
                                      </Text>
                                      <TouchableOpacity
                                        onPress={() => updateExercise(i, exIdx, 'sets', (ex.sets || 1) + 1)}
                                        style={{ padding: 6 }}
                                      >
                                        <Plus size={12} color={colors.text} />
                                      </TouchableOpacity>
                                    </View>

                                    {/* Notes / Targets */}
                                    <TextInput
                                      style={{
                                        flex: 1,
                                        backgroundColor: colors.surface,
                                        borderWidth: 1,
                                        borderColor: colors.border,
                                        borderRadius: 10,
                                        paddingHorizontal: 10,
                                        paddingVertical: 6,
                                        fontSize: 12,
                                        color: colors.text,
                                        fontWeight: '500',
                                      }}
                                      placeholder="Notes (reps, tempo, etc.)"
                                      placeholderTextColor={colors.textTertiary}
                                      value={ex.notes}
                                      onChangeText={(v) => updateExercise(i, exIdx, 'notes', v)}
                                    />
                                  </View>
                                </View>
                              ))}

                              <TouchableOpacity
                                onPress={() => toggleDayFormat(i)}
                                style={{ alignSelf: 'flex-end', marginTop: 2, paddingVertical: 4, paddingHorizontal: 2 }}
                              >
                                <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '600' }}>
                                  Switch to simple note
                                </Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        ) : (
                          <View style={{ marginBottom: 16 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, paddingHorizontal: 4 }}>
                              <Text style={{ color: colors.textSecondary, fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1.2 }}>
                                Instructions
                              </Text>
                              <TouchableOpacity onPress={() => toggleDayFormat(i)}>
                                <Text style={{ color: colors.primary, fontSize: 11, fontWeight: 'bold' }}>
                                  + Switch to exercises
                                </Text>
                              </TouchableOpacity>
                            </View>
                            <TextInput
                              style={{
                                backgroundColor: colors.background,
                                borderWidth: 1,
                                borderColor: colors.border,
                                padding: 16,
                                borderRadius: 14,
                                color: colors.text,
                                fontWeight: '500',
                                fontSize: 14,
                                minHeight: 80,
                              }}
                              placeholder="Add instructions for this day..."
                              placeholderTextColor={colors.textTertiary}
                              multiline
                              value={sub.description}
                              onChangeText={(v) => updateSubChallenge(i, 'description', v)}
                              textAlignVertical="top"
                            />
                          </View>
                        )}
                        
                        {/* Focus Type Tags */}
                        <Text style={{ color: colors.textSecondary, fontSize: 9, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8, marginLeft: 4 }}>Focus Area</Text>
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
                                            backgroundColor: isActive ? colors.primary : colors.background,
                                            borderColor: isActive ? colors.primary : colors.border
                                        }}
                                    >
                                        <Text style={{ fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', color: isActive ? (colors.textOnPrimary || 'white') : colors.textSecondary }}>{f}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>

                        {/* Intensity Level */}
                        <Text style={{ color: colors.textSecondary, fontSize: 9, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8, marginLeft: 4 }}>Intensity Level</Text>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            {(['low', 'medium', 'high'] as const).map((int) => {
                                const isActive = sub.intensity === int;
                                let color = colors.textSecondary;
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
                                            backgroundColor: isActive ? (color + '15') : colors.background,
                                            borderColor: isActive ? color : colors.border
                                        }}
                                    >
                                        <Flame size={12} color={isActive ? color : colors.textTertiary} />
                                        <Text style={{ fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', color: isActive ? color : colors.textSecondary }}>{int}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                ))}
            </View>
          </ScrollView>

          {/* Action Bar */}
          <View style={{ paddingHorizontal: 24, paddingVertical: 16, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border }}>
              <TouchableOpacity 
                onPress={handleSave} 
                disabled={saving}
                style={{ 
                    height: 64, 
                    borderRadius: 24, 
                    backgroundColor: saving ? colors.surface : colors.primary,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 12,
                    shadowColor: colors.primary,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.2,
                    shadowRadius: 8,
                    elevation: 5
                }}
                activeOpacity={0.8}
              >
                {saving ? (
                    <>
                        <ActivityIndicator color={colors.textOnPrimary || 'white'} />
                        <Text style={{ color: colors.textOnPrimary || 'white', fontWeight: 'bold', fontSize: 18 }}>Saving Changes...</Text>
                    </>
                ) : (
                    <>
                        <ShieldCheck size={22} color={colors.textOnPrimary || 'white'} />
                        <Text style={{ color: colors.textOnPrimary || 'white', fontWeight: 'bold', fontSize: 18 }}>Save Challenge</Text>
                    </>
                )}
              </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
