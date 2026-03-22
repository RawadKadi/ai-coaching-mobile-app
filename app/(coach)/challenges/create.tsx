import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, SafeAreaView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MotiView, AnimatePresence } from 'moti';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { ChallengeFocusType } from '@/types/database';
import { X, Plus, Calendar, Target, Trash2, ArrowLeft, ChevronDown, Check } from 'lucide-react-native';
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
  intensity: 'light' | 'moderate' | 'intense';
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
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showClientPicker, setShowClientPicker] = useState(false);

  useEffect(() => { loadClients(); }, []);
  useEffect(() => {
    const duration = parseInt(durationDays);
    if (!isNaN(duration) && duration >= 3 && duration <= 14) generateSubChallenges(duration);
  }, [durationDays, startDate]);

  const loadClients = async () => {
    if (!coach) return;
    try {
      const { data, error } = await supabase.rpc('get_coach_clients', { p_coach_id: coach.id });
      if (error) throw error;
      setClients(data || []);
      if (clientId && data) {
        const preSelected = data.find((c: any) => c.id === clientId);
        if (preSelected) setSelectedClient(preSelected);
      }
    } catch (e) { console.error(e); }
  };

  const generateSubChallenges = (days: number) => {
    const start = new Date(startDate);
    const subs: SubChallenge[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      subs.push({ name: `Day ${i + 1} Mission`, description: '', assigned_date: d.toISOString().split('T')[0], focus_type: 'training', intensity: 'moderate' });
    }
    setSubChallenges(subs);
  };

  const updateSubChallenge = (index: number, field: keyof SubChallenge, value: any) => {
    const updated = [...subChallenges];
    updated[index] = { ...updated[index], [field]: value };
    setSubChallenges(updated);
  };

  const handleCreate = async () => {
    if (!selectedClient || !name.trim() || !coach) {
      Alert.alert('Missing Info', 'Please ensure all required fields are filled.');
      return;
    }
    try {
      setCreating(true);
      const endDate = new Date(startDate); endDate.setDate(endDate.getDate() + parseInt(durationDays) - 1);
      const { error } = await supabase.rpc('create_mother_challenge', {
        p_coach_id: coach.id, p_client_id: selectedClient.id, p_name: name.trim(),
        p_description: description.trim() || null, p_start_date: startDate,
        p_end_date: endDate.toISOString().split('T')[0], p_sub_challenges: subChallenges,
        p_created_by: 'coach', p_mode: mode,
      });
      if (error) throw error;
      Alert.alert('Success', 'Plan launched to client hub.', [{ text: 'Done', onPress: () => router.back() }]);
    } catch (e: any) { Alert.alert('Error', e.message); } finally { setCreating(false); }
  };

  return (
    <View className="flex-1 bg-slate-950">
      <SafeAreaView className="flex-1">
        <View className="px-6 pt-8 pb-4 flex-row items-center justify-between">
          <TouchableOpacity onPress={() => router.back()} className="p-2 bg-slate-900 rounded-full border border-slate-800">
            <ArrowLeft size={20} color="#94A3B8" />
          </TouchableOpacity>
          <Text className="text-white text-xl font-bold">Manual Create</Text>
          <View className="w-10" />
        </View>

        <ScrollView className="flex-1 px-6" contentContainerStyle={{ paddingBottom: 120 }}>
          {/* Client Selection */}
          <View className="mt-6">
            <Text className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-2">Target Client</Text>
            <TouchableOpacity 
              onPress={() => setShowClientPicker(!showClientPicker)}
              className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex-row items-center justify-between"
            >
              <View className="flex-row items-center gap-3">
                 <BrandedAvatar size={32} name={selectedClient?.full_name || 'C'} imageUrl={selectedClient?.avatar_url} />
                 <Text className={`font-bold ${selectedClient ? 'text-white' : 'text-slate-500'}`}>
                    {selectedClient ? selectedClient.full_name : 'Select Recipient'}
                 </Text>
              </View>
              <ChevronDown size={18} color="#475569" />
            </TouchableOpacity>

            <AnimatePresence>
              {showClientPicker && (
                <MotiView from={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="overflow-hidden">
                  <View className="bg-slate-900/50 mt-2 rounded-2xl border border-slate-800">
                    {clients.map((c) => (
                      <TouchableOpacity key={c.id} onPress={() => { setSelectedClient(c); setShowClientPicker(false); }} className="p-4 border-b border-slate-800 flex-row items-center gap-3">
                         <BrandedAvatar size={24} name={c.full_name} imageUrl={c.avatar_url} />
                         <Text className="text-slate-300 font-medium">{c.full_name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </MotiView>
              )}
            </AnimatePresence>
          </View>

          {/* Mode Switch */}
          <View className="mt-8">
             <Text className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-3">Protocol Mode</Text>
             <View className="flex-row bg-slate-900 p-1.5 rounded-2xl border border-slate-800">
                <TouchableOpacity onPress={() => setMode('relative')} className={`flex-1 py-3 items-center rounded-xl flex-row justify-center gap-2 ${mode === 'relative' ? 'bg-blue-600' : ''}`}>
                   <Target size={16} color={mode === 'relative' ? 'white' : '#475569'} />
                   <Text className={`font-bold text-xs ${mode === 'relative' ? 'text-white' : 'text-slate-500'}`}>Adaptive</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setMode('fixed')} className={`flex-1 py-3 items-center rounded-xl flex-row justify-center gap-2 ${mode === 'fixed' ? 'bg-blue-600' : ''}`}>
                   <Calendar size={16} color={mode === 'fixed' ? 'white' : '#475569'} />
                   <Text className={`font-bold text-xs ${mode === 'fixed' ? 'text-white' : 'text-slate-500'}`}>Fixed</Text>
                </TouchableOpacity>
             </View>
          </View>

          {/* Details */}
          <View className="mt-10 gap-6">
              <View>
                 <Text className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-2">Plan Identity</Text>
                 <TextInput 
                    className="bg-slate-900 p-5 rounded-2xl border border-slate-800 text-white font-bold text-lg"
                    placeholder="e.g. 10-Day Hypertrophy Push" placeholderTextColor="#475569"
                    value={name} onChangeText={setName}
                 />
              </View>
              <View>
                 <Text className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-2">Meta Description</Text>
                 <TextInput 
                    className="bg-slate-900 p-5 rounded-2xl border border-slate-800 text-white font-medium min-h-[100px]"
                    placeholder="Core objectives of this protocol..." placeholderTextColor="#475569"
                    multiline value={description} onChangeText={setDescription}
                 />
              </View>
              <View className="flex-row gap-4">
                  <View className="flex-1">
                    <Text className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-2">Cycle Days</Text>
                    <TextInput 
                        className="bg-slate-900 p-5 rounded-2xl border border-slate-800 text-white font-bold"
                        keyboardType="number-pad" value={durationDays} onChangeText={setDurationDays}
                    />
                  </View>
                  {mode === 'fixed' && (
                    <View className="flex-2">
                       <Text className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-2">Launch Date</Text>
                       <TextInput className="bg-slate-900 p-5 rounded-2xl border border-slate-800 text-white font-bold" value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" placeholderTextColor="#475569" />
                    </View>
                  )}
              </View>
          </View>

          {/* Daily Missions */}
          <View className="mt-12">
              <View className="flex-row justify-between items-center mb-6">
                 <Text className="text-white text-lg font-bold">Daily Missions</Text>
                 <View className="px-3 py-1 bg-blue-600/10 rounded-full border border-blue-500/20">
                    <Text className="text-blue-400 text-[10px] font-black uppercase tracking-widest">{subChallenges.length} Total</Text>
                 </View>
              </View>

              {subChallenges.map((sub, i) => (
                <MotiView key={i} from={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-slate-900 p-6 rounded-[32px] border border-slate-800 mb-6">
                   <View className="flex-row justify-between items-center mb-4">
                      <Text className="text-blue-500 font-bold text-xs">Mission Day {i + 1}</Text>
                      <Text className="text-slate-600 font-medium text-[10px]">{sub.assigned_date}</Text>
                   </View>
                   <TextInput 
                      className="text-white font-bold text-lg mb-4"
                      placeholder="Mission Name" placeholderTextColor="#475569"
                      value={sub.name} onChangeText={(v) => updateSubChallenge(i, 'name', v)}
                   />
                   
                   <View className="flex-row flex-wrap gap-2 mt-2">
                      {(['training', 'nutrition', 'recovery'] as ChallengeFocusType[]).map((f) => {
                         const isActive = sub.focus_type === f;
                         return (
                            <TouchableOpacity key={f} onPress={() => updateSubChallenge(i, 'focus_type', f)} className={`px-4 py-2 rounded-xl border ${isActive ? 'bg-blue-600 border-blue-400' : 'bg-slate-950 border-slate-800'}`}>
                               <Text className={`text-[10px] font-black uppercase tracking-tighter ${isActive ? 'text-white' : 'text-slate-500'}`}>{f}</Text>
                            </TouchableOpacity>
                         );
                      })}
                   </View>
                   <View className="flex-row flex-wrap gap-2 mt-3">
                      {(['light', 'moderate', 'intense'] as const).map((int) => {
                         const isActive = sub.intensity === int;
                         return (
                            <TouchableOpacity key={int} onPress={() => updateSubChallenge(i, 'intensity', int)} className={`px-4 py-2 rounded-xl border ${isActive ? 'bg-slate-200 border-white' : 'bg-slate-950 border-slate-800'}`}>
                               <Text className={`text-[10px] font-black uppercase tracking-tighter ${isActive ? 'text-slate-950' : 'text-slate-500'}`}>{int}</Text>
                            </TouchableOpacity>
                         );
                      })}
                   </View>
                </MotiView>
              ))}
          </View>
        </ScrollView>

        {/* Action Bar */}
        <View className="absolute bottom-0 w-full p-6 bg-slate-950/90 border-t border-slate-900">
            <TouchableOpacity 
               onPress={handleCreate} disabled={creating}
               className="h-16 bg-blue-600 rounded-3xl flex-row items-center justify-center gap-3 shadow-2xl shadow-blue-500/20"
            >
               {creating ? <ActivityIndicator color="white" /> : (
                 <>
                   <Plus size={22} color="white" />
                   <Text className="text-white font-bold text-lg">Launch Sequence</Text>
                 </>
               )}
            </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}
