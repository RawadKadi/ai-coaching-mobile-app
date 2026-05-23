import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, SafeAreaView, Platform, KeyboardAvoidingView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MotiView, AnimatePresence } from 'moti';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { ChallengeFocusType } from '@/types/database';
import { X, Plus, Calendar, Target, Trash2, ArrowLeft, ChevronDown, Check, Info, Flame, Zap, ShieldCheck } from 'lucide-react-native';
import { BrandedAvatar } from '@/components/BrandedAvatar';
import { BrandedCalendar } from '@/components/BrandedCalendar';
import { BrandedDurationPicker } from '@/components/BrandedDurationPicker';

interface Client {
  id: string;
  full_name: string;
  avatar_url?: string;
}

interface ChallengeInput {
  id: string;
  name: string;
  description: string;
  focus_type: ChallengeFocusType;
  intensity: 'low' | 'medium' | 'high';
}

interface DayInput {
  dayId: string;
  challenges: ChallengeInput[];
}

const createDefaultChallenge = (name: string): ChallengeInput => ({
  id: Math.random().toString(36).substring(7),
  name,
  description: '',
  focus_type: 'training',
  intensity: 'medium'
});

const formatDisplayDate = (dateStr: string) => {
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  } catch (e) {
    return dateStr;
  }
};

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
  const [days, setDays] = useState<DayInput[]>([]);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // UI State
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const [isSuccess, setIsSuccess] = useState(false);

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

  // Initialize days on mount
  useEffect(() => {
    if (days.length === 0) {
      const duration = parseInt(durationDays) || 7;
      const initialDays: DayInput[] = [];
      for (let i = 0; i < duration; i++) {
        initialDays.push({
          dayId: Math.random().toString(36).substring(7),
          challenges: [createDefaultChallenge(`Day ${i + 1} Mission`)]
        });
      }
      setDays(initialDays);
    }
  }, []);

  const handleDurationChange = (text: string) => {
    setDurationDays(text);
    const duration = parseInt(text);
    if (!isNaN(duration) && duration > 0) {
      setDays(prevDays => {
        const currentCount = prevDays.length;
        if (duration > currentCount) {
          const added: DayInput[] = [];
          for (let i = currentCount; i < duration; i++) {
            added.push({
              dayId: Math.random().toString(36).substring(7),
              challenges: [createDefaultChallenge(`Day ${i + 1} Mission`)]
            });
          }
          return [...prevDays, ...added];
        } else if (duration < currentCount) {
          return prevDays.slice(0, duration);
        }
        return prevDays;
      });
      if (errors.durationDays) {
        const newErrors = { ...errors };
        delete newErrors.durationDays;
        setErrors(newErrors);
      }
    } else {
      setErrors(prev => ({ ...prev, durationDays: 'Please enter a valid number of days' }));
    }
  };

  const addDay = () => {
    setDays(prevDays => {
      const newDayIndex = prevDays.length;
      const updated: DayInput[] = [
        ...prevDays,
        {
          dayId: Math.random().toString(36).substring(7),
          challenges: [createDefaultChallenge(`Day ${newDayIndex + 1} Mission`)]
        }
      ];
      setDurationDays(updated.length.toString());
      return updated;
    });
  };

  const deleteDay = (indexToDelete: number) => {
    setDays(prevDays => {
      const updated = prevDays.filter((_, idx) => idx !== indexToDelete);
      setDurationDays(updated.length.toString());
      return updated;
    });
  };

  const addChallengeToDay = (dayIndex: number) => {
    setDays(prevDays => {
      const updated = [...prevDays];
      updated[dayIndex] = {
        ...updated[dayIndex],
        challenges: [
          ...updated[dayIndex].challenges,
          createDefaultChallenge('')
        ]
      };
      return updated;
    });
  };

  const deleteChallenge = (dayIndex: number, challengeIndex: number) => {
    setDays(prevDays => {
      const updated = [...prevDays];
      updated[dayIndex] = {
        ...updated[dayIndex],
        challenges: updated[dayIndex].challenges.filter((_, idx) => idx !== challengeIndex)
      };
      return updated;
    });
  };

  const updateChallengeField = (dayIndex: number, challengeIndex: number, field: keyof ChallengeInput, value: any) => {
    setDays(prevDays => {
      const updated = [...prevDays];
      const updatedChallenges = [...updated[dayIndex].challenges];
      updatedChallenges[challengeIndex] = {
        ...updatedChallenges[challengeIndex],
        [field]: value
      };
      updated[dayIndex] = {
        ...updated[dayIndex],
        challenges: updatedChallenges
      };
      return updated;
    });
  };

  const getAssignedDate = (dayIndex: number) => {
    if (!startDate) return '';
    const [year, month, day] = startDate.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() + dayIndex);
    
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const validate = () => {
    const newErrors: { [key: string]: string } = {};
    if (!selectedClient) newErrors.client = 'Please select a client';
    if (!name.trim()) newErrors.name = 'Challenge name is required';
    
    const duration = parseInt(durationDays);
    if (isNaN(duration) || duration < 3 || duration > 14) {
        newErrors.durationDays = 'Must be 3-14 days';
    }

    let hasEmptyDay = false;
    let hasEmptyTaskName = false;
    days.forEach((day) => {
      if (day.challenges.length === 0) {
        hasEmptyDay = true;
      }
      day.challenges.forEach(ch => {
        if (!ch.name.trim()) {
          hasEmptyTaskName = true;
        }
      });
    });

    if (hasEmptyDay) {
      newErrors.tasks = 'Each day must have at least one task';
    } else if (hasEmptyTaskName) {
      newErrors.tasks = 'Please fill in all task names';
    }

    setErrors(newErrors);
    return newErrors;
  };

  const handleCreate = async () => {
    const newErrors = validate();
    if (Object.keys(newErrors).length > 0) {
      let alertMsg = 'Please check the form fields.';
      if (newErrors.client) alertMsg = newErrors.client;
      else if (newErrors.name) alertMsg = newErrors.name;
      else if (newErrors.durationDays) alertMsg = newErrors.durationDays;
      else if (newErrors.tasks) alertMsg = newErrors.tasks;
      Alert.alert('Form Incomplete', alertMsg);
      return;
    }

    if (!coach) return;

    try {
      setCreating(true);
      
      const [year, month, day] = startDate.split('-').map(Number);
      const endDateObj = new Date(year, month - 1, day);
      endDateObj.setDate(endDateObj.getDate() + days.length - 1);
      
      const y = endDateObj.getFullYear();
      const m = String(endDateObj.getMonth() + 1).padStart(2, '0');
      const d = String(endDateObj.getDate()).padStart(2, '0');
      const endDateStr = `${y}-${m}-${d}`;

      const mappedSubChallenges = days.flatMap((day, dayIndex) => {
        const assignedDate = getAssignedDate(dayIndex);
        return day.challenges.map(ch => ({
          name: ch.name.trim() || `Day ${dayIndex + 1} Mission`,
          description: ch.description.trim(),
          assigned_date: assignedDate,
          focus_type: ch.focus_type,
          intensity: ch.intensity
        }));
      });

      const { error } = await supabase.rpc('create_mother_challenge', {
        p_coach_id: coach.id,
        p_client_id: selectedClient!.id,
        p_name: name.trim(),
        p_description: description.trim() || null,
        p_start_date: startDate,
        p_end_date: endDateStr,
        p_sub_challenges: mappedSubChallenges,
        p_created_by: 'coach',
        p_mode: mode,
      });

      if (error) throw error;
      setIsSuccess(true);
    } catch (e: any) {
      Alert.alert('Start Failed', e.message);
    } finally {
      setCreating(false);
    }
  };

  if (isSuccess) {
    return (
      <View className="flex-1 bg-slate-950 items-center justify-center px-6">
        <MotiView
          from={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', damping: 15 }}
          className="w-24 h-24 bg-blue-600 rounded-full items-center justify-center mb-8 shadow-2xl shadow-blue-500/50"
        >
          <Check size={48} color="white" strokeWidth={4} />
        </MotiView>
        
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ delay: 200 }}
          className="items-center"
        >
          <Text className="text-white text-4xl font-black tracking-tighter mb-4 text-center">Challenge Started!</Text>
          <Text className="text-slate-400 text-lg text-center leading-6 px-4">
            {(selectedClient?.full_name || '').split(' ')[0]} can now see their tasks.
          </Text>
        </MotiView>

        <MotiView
          from={{ opacity: 0, translateY: 40 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ delay: 400 }}
          className="w-full mt-16"
        >
          <TouchableOpacity 
            onPress={() => router.replace('/(coach)/(tabs)')}
            className="w-full h-16 bg-blue-600 rounded-3xl items-center justify-center shadow-xl shadow-blue-500/20"
          >
            <Text className="text-white text-xl font-bold">Close</Text>
          </TouchableOpacity>
        </MotiView>
      </View>
    );
  }

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
              <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold' }}>New Challenge</Text>
              <Text style={{ color: '#64748b', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 4 }}>Challenge details</Text>
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
                    <Text style={{ color: '#64748b', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8, marginLeft: 4 }}>Client</Text>
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
                                    {selectedClient ? selectedClient.full_name : 'Select Client'}
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
                    <Text style={{ color: '#64748b', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12, marginLeft: 4 }}>Timing</Text>
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
                            <Text style={{ fontSize: 12, fontWeight: 'bold', color: mode === 'relative' ? 'white' : '#64748b' }}>Flexible</Text>
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
                            <Text style={{ fontSize: 12, fontWeight: 'bold', color: mode === 'fixed' ? 'white' : '#64748b' }}>Set Date</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Details */}
                <View style={{ marginTop: 32 }}>
                    <View>
                        <Text style={{ color: '#64748b', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8, marginLeft: 4 }}>Challenge Name</Text>
                        <TextInput 
                            style={{ backgroundColor: '#0f172a', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: errors.name ? '#ef444466' : '#1e293b', color: 'white', fontWeight: 'bold', fontSize: 18 }}
                            placeholder="e.g. 10-Day Workout Challenge" 
                            placeholderTextColor="#334155"
                            value={name} 
                            onChangeText={(t) => { setName(t); setErrors(prev => ({ ...prev, name: '' })); }}
                        />
                        {errors.name && <Text style={{ color: '#f87171', fontSize: 10, marginTop: 8, marginLeft: 4 }}>{errors.name}</Text>}
                    </View>

                    <View style={{ marginTop: 24 }}>
                        <Text style={{ color: '#64748b', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8, marginLeft: 4 }}>Challenge Description</Text>
                        <TextInput 
                            style={{ backgroundColor: '#0f172a', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#1e293b', color: 'white', fontWeight: '500', minHeight: 100 }}
                            placeholder="Describe the challenge..." 
                            placeholderTextColor="#334155"
                            multiline 
                            value={description} 
                            onChangeText={setDescription}
                            textAlignVertical="top"
                        />
                    </View>

                    {/* Duration Picker */}
                    <View style={{ marginTop: 24 }}>
                        <BrandedDurationPicker 
                            value={parseInt(durationDays) || 7}
                            onSelect={(val) => handleDurationChange(val.toString())}
                            label="Number of Days"
                        />
                    </View>

                    {/* Start Date Selector */}
                    {mode === 'fixed' && (
                        <View style={{ marginTop: 24 }}>
                            <Text style={{ color: '#64748B', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12, marginLeft: 4 }}>Start Date</Text>
                            <TouchableOpacity 
                                onPress={() => setShowDatePicker(!showDatePicker)}
                                activeOpacity={0.8}
                                style={{ 
                                    height: 80,
                                    backgroundColor: '#0F172A',
                                    borderWidth: 1,
                                    borderColor: 'rgba(255, 255, 255, 0.05)',
                                    borderRadius: 28,
                                    paddingHorizontal: 32,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 10 },
                                    shadowOpacity: 0.4,
                                    shadowRadius: 20,
                                    elevation: 8,
                                }}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <View style={{
                                        width: 40,
                                        height: 40,
                                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                        borderRadius: 12,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        borderWidth: 1,
                                        borderColor: 'rgba(59, 130, 246, 0.2)',
                                        marginRight: 16,
                                    }}>
                                        <Calendar size={20} color="#3B82F6" />
                                    </View>
                                    <View>
                                        <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 20 }}>
                                            {formatDisplayDate(startDate)}
                                        </Text>
                                        <Text style={{ color: '#64748B', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 }}>
                                            Start Date
                                        </Text>
                                    </View>
                                </View>
                                <ChevronDown size={20} color={showDatePicker ? '#3b82f6' : '#475569'} />
                            </TouchableOpacity>
                        </View>
                    )}

                    {mode === 'fixed' && showDatePicker && (
                        <View style={{ marginTop: 24 }}>
                            <BrandedCalendar 
                                selectedDate={(() => {
                                    const [year, month, day] = startDate.split('-').map(Number);
                                    return new Date(year, month - 1, day);
                                })()}
                                onSelect={(date) => {
                                    const y = date.getFullYear();
                                    const m = String(date.getMonth() + 1).padStart(2, '0');
                                    const d = String(date.getDate()).padStart(2, '0');
                                    setStartDate(`${y}-${m}-${d}`);
                                    setShowDatePicker(false);
                                }}
                            />
                        </View>
                    )}
                </View>
            </View>

            {/* Phase 2: Daily Tasks */}
            <View style={{ marginTop: 48 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24, paddingHorizontal: 4 }}>
                    <View>
                        <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold' }}>Daily Tasks</Text>
                        <Text style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>Add tasks for each day</Text>
                    </View>
                    <View style={{ paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#3b82f61a', borderRadius: 12, borderWidth: 1, borderColor: '#3b82f633' }}>
                        <Text style={{ color: '#60a5fa', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5 }}>{days.length} Days</Text>
                    </View>
                </View>

                {days.map((day, dayIndex) => (
                    <View 
                        key={day.dayId} 
                        style={{ backgroundColor: '#0f172a', padding: 20, borderRadius: 28, borderWidth: 1, borderColor: '#1e293b', marginBottom: 24 }}
                    >
                        {/* Day Header */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#1e293b80', paddingBottom: 12 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center' }}>
                                    <Text style={{ color: 'white', fontSize: 10, fontWeight: '900' }}>{dayIndex + 1}</Text>
                                </View>
                                <Text style={{ color: '#3b82f6', fontWeight: 'bold', fontSize: 12, textTransform: 'uppercase' }}>Day {dayIndex + 1}</Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, opacity: 0.6 }}>
                                    <Calendar size={10} color="#64748B" />
                                    <Text style={{ color: '#64748b', fontWeight: '500', fontSize: 10 }}>{getAssignedDate(dayIndex)}</Text>
                                </View>
                                <TouchableOpacity 
                                    onPress={() => deleteDay(dayIndex)}
                                    style={{ padding: 4 }}
                                >
                                    <Trash2 size={16} color="#ef4444" />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* List of Tasks inside Day */}
                        {day.challenges.map((ch, chIndex) => (
                            <View 
                                key={ch.id} 
                                style={{ 
                                    backgroundColor: '#1e293b40', 
                                    padding: 16, 
                                    borderRadius: 20, 
                                    borderWidth: 1, 
                                    borderColor: '#1e293b80', 
                                    marginBottom: chIndex === day.challenges.length - 1 ? 0 : 16 
                                }}
                            >
                                {/* Task Sub-Header */}
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                    <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 }}>
                                        Task {chIndex + 1}
                                    </Text>
                                    <TouchableOpacity 
                                        onPress={() => deleteChallenge(dayIndex, chIndex)}
                                        style={{ padding: 4 }}
                                    >
                                        <X size={14} color="#ef4444" />
                                    </TouchableOpacity>
                                </View>

                                {/* Task Name */}
                                <TextInput 
                                    style={{ backgroundColor: '#1e293b80', padding: 12, borderRadius: 12, color: 'white', fontWeight: 'bold', fontSize: 15, marginBottom: 12 }}
                                    placeholder="Task Name" 
                                    placeholderTextColor="#475569"
                                    value={ch.name} 
                                    onChangeText={(v) => updateChallengeField(dayIndex, chIndex, 'name', v)}
                                />

                                {/* Task Details */}
                                <TextInput 
                                    style={{ backgroundColor: '#1e293b80', padding: 12, borderRadius: 12, color: '#cbd5e1', fontWeight: '500', fontSize: 13, marginBottom: 12, minHeight: 50 }}
                                    placeholder="Add task details..." 
                                    placeholderTextColor="#475569"
                                    multiline
                                    value={ch.description} 
                                    onChangeText={(v) => updateChallengeField(dayIndex, chIndex, 'description', v)}
                                    textAlignVertical="top"
                                />
                                
                                {/* Focus Type Tags */}
                                <Text style={{ color: '#64748b', fontSize: 9, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8, marginLeft: 4 }}>Focus</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', marginBottom: 12 }}>
                                    {(['training', 'nutrition', 'recovery', 'consistency'] as ChallengeFocusType[]).map((f) => {
                                        const isActive = ch.focus_type === f;
                                        return (
                                            <TouchableOpacity 
                                                key={f} 
                                                onPress={() => updateChallengeField(dayIndex, chIndex, 'focus_type', f)} 
                                                style={{ 
                                                    paddingHorizontal: 12, 
                                                    paddingVertical: 8, 
                                                    borderRadius: 10, 
                                                    borderWidth: 1, 
                                                    marginRight: 6,
                                                    backgroundColor: isActive ? '#2563eb' : '#020617',
                                                    borderColor: isActive ? '#60a5fa' : '#1e293b'
                                                }}
                                            >
                                                <Text style={{ fontSize: 9, fontWeight: 'bold', textTransform: 'uppercase', color: isActive ? 'white' : '#64748b' }}>{f}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </ScrollView>

                                {/* Intensity Level */}
                                <Text style={{ color: '#64748b', fontSize: 9, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8, marginLeft: 4 }}>Difficulty</Text>
                                <View style={{ flexDirection: 'row', gap: 6 }}>
                                    {(['low', 'medium', 'high'] as const).map((int) => {
                                        const isActive = ch.intensity === int;
                                        let color = '#64748B';
                                        if (isActive) {
                                            if (int === 'low') color = '#10B981';
                                            if (int === 'medium') color = '#F59E0B';
                                            if (int === 'high') color = '#EF4444';
                                        }

                                        return (
                                            <TouchableOpacity 
                                                key={int} 
                                                onPress={() => updateChallengeField(dayIndex, chIndex, 'intensity', int)} 
                                                style={{ 
                                                    flex: 1, 
                                                    paddingVertical: 8, 
                                                    borderRadius: 10, 
                                                    borderWidth: 1.5,
                                                    alignItems: 'center',
                                                    flexDirection: 'row',
                                                    justifyContent: 'center',
                                                    gap: 4,
                                                    backgroundColor: '#020617',
                                                    borderColor: isActive ? color : '#1e293b'
                                                }}
                                            >
                                                <Flame size={10} color={isActive ? color : '#334155'} />
                                                <Text style={{ fontSize: 9, fontWeight: 'bold', textTransform: 'uppercase', color: isActive ? 'white' : '#64748b' }}>{int}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>
                        ))}

                        {day.challenges.length === 0 ? (
                            <View style={{ alignItems: 'center', padding: 16, backgroundColor: '#1e293b20', borderRadius: 20, borderWidth: 1, borderColor: '#1e293b40', borderStyle: 'dashed' }}>
                                <Text style={{ color: '#64748b', fontSize: 12, fontStyle: 'italic' }}>No tasks assigned for this day</Text>
                            </View>
                        ) : null}

                        {/* Add Task Button inside Day Card */}
                        <TouchableOpacity 
                            onPress={() => addChallengeToDay(dayIndex)}
                            style={{ 
                                flexDirection: 'row', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                gap: 8,
                                paddingVertical: 12, 
                                borderRadius: 16, 
                                borderWidth: 1,
                                borderColor: '#1e293b',
                                borderStyle: 'dashed',
                                marginTop: 16
                            }}
                        >
                            <Plus size={16} color="#3b82f6" />
                            <Text style={{ color: '#3b82f6', fontWeight: 'bold', fontSize: 13 }}>Add Task</Text>
                        </TouchableOpacity>
                    </View>
                ))}

                {/* Add Day Card */}
                <TouchableOpacity 
                    onPress={addDay}
                    style={{ 
                        backgroundColor: '#0f172a50', 
                        padding: 24, 
                        borderRadius: 28, 
                        borderWidth: 1.5, 
                        borderColor: '#1e293b', 
                        borderStyle: 'dashed', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        flexDirection: 'row',
                        gap: 8,
                        marginBottom: 24
                    }}
                >
                    <Plus size={20} color="#3b82f6" />
                    <Text style={{ color: '#3b82f6', fontWeight: 'bold', fontSize: 16 }}>Add Day</Text>
                </TouchableOpacity>
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
                        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 18 }}>Starting...</Text>
                    </>
                ) : (
                    <>
                        <ShieldCheck size={22} color="white" />
                        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 18 }}>Start Challenge</Text>
                    </>
                )}
              </TouchableOpacity>
              <Text style={{ textAlign: 'center', color: '#475569', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 12 }}>Client will see this immediately</Text>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
