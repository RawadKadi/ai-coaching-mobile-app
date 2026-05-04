import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, SafeAreaView, Platform, KeyboardAvoidingView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MotiView, AnimatePresence } from 'moti';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, Plus, Trash2, Check, ChevronDown, ClipboardList, Info, Flame, Zap, ShieldCheck } from 'lucide-react-native';
import { BrandedAvatar } from '@/components/BrandedAvatar';

interface Client {
  id: string;
  full_name: string;
  avatar_url?: string;
}

interface ProtocolTask {
  name: string;
  description: string;
  category: 'training' | 'nutrition' | 'recovery' | 'consistency';
}

export default function CreateProtocolScreen() {
  const router = useRouter();
  const { clientId } = useLocalSearchParams();
  const { coach } = useAuth();

  // Form State
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [tasks, setTasks] = useState<ProtocolTask[]>([
    { name: '', description: '', category: 'training' }
  ]);

  // UI State
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

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

  const addTask = () => {
    setTasks([...tasks, { name: '', description: '', category: 'training' }]);
  };

  const removeTask = (index: number) => {
    if (tasks.length === 1) return;
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
      
      const habitsToInsert = tasks.map(t => ({
        client_id: selectedClient!.id,
        name: t.name.trim(),
        description: t.description.trim() || null,
        category: t.category,
        is_active: true,
        target_value: 1, // Default for protocols
        unit: 'completion',
        frequency: 'daily',
        verification_type: 'none'
      }));

      const { error } = await supabase.from('habits').insert(habitsToInsert);

      if (error) throw error;
      
      Alert.alert('Success', 'Daily Tasks successfully assigned!', [
        { text: 'View Client', onPress: () => router.push(`/(coach)/clients/${selectedClient!.id}`) }
      ]);
    } catch (e: any) {
      Alert.alert('Deployment Failed', e.message);
    } finally {
      setCreating(false);
    }
  };

  if (loading && !selectedClient) {
    return (
      <View style={{ flex: 1, backgroundColor: '#020617', itemsCenter: 'center', justifyContent: 'center' }}>
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
              <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold' }}>Create Tasks</Text>
              <Text style={{ color: '#64748b', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 4 }}>Daily Habits</Text>
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

                <AnimatePresence>
                    {showClientPicker && (
                        <MotiView 
                            from={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            style={{ backgroundColor: '#0f172a', marginTop: 8, borderRadius: 16, borderWidth: 1, borderColor: '#1e293b', overflow: 'hidden' }}
                        >
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
                        </MotiView>
                    )}
                </AnimatePresence>
            </View>

            {/* Protocol Tasks */}
            <View style={{ marginTop: 40 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <View>
                        <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold' }}>Tasks</Text>
                        <Text style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>Define the daily requirements</Text>
                    </View>
                    <TouchableOpacity 
                        onPress={addTask}
                        style={{ paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#3b82f61a', borderRadius: 12, borderWidth: 1, borderColor: '#3b82f633', flexDirection: 'row', alignItems: 'center', gap: 6 }}
                    >
                        <Plus size={16} color="#3B82F6" />
                        <Text style={{ color: '#3B82F6', fontWeight: 'bold', fontSize: 12 }}>Add Task</Text>
                    </TouchableOpacity>
                </View>

                {tasks.map((task, i) => (
                    <MotiView 
                        key={i} 
                        from={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        style={{ backgroundColor: '#0f172a', padding: 24, borderRadius: 28, borderWidth: 1, borderColor: '#1e293b', marginBottom: 20 }}
                    >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center' }}>
                                    <Text style={{ color: 'white', fontSize: 10, fontWeight: '900' }}>{i + 1}</Text>
                                </View>
                                <Text style={{ color: '#10B981', fontWeight: 'bold', fontSize: 12, textTransform: 'uppercase' }}>Daily Task</Text>
                            </View>
                            {tasks.length > 1 && (
                                <TouchableOpacity onPress={() => removeTask(i)} style={{ padding: 8 }}>
                                    <Trash2 size={16} color="#ef4444" />
                                </TouchableOpacity>
                            )}
                        </View>

                        <TextInput 
                            style={{ backgroundColor: '#1e293b80', padding: 16, borderRadius: 12, color: 'white', fontWeight: 'bold', fontSize: 16, marginBottom: 12 }}
                            placeholder="Habit Name (e.g. 5L Water)" 
                            placeholderTextColor="#475569"
                            value={task.name} 
                            onChangeText={(v) => updateTask(i, 'name', v)}
                        />

                        <TextInput 
                            style={{ backgroundColor: '#1e293b80', padding: 16, borderRadius: 12, color: '#cbd5e1', fontWeight: '500', fontSize: 14, marginBottom: 16, minHeight: 60 }}
                            placeholder="Optional instructions..." 
                            placeholderTextColor="#475569"
                            multiline
                            value={task.description} 
                            onChangeText={(v) => updateTask(i, 'description', v)}
                            textAlignVertical="top"
                        />

                        <Text style={{ color: '#64748b', fontSize: 9, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8, marginLeft: 4 }}>Category</Text>
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
                                            backgroundColor: isActive ? '#10B981' : '#020617',
                                            borderColor: isActive ? '#34D399' : '#1e293b'
                                        }}
                                    >
                                        <Text style={{ fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', color: isActive ? 'white' : '#64748b' }}>{cat}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </MotiView>
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
                    backgroundColor: creating ? '#1e293b' : '#10B981',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 12,
                    shadowColor: '#10B981',
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
                        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 18 }}>Deploying Protocol...</Text>
                    </>
                ) : (
                    <>
                        <ShieldCheck size={22} color="white" />
                        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 18 }}>Assign Tasks</Text>
                    </>
                )}
              </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
