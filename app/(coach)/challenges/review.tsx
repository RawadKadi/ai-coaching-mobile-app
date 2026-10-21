import { useBrandColors } from '@/contexts/BrandContext';
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  AccessibilityInfo,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MotiView } from 'moti';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, Check, Trash2, Edit3, Sparkles, Calendar, Zap, Dumbbell, Apple, Moon, X, Plus, Minus } from 'lucide-react-native';
import { SubChallengeTemplate } from '@/lib/ai-challenge-service';

const formatDateSafe = (dateStr: string) => {
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parts[0];
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${months[month - 1]} ${day}, ${year}`;
    }
  } catch (e) {
    console.error(e);
  }
  return dateStr;
};

const parseLocalDate = (dateStr: string) => {
  try {
    if (!dateStr) return new Date();
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      return new Date(year, month, day);
    }
  } catch (e) {
    console.error('Error parsing local date:', e);
  }
  return new Date(dateStr);
};

const getDayNameSafe = (dateStr: string) => {
  try {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dateObj = parseLocalDate(dateStr);
    const day = dateObj.getDay();
    if (!isNaN(day)) {
      return dayNames[day];
    }
  } catch (e) {
    console.error(e);
  }
  return '';
};

const getMonthDaySafe = (dateStr: string) => {
  try {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dateObj = parseLocalDate(dateStr);
    const month = dateObj.getMonth();
    const day = dateObj.getDate();
    if (!isNaN(month) && !isNaN(day)) {
      return `${monthNames[month]} ${day}`;
    }
  } catch (e) {
    console.error(e);
  }
  return '';
};

export default function ReviewChallengesScreen() {
  const colors = useBrandColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  const { coach } = useAuth();

  const initialChallenges: SubChallengeTemplate[] = params.challenges ? JSON.parse(params.challenges as string) : [];
  const [challenges, setChallenges] = useState<SubChallengeTemplate[]>(initialChallenges);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const clientId = params.clientId as string;
  const clientName = params.clientName as string;
  const clientAvatar = params.clientAvatar as string;
  const startDate = params.startDate as string;

  const challengesByDate = challenges.reduce((acc, challenge, idx) => {
    const date = challenge.assigned_date;
    if (!acc[date]) acc[date] = [];
    acc[date].push({ ...challenge, index: idx });
    return acc;
  }, {} as Record<string, (SubChallengeTemplate & { index: number })[]>);

  const dates = Object.keys(challengesByDate).sort();

  const [reduceMotion, setReduceMotion] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editIntensity, setEditIntensity] = useState<'low' | 'medium' | 'high'>('medium');
  const [isStructured, setIsStructured] = useState(false);
  const [editSubTasks, setEditSubTasks] = useState<Array<{ id: string; exercise: string; sets: number; notes: string }>>([]);
  const [editRule, setEditRule] = useState('');
  const [editPlainDesc, setEditPlainDesc] = useState('');

  // Modal animations: backdrop fades in/out, bottom sheet slides up/down
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(600)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  const openEditModal = (index: number) => {
    const task = challenges[index];
    if (!task) return;

    setEditingId(index);
    setEditName(task.name || '');
    setEditIntensity((task.intensity as 'low' | 'medium' | 'high') || 'medium');

    let structured = false;
    let parsedSubTasks: Array<{ id: string; exercise: string; sets: number; notes: string }> = [];
    let parsedRule = '';
    let plainDesc = task.description || '';

    try {
      const parsed = JSON.parse(task.description);
      if (parsed && Array.isArray(parsed.sub_tasks)) {
        structured = true;
        parsedRule = parsed.global_rule || '';
        parsedSubTasks = parsed.sub_tasks.map((st: any, i: number) => ({
          id: st.id || `ex_${i}`,
          exercise: st.exercise || '',
          sets: typeof st.sets === 'number' ? st.sets : 1,
          notes: st.notes || '',
        }));
      }
    } catch {
      // plain text description
    }

    setIsStructured(structured);
    setEditSubTasks(parsedSubTasks);
    setEditRule(parsedRule);
    setEditPlainDesc(plainDesc);

    setIsModalOpen(true);
    fadeAnim.setValue(0);
    slideAnim.setValue(reduceMotion ? 0 : 600);

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: reduceMotion ? 0 : 250,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: reduceMotion ? 0 : 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeEditModal = (save = false) => {
    if (save && editingId !== null) {
      let finalDescription = editPlainDesc;
      if (isStructured) {
        finalDescription = JSON.stringify({
          global_rule: editRule.trim(),
          sub_tasks: editSubTasks.map((st, i) => ({
            id: st.id || `ex_${i}`,
            exercise: st.exercise.trim(),
            sets: Number(st.sets) || 1,
            notes: (st.notes || '').trim(),
          })),
        });
      }

      setChallenges((prev) => {
        const next = [...prev];
        if (next[editingId]) {
          next[editingId] = {
            ...next[editingId],
            name: editName.trim() || next[editingId].name,
            intensity: editIntensity,
            description: finalDescription,
          };
        }
        return next;
      });
    }

    const finishClose = () => {
      setIsModalOpen(false);
      setEditingId(null);
    };

    if (reduceMotion) {
      finishClose();
      return;
    }

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 600,
        duration: 250,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(finishClose);
  };

  const updateSubTask = (idx: number, field: 'exercise' | 'sets' | 'notes', val: any) => {
    setEditSubTasks((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };
      return next;
    });
  };

  const removeSubTask = (idx: number) => {
    setEditSubTasks((prev) => prev.filter((_, i) => i !== idx));
  };

  const addSubTask = () => {
    setEditSubTasks((prev) => [
      ...prev,
      { id: `ex_${Date.now()}`, exercise: '', sets: 1, notes: '' },
    ]);
  };

  const handleDelete = (index: number) => {
    Alert.alert('Remove Task', 'Remove this from the training plan?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => setChallenges(challenges.filter((_, i) => i !== index)) }
    ]);
  };

  const handleApprove = async () => {
    if (challenges.length === 0) return;
    if (!coach) {
      Alert.alert('Error', 'Not logged in as a coach');
      return;
    }
    try {
      console.log('handleApprove: starting execution...');
      setCreating(true);
      console.log('handleApprove: startDate =', startDate);

      const parsedStart = parseLocalDate(startDate);
      const endDateObj = new Date(parsedStart);
      endDateObj.setDate(endDateObj.getDate() + 6);
      
      const endYear = endDateObj.getFullYear();
      const endMonth = String(endDateObj.getMonth() + 1).padStart(2, '0');
      const endDay = String(endDateObj.getDate()).padStart(2, '0');
      const endDateStr = `${endYear}-${endMonth}-${endDay}`;
      console.log('handleApprove: endDateStr =', endDateStr);

      // Map intensities directly matching database enums ('low', 'medium', 'high')
      const mappedSubChallenges = challenges.map(c => {
        return {
          name: c.name,
          description: c.description,
          assigned_date: c.assigned_date,
          focus_type: c.focus_type,
          intensity: c.intensity
        };
      });
      console.log('handleApprove: mappedSubChallenges =', JSON.stringify(mappedSubChallenges));

      console.log('handleApprove: calling supabase.rpc(create_mother_challenge)...');
      const rpcPayload = {
        p_coach_id: coach.id,
        p_client_id: clientId,
        p_name: `Weekly Plan: ${formatDateSafe(startDate)}`,
        p_description: `Weekly plan for ${clientName}`,
        p_start_date: startDate,
        p_end_date: endDateStr,
        p_sub_challenges: mappedSubChallenges,
        p_created_by: 'coach',
        p_mode: 'relative'
      };
      console.log('handleApprove: rpcPayload =', JSON.stringify(rpcPayload));

      const { data, error } = await supabase.rpc('create_mother_challenge', rpcPayload);
      console.log('handleApprove: supabase.rpc returned:', { data, error });

      if (error) throw error;
      console.log('handleApprove: success, navigating to dashboard with success params');
      // Navigate to dashboard first, then dashboard will show the success modal
      router.replace({
        pathname: '/(coach)/(tabs)',
        params: {
          plan_sent: 'true',
          sent_client_name: clientName || '',
          sent_client_id: clientId || '',
        }
      });
    } catch (error: any) {
      console.error('handleApprove: caught error:', error);
      Alert.alert('Error', error.message || 'Failed to launch plan');
    } finally {
      console.log('handleApprove: finally block executing, setting creating to false');
      setCreating(false);
    }
  };

  const getFocusIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'training': return <Dumbbell size={20} color={colors.primary} />;
      case 'nutrition': return <Apple size={20} color="#10B981" />;
      case 'recovery': return <Moon size={20} color="#8B5CF6" />;
      default: return <Zap size={20} color="#F59E0B" />;
    }
  };

  const renderDescription = (description: string) => {
    try {
        const parsed = JSON.parse(description);
        if (parsed && parsed.sub_tasks && Array.isArray(parsed.sub_tasks)) {
            return (
                <View className="mt-2">
                    {parsed.sub_tasks.map((st: any, i: number) => (
                        <View key={i} className="flex-row items-start gap-3 mb-3">
                            <View className="w-4 h-4 mt-0.5 rounded border border-slate-700 bg-slate-800/50" />
                            <View className="flex-1">
                                <Text className="text-slate-200 text-sm font-bold">{st.exercise} <Text className="text-blue-400">({st.sets} {st.sets === 1 ? 'Set' : 'Sets'})</Text></Text>
                                {st.notes && <Text className="text-slate-400 text-xs mt-0.5">{st.notes}</Text>}
                            </View>
                        </View>
                    ))}
                    {parsed.global_rule && (
                        <Text className="text-slate-500 text-xs mt-3 italic">Rule: {parsed.global_rule}</Text>
                    )}
                </View>
            );
        }
    } catch (e) {
        // Fallback removed per instructions, but kept try/catch to prevent crashes if malformed
    }
    return <Text className="text-slate-400 text-sm leading-5" numberOfLines={2}>{description}</Text>;
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={{ flex: 1 }}>
      <View className="flex-row items-center justify-between px-6 pt-4 pb-2">
          <TouchableOpacity onPress={() => router.back()} style={{ backgroundColor: colors.surface, borderColor: colors.border }} className="w-10 h-10 rounded-full items-center justify-center border">
              <ArrowLeft size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={{ color: colors.text }} className="text-lg font-bold">Review Plan</Text>
          <View className="w-10" />
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 120 }}>
          {/* Strategy Summary */}
          <MotiView 
            from={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{ backgroundColor: colors.primary }}
            className="mx-6 mt-8 p-8 rounded-[40px] shadow-2xl"
          >
              <View className="flex-row justify-between items-center mb-6">
                 <View className="bg-white/20 px-3 py-1 rounded-full border border-white/30">
                    <Text className="text-white text-[10px] font-bold uppercase tracking-widest">AI Plan</Text>
                 </View>
                 <Sparkles size={20} color="white" />
               </View>
               <Text className="text-white text-2xl font-bold leading-tight">Weekly Plan</Text>
               <Text className="text-white/80 mt-2 text-sm leading-5">This plan is custom built for your client.</Text>
           </MotiView>

          {/* Timeline Tasks */}
          <View className="mt-10">
              {dates.map((date) => {
                  const dayTasks = challengesByDate[date];
                  const dayName = getDayNameSafe(date);
                  const dateStr = getMonthDaySafe(date);

                  return (
                      <View key={date} className="mb-8">
                          <View className="px-6 flex-row items-center gap-4 mb-4">
                              <View style={{ backgroundColor: colors.surface, borderColor: colors.border }} className="w-10 h-10 rounded-full items-center justify-center border">
                                  <Calendar size={18} color={colors.textSecondary} />
                              </View>
                              <View>
                                  <Text style={{ color: colors.text }} className="font-bold">{dayName}</Text>
                                  <Text style={{ color: colors.textSecondary }} className="text-xs font-medium">{dateStr}</Text>
                              </View>
                          </View>

                          <View className="px-6">
                              {dayTasks.map((task, tidx) => (
                                  <MotiView 
                                    key={task.index}
                                    from={{ opacity: 0, translateX: -20 }}
                                    animate={{ opacity: 1, translateX: 0 }}
                                    transition={{ delay: tidx * 100 }}
                                    style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                                    className="mb-3 p-5 rounded-[28px] border"
                                  >
                                      <View className="flex-row justify-between items-start mb-3">
                                          <View className="flex-row items-center gap-3">
                                              <View style={{ backgroundColor: colors.background, borderColor: colors.border }} className="w-8 h-8 rounded-lg items-center justify-center border">
                                                  {getFocusIcon(task.focus_type)}
                                              </View>
                                              <Text style={{ color: colors.text }} className="font-bold text-base">{task.name}</Text>
                                          </View>
                                          <TouchableOpacity onPress={() => handleDelete(task.index)}>
                                              <Trash2 size={18} color="#EF4444" />
                                          </TouchableOpacity>
                                      </View>
                                      {renderDescription(task.description)}
                                      <View className="flex-row justify-between items-end mt-4">
                                          <View style={{ backgroundColor: colors.background, borderColor: colors.border }} className="px-2 py-1 rounded-md border self-start">
                                              <Text style={{ color: colors.textSecondary }} className="text-[10px] font-bold uppercase">{task.intensity}</Text>
                                          </View>
                                          <TouchableOpacity onPress={() => openEditModal(task.index)}>
                                              <Edit3 size={18} color={colors.textSecondary} />
                                          </TouchableOpacity>
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
      <View 
        style={{ 
          backgroundColor: colors.background, 
          borderTopColor: colors.border,
          paddingBottom: Math.max(insets.bottom, 20)
        }} 
        className="absolute bottom-0 w-full px-6 pt-4 border-t"
      >
          <TouchableOpacity 
            style={{ backgroundColor: challenges.length > 0 ? colors.primary : colors.surface }}
            className="h-16 rounded-2xl flex-row items-center justify-center gap-3 shadow-xl"
            onPress={handleApprove}
            disabled={creating || challenges.length === 0}
          >
              {creating ? (
                  <ActivityIndicator color={colors.textOnPrimary || 'white'} />
              ) : (
                  <>
                    <Check size={22} color={colors.textOnPrimary || 'white'} />
                    <Text style={{ color: colors.textOnPrimary || 'white' }} className="font-bold text-lg">Send Plan</Text>
                  </>
              )}
          </TouchableOpacity>
      </View>
      {/* Edit Modal */}
      <Modal
        visible={isModalOpen}
        transparent={true}
        animationType="none"
        statusBarTranslucent
        onRequestClose={() => closeEditModal(false)}
      >
        <View style={StyleSheet.absoluteFill}>
          {/* Fading dark background: DOES NOT SLIDE */}
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: 'rgba(0, 0, 0, 0.7)', opacity: fadeAnim },
            ]}
          >
            <Pressable style={StyleSheet.absoluteFill} onPress={() => closeEditModal(false)} />
          </Animated.View>

          {/* Sliding sheet */}
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1, justifyContent: 'flex-end' }}
            pointerEvents="box-none"
          >
            <Animated.View
              style={{
                backgroundColor: colors.surface,
                borderTopColor: colors.border,
                borderTopWidth: 1,
                borderTopLeftRadius: 32,
                borderTopRightRadius: 32,
                maxHeight: '85%',
                transform: [{ translateY: slideAnim }],
              }}
            >
              <View style={{ borderBottomColor: colors.border }} className="p-6 border-b flex-row justify-between items-center">
                <Text style={{ color: colors.text }} className="text-xl font-bold">Edit Task</Text>
                <TouchableOpacity onPress={() => closeEditModal(false)} style={{ backgroundColor: colors.background }} className="p-2 rounded-full">
                  <X size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView className="p-6" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                {/* Task Name */}
                <View className="mb-6">
                  <Text style={{ color: colors.textSecondary }} className="text-xs font-bold uppercase mb-2">Task Name</Text>
                  <TextInput
                    style={{ backgroundColor: colors.background, borderColor: colors.border, color: colors.text }}
                    className="border rounded-2xl p-4 font-bold"
                    value={editName}
                    onChangeText={setEditName}
                    placeholder="Task Name"
                    placeholderTextColor={colors.textTertiary}
                  />
                </View>

                {/* Description / Subtasks */}
                {isStructured ? (
                  <View className="mb-6">
                    <View className="flex-row items-center justify-between mb-3">
                      <Text style={{ color: colors.textSecondary }} className="text-xs font-bold uppercase">
                        Exercises ({editSubTasks.length})
                      </Text>
                      <TouchableOpacity
                        onPress={addSubTask}
                        style={{ borderColor: colors.primary, backgroundColor: `${colors.primary}15` }}
                        className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full border"
                      >
                        <Plus size={14} color={colors.primary} />
                        <Text style={{ color: colors.primary }} className="text-xs font-bold">Add Exercise</Text>
                      </TouchableOpacity>
                    </View>

                    {editSubTasks.map((st, sIdx) => (
                      <View
                        key={st.id || sIdx}
                        style={{ backgroundColor: colors.background, borderColor: colors.border }}
                        className="border rounded-2xl p-4 mb-3"
                      >
                        <View className="flex-row items-center justify-between gap-3 mb-2">
                          <TextInput
                            style={{ color: colors.text }}
                            className="flex-1 font-bold text-base"
                            placeholder="Exercise name"
                            placeholderTextColor={colors.textTertiary}
                            value={st.exercise}
                            onChangeText={(val) => updateSubTask(sIdx, 'exercise', val)}
                          />
                          {editSubTasks.length > 1 && (
                            <TouchableOpacity onPress={() => removeSubTask(sIdx)} className="p-1.5">
                              <Trash2 size={16} color="#EF4444" />
                            </TouchableOpacity>
                          )}
                        </View>

                        {/* Sets Stepper */}
                        <View className="flex-row items-center gap-2 pt-2 border-t" style={{ borderTopColor: colors.border }}>
                          <Text style={{ color: colors.textSecondary }} className="text-xs font-bold">Sets:</Text>
                          <View style={{ backgroundColor: colors.surface, borderColor: colors.border }} className="flex-row items-center rounded-xl border px-1 py-0.5">
                            <TouchableOpacity
                              onPress={() => updateSubTask(sIdx, 'sets', Math.max(1, (st.sets || 1) - 1))}
                              className="p-1.5"
                            >
                              <Minus size={12} color={colors.text} />
                            </TouchableOpacity>
                            <Text style={{ color: colors.text }} className="font-bold text-xs px-2 min-w-[20px] text-center">
                              {st.sets || 1}
                            </Text>
                            <TouchableOpacity
                              onPress={() => updateSubTask(sIdx, 'sets', (st.sets || 1) + 1)}
                              className="p-1.5"
                            >
                              <Plus size={12} color={colors.text} />
                            </TouchableOpacity>
                          </View>
                        </View>

                        <TextInput
                          style={{ color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }}
                          className="border rounded-xl px-3 py-2 text-xs mt-3"
                          placeholder="Target notes (e.g. 3 reps, 30 min swim...)"
                          placeholderTextColor={colors.textTertiary}
                          value={st.notes || ''}
                          onChangeText={(val) => updateSubTask(sIdx, 'notes', val)}
                        />
                      </View>
                    ))}

                    {/* Coaching Rule / Tip */}
                    <View className="mt-2">
                      <Text style={{ color: colors.textSecondary }} className="text-xs font-bold uppercase mb-2">
                        Rule / Guidance
                      </Text>
                      <TextInput
                        style={{ backgroundColor: colors.background, borderColor: colors.border, color: colors.text }}
                        className="border rounded-2xl p-4 text-sm"
                        placeholder="Optional guidance (e.g. Warm up before pool)"
                        placeholderTextColor={colors.textTertiary}
                        value={editRule}
                        onChangeText={setEditRule}
                        multiline
                      />
                    </View>
                  </View>
                ) : (
                  <View className="mb-6">
                    <Text style={{ color: colors.textSecondary }} className="text-xs font-bold uppercase mb-2">Description</Text>
                    <TextInput
                      style={{ backgroundColor: colors.background, borderColor: colors.border, color: colors.text }}
                      className="border rounded-2xl p-4 min-h-[100px]"
                      value={editPlainDesc}
                      onChangeText={setEditPlainDesc}
                      placeholder="Task Details"
                      placeholderTextColor={colors.textTertiary}
                      multiline
                      textAlignVertical="top"
                    />
                  </View>
                )}

                {/* Intensity */}
                <View className="mb-6">
                  <Text style={{ color: colors.textSecondary }} className="text-xs font-bold uppercase mb-2">Intensity</Text>
                  <View className="flex-row gap-3">
                    {(['low', 'medium', 'high'] as const).map(int => (
                      <TouchableOpacity
                        key={int}
                        onPress={() => setEditIntensity(int)}
                        style={{
                          backgroundColor: editIntensity === int ? colors.primary : colors.background,
                          borderColor: editIntensity === int ? colors.primary : colors.border
                        }}
                        className="flex-1 py-3 rounded-xl border items-center"
                      >
                        <Text style={{ color: editIntensity === int ? (colors.textOnPrimary || 'white') : colors.textSecondary }} className="font-bold capitalize">{int}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Save Changes button */}
                <TouchableOpacity
                  onPress={() => closeEditModal(true)}
                  style={{ backgroundColor: colors.primary }}
                  className="rounded-2xl py-4 items-center mt-2 mb-10"
                >
                  <Text style={{ color: colors.textOnPrimary || 'white' }} className="font-bold text-lg">Save Changes</Text>
                </TouchableOpacity>
              </ScrollView>
            </Animated.View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
      </View>
    </View>
  );
}
