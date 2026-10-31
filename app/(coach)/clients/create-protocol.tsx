import { useTheme } from '@/contexts/BrandContext';
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, SafeAreaView, Platform, KeyboardAvoidingView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MotiView, AnimatePresence } from 'moti';
import { useReducedMotion } from 'react-native-reanimated';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, Plus, Trash2, Check, ChevronDown, ShieldCheck } from 'lucide-react-native';
import { BrandedAvatar } from '@/components/BrandedAvatar';

interface Client {
  id: string;
  full_name: string;
  avatar_url?: string;
}

interface ProtocolTask {
  id?: string;
  name: string;
  description: string;
  category: 'training' | 'nutrition' | 'recovery' | 'consistency';
  target_value?: number;
  unit?: string;
  frequency?: string;
  verification_type?: string;
}

export default function CreateProtocolScreen() {
  const theme = useTheme();
  const colors = theme.colors;
  const buttonTheme = theme.button;
  const reduceMotion = useReducedMotion();
  const router = useRouter();
  const { clientId } = useLocalSearchParams();
  const { coach } = useAuth();

  // Form State
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [tasks, setTasks] = useState<ProtocolTask[]>([
    { name: '', description: '', category: 'training' }
  ]);
  const [deletedTaskIds, setDeletedTaskIds] = useState<string[]>([]);

  // UI State
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadExistingTasks = async (cid: string) => {
    try {
      const { data, error } = await supabase
        .from('habits')
        .select('*')
        .eq('client_id', cid)
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      if (data && data.length > 0) {
        setTasks(data.map(h => ({
          id: h.id,
          name: h.name,
          description: h.description || '',
          category: h.category as any || 'general',
          target_value: h.target_value,
          unit: h.unit,
          frequency: h.frequency,
          verification_type: h.verification_type
        })));
      } else {
        setTasks([{ name: '', description: '', category: 'training' }]);
      }
      setDeletedTaskIds([]);
    } catch (e) {
      console.error('Error loading existing tasks:', e);
    }
  };

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
        if (preSelected) {
          setSelectedClient(preSelected);
          await loadExistingTasks(preSelected.id);
        }
      }
    } catch (e) {
      console.error('Error loading clients:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadClients(); }, [coach, clientId]);

  const addTask = () => {
    setTasks([...tasks, { name: '', description: '', category: 'training' }]);
  };

  const removeTask = (index: number) => {
    const taskToRemove = tasks[index];
    if (taskToRemove.id) {
      setDeletedTaskIds(prev => [...prev, taskToRemove.id!]);
    }
    const updated = [...tasks];
    updated.splice(index, 1);
    setTasks(updated);
  };

  const updateTask = (index: number, field: keyof ProtocolTask, value: any) => {
    const updated = [...tasks];
    updated[index] = { ...updated[index], [field]: value };
    setTasks(updated);
  };

  const validate = () => {
    const newErrors: { [key: string]: string } = {};
    if (!selectedClient) newErrors.client = 'Please select a recipient';
    
    // Only validate tasks if there are any
    const hasEmptyTask = tasks.some(t => !t.name.trim());
    if (hasEmptyTask) {
        newErrors.tasks = 'All tasks must have a name';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreate = async () => {
    if (!validate()) {
      Alert.alert('Incomplete Form', 'Please ensure all tasks have names and a client is selected.');
      return;
    }

    if (!coach) return;

    try {
      setCreating(true);
      
      // 1. Deactivate deleted tasks
      if (deletedTaskIds.length > 0) {
        const { error: delError } = await supabase
          .from('habits')
          .update({ is_active: false })
          .in('id', deletedTaskIds);
        if (delError) throw delError;
      }

      // 2. Upsert remaining tasks
      if (tasks.length > 0) {
        const habitsToUpsert = tasks.map(t => ({
          ...(t.id ? { id: t.id } : {}),
          client_id: selectedClient!.id,
          name: t.name.trim(),
          description: t.description.trim() || null,
          category: t.category,
          is_active: true,
          target_value: t.target_value || 1,
          unit: t.unit || 'completion',
          frequency: t.frequency || 'daily',
          verification_type: t.verification_type || 'none'
        }));

        const { error } = await supabase.from('habits').upsert(habitsToUpsert);
        if (error) throw error;
      }
      
      // Show toast then navigate back to daily tasks tab
      setToastVisible(true);
      toastTimer.current = setTimeout(() => {
        setToastVisible(false);
        router.replace(`/(coach)/clients/${selectedClient!.id}?tab=daily_tasks`);
      }, 2000);
    } catch (e: any) {
      Alert.alert('Save Failed', e.message);
    } finally {
      setCreating(false);
    }
  };

  if (loading && !selectedClient) {
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
            onPress={() => router.back()} 
            style={{ padding: 12, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border }}
          >
            <ArrowLeft size={20} color={colors.textSecondary} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
              <Text style={{ color: colors.text, fontSize: 20, fontWeight: 'bold' }}>Daily Tasks</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 4 }}>Daily Habits</Text>
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
            contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingBottom: 120 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Client Selection */}
            <View style={{ marginTop: 24 }}>
                <Text style={{ color: colors.textSecondary, fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8, marginLeft: 4 }}>Target Client</Text>
                <TouchableOpacity 
                    onPress={() => setShowClientPicker(!showClientPicker)}
                    style={{ 
                        backgroundColor: colors.surface, 
                        padding: 16, 
                        borderRadius: 16, 
                        borderWidth: 1, 
                        borderColor: errors.client ? (colors.error || '#ef4444') : colors.border,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <BrandedAvatar size={36} name={selectedClient?.full_name || '?'} imageUrl={selectedClient?.avatar_url} useBrandColor={true} />
                        <View>
                            <Text style={{ fontSize: 16, fontWeight: 'bold', color: selectedClient ? colors.text : colors.textSecondary }}>
                                {selectedClient ? selectedClient.full_name : 'Select Recipient'}
                            </Text>
                            {errors.client && <Text style={{ color: colors.error || '#f87171', fontSize: 10, marginTop: 2 }}>{errors.client}</Text>}
                        </View>
                    </View>
                    <ChevronDown size={18} color={errors.client ? (colors.error || '#EF4444') : colors.textSecondary} />
                </TouchableOpacity>

                <AnimatePresence>
                    {showClientPicker && (
                        <MotiView 
                            from={{ opacity: reduceMotion ? 1 : 0, height: reduceMotion ? 'auto' : 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: reduceMotion ? 1 : 0, height: reduceMotion ? 'auto' : 0 }}
                            style={{ backgroundColor: colors.surface, marginTop: 8, borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}
                        >
                            {clients.map((c) => (
                                <TouchableOpacity 
                                    key={c.id} 
                                    onPress={() => { 
                                        setSelectedClient(c); 
                                        setShowClientPicker(false); 
                                        setErrors(prev => ({ ...prev, client: '' })); 
                                        loadExistingTasks(c.id);
                                    }} 
                                    style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}
                                >
                                    <BrandedAvatar size={28} name={c.full_name} imageUrl={c.avatar_url} useBrandColor={selectedClient?.id === c.id} />
                                    <Text style={{ color: colors.text, fontWeight: '500' }}>{c.full_name}</Text>
                                    {selectedClient?.id === c.id && <Check size={16} color={colors.primary} style={{ marginLeft: 'auto' }} />}
                                </TouchableOpacity>
                            ))}
                        </MotiView>
                    )}
                </AnimatePresence>
            </View>

            {/* Protocol Tasks */}
            <View style={{ marginTop: 32 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <View>
                        <Text style={{ color: colors.text, fontSize: 20, fontWeight: 'bold' }}>Tasks</Text>
                        <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>Define the daily requirements</Text>
                    </View>
                    <TouchableOpacity 
                        onPress={addTask}
                        style={{ paddingHorizontal: 16, paddingVertical: 8, backgroundColor: `${colors.primary}1a`, borderRadius: 12, borderWidth: 1, borderColor: `${colors.primary}33`, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                    >
                        <Plus size={16} color={colors.primary} />
                        <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 12 }}>Add Task</Text>
                    </TouchableOpacity>
                </View>

                {tasks.map((task, i) => (
                    <MotiView 
                        key={i} 
                        from={{ opacity: reduceMotion ? 1 : 0, scale: reduceMotion ? 1 : 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        style={{ backgroundColor: colors.surface, padding: 24, borderRadius: 28, borderWidth: 1, borderColor: colors.border, marginBottom: 20 }}
                    >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                                    <Text style={{ color: colors.textOnPrimary || 'white', fontSize: 10, fontWeight: '900' }}>{i + 1}</Text>
                                </View>
                                <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 12, textTransform: 'uppercase' }}>Daily Task</Text>
                            </View>
                            {tasks.length > 1 && (
                                <TouchableOpacity onPress={() => removeTask(i)} style={{ padding: 8 }}>
                                    <Trash2 size={16} color={colors.error || '#ef4444'} />
                                </TouchableOpacity>
                            )}
                        </View>

                        <TextInput 
                            style={{ 
                                backgroundColor: colors.inputBackground || colors.background, 
                                borderWidth: 1,
                                borderColor: colors.border,
                                padding: 16, 
                                borderRadius: 12, 
                                color: colors.text, 
                                fontWeight: 'bold', 
                                fontSize: 16, 
                                marginBottom: 12 
                            }}
                            placeholder="Habit Name (e.g. 5L Water)" 
                            placeholderTextColor={colors.textTertiary || '#64748b'}
                            value={task.name} 
                            onChangeText={(v) => updateTask(i, 'name', v)}
                        />

                        <TextInput 
                            style={{ 
                                backgroundColor: colors.inputBackground || colors.background, 
                                borderWidth: 1,
                                borderColor: colors.border,
                                padding: 16, 
                                borderRadius: 12, 
                                color: colors.text, 
                                fontWeight: '500', 
                                fontSize: 14, 
                                marginBottom: 16, 
                                minHeight: 60 
                            }}
                            placeholder="Optional instructions..." 
                            placeholderTextColor={colors.textTertiary || '#64748b'}
                            multiline
                            value={task.description} 
                            onChangeText={(v) => updateTask(i, 'description', v)}
                            textAlignVertical="top"
                        />

                        <Text style={{ color: colors.textSecondary, fontSize: 9, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8, marginLeft: 4 }}>Category</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
                            {(['training', 'nutrition', 'recovery', 'consistency'] as const).map((cat) => {
                                const isActive = task.category === cat;
                                return (
                                    <TouchableOpacity 
                                        key={cat} 
                                        onPress={() => updateTask(i, 'category', cat)} 
                                        style={{ 
                                            paddingHorizontal: 16, 
                                            paddingVertical: 10, 
                                            borderRadius: 12, 
                                            borderWidth: 1, 
                                            marginRight: 8,
                                            backgroundColor: isActive ? colors.primary : (colors.inputBackground || colors.background),
                                            borderColor: isActive ? colors.primary : colors.border
                                        }}
                                    >
                                        <Text style={{ fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', color: isActive ? (colors.textOnPrimary || 'white') : colors.textSecondary }}>{cat}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </MotiView>
                ))}
            </View>
          </ScrollView>

          {/* Action Bar */}
          <View style={{ paddingHorizontal: 24, paddingVertical: 16, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border }}>
              <TouchableOpacity 
                onPress={handleCreate} 
                disabled={creating}
                style={{ 
                    height: 64, 
                    borderRadius: buttonTheme?.borderRadius ? Math.max(buttonTheme.borderRadius, 20) : 24, 
                    backgroundColor: creating ? (colors.surfaceAlt || colors.surface) : colors.primary,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 12,
                    shadowColor: colors.primary,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.25,
                    shadowRadius: 8,
                    elevation: 5
                }}
                activeOpacity={0.8}
              >
                {creating ? (
                    <>
                        <ActivityIndicator color={colors.textOnPrimary || 'white'} />
                        <Text style={{ color: colors.textOnPrimary || 'white', fontWeight: 'bold', fontSize: 18 }}>Saving...</Text>
                    </>
                ) : (
                    <>
                        <ShieldCheck size={22} color={colors.textOnPrimary || 'white'} />
                        <Text style={{ color: colors.textOnPrimary || 'white', fontWeight: 'bold', fontSize: 18 }}>Save Tasks</Text>
                    </>
                )}
              </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Toast notification */}
      {toastVisible && (
        <MotiView
          from={{ opacity: reduceMotion ? 1 : 0, translateY: reduceMotion ? 0 : 16 }}
          animate={{ opacity: 1, translateY: 0 }}
          style={{
            position: 'absolute',
            bottom: 110,
            left: 24,
            right: 24,
            backgroundColor: colors.primary,
            borderRadius: 20,
            paddingVertical: 16,
            paddingHorizontal: 20,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.35,
            shadowRadius: 16,
            elevation: 10,
            zIndex: 100,
          }}
        >
          <ShieldCheck size={20} color={colors.textOnPrimary || 'white'} />
          <Text style={{ color: colors.textOnPrimary || 'white', fontWeight: 'bold', fontSize: 15, flex: 1 }}>
            Daily tasks updated for {selectedClient?.full_name}
          </Text>
        </MotiView>
      )}
    </View>
  );
}
