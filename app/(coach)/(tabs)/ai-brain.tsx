import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { MotiView, AnimatePresence } from 'moti';
import { ArrowLeft, Sparkles, Brain, Zap, Shield, ChevronRight, Save } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { AICoachBrain } from '@/types/database';

export default function AIBrainScreen() {
  const router = useRouter();
  const { coach } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [brainConfig, setBrainConfig] = useState<AICoachBrain | null>(null);
  const [tone, setTone] = useState('');
  const [style, setStyle] = useState('');
  const [philosophy, setPhilosophy] = useState('');
  const [specialtyFocus, setSpecialtyFocus] = useState('');

  useEffect(() => {
    if (coach) loadBrainConfig();
    else setLoading(false);
  }, [coach]);

  const loadBrainConfig = async () => {
    if (!coach) return;
    try {
      const { data } = await supabase.from('ai_coach_brains').select('*').eq('coach_id', coach.id).maybeSingle();
      if (data) {
        setBrainConfig(data);
        setTone(data.tone);
        setStyle(data.style);
        setPhilosophy(data.philosophy || '');
        setSpecialtyFocus(data.specialty_focus || '');
      }
    } catch (error) {
      console.error('Error loading brain config:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!coach) return;
    setSaving(true);
    try {
      const updates = { tone, style, philosophy, specialty_focus: specialtyFocus, updated_at: new Date().toISOString() };
      if (brainConfig) {
        await supabase.from('ai_coach_brains').update(updates).eq('coach_id', coach.id);
      } else {
        await supabase.from('ai_coach_brains').insert({ coach_id: coach.id, ...updates });
      }
      Alert.alert('Success', 'AI configuration optimized and stored.');
      loadBrainConfig();
    } catch (e) {
      Alert.alert('Error', 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-slate-950 justify-center items-center">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-950">
      {/* Header */}
      <View className="px-6 pt-16 pb-6 flex-row items-center gap-4 bg-slate-950 border-b border-slate-900">
        <TouchableOpacity onPress={() => router.back()} className="p-2 bg-slate-900 rounded-full border border-slate-800">
          <ArrowLeft size={20} color="#94A3B8" />
        </TouchableOpacity>
        <Text className="text-white text-xl font-bold">Engine Configuration</Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 120 }}>
          {/* AI Core Hero */}
          <MotiView 
            from={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mx-6 mt-8 p-10 rounded-[48px] bg-indigo-600/10 border border-indigo-500/20 items-center overflow-hidden"
          >
              <View className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -mr-16 -mt-16" />
              <MotiView 
                from={{ scale: 1 }}
                animate={{ scale: 1.1 }}
                transition={{ loop: true, type: 'timing', duration: 2000 }}
                className="w-24 h-24 bg-indigo-600 rounded-[32px] items-center justify-center shadow-2xl shadow-indigo-500/50 mb-8"
              >
                 <Brain size={48} color="white" />
              </MotiView>
              <Text className="text-white text-2xl font-bold text-center">AI Logic Core</Text>
              <Text className="text-slate-400 text-center mt-3 text-sm leading-5 px-4 font-medium">
                Customize the neural parameters that define how your AI persona interacts with and motivates your clients.
              </Text>
          </MotiView>

          {/* Configuration Forms */}
          <View className="px-6 mt-10">
              <ConfigSection 
                title="Tone of Voice" 
                desc="The personality of your AI assistant"
                value={tone}
                onChange={setTone}
                placeholder="Professional, encouraging, and direct"
                icon={<Sparkles size={18} color="#818CF8" />}
              />
              <ConfigSection 
                title="Support Style" 
                desc="How the AI handles feedback and guidance"
                value={style}
                onChange={setStyle}
                placeholder="Supportive and results-driven"
                icon={<Shield size={18} color="#10B981" />}
              />
              <ConfigSection 
                title="Core Philosophy" 
                desc="The principles the AI should enforce"
                value={philosophy}
                onChange={setPhilosophy}
                placeholder="Focus on consistency and incremental progress..."
                icon={<Zap size={18} color="#F59E0B" />}
                multiline
              />
              <ConfigSection 
                title="Specialty Domain" 
                desc="Primary area of expertise for the AI"
                value={specialtyFocus}
                onChange={setSpecialtyFocus}
                placeholder="Hypertrophy and nutrition optimization"
                icon={<ChevronRight size={18} color="#3B82F6" />}
              />
          </View>
      </ScrollView>

      {/* Save Action */}
      <View className="absolute bottom-0 w-full p-6 bg-slate-950/90 border-t border-slate-900">
          <TouchableOpacity 
            className={`h-16 rounded-2xl flex-row items-center justify-center gap-3 bg-indigo-600 shadow-xl shadow-indigo-500/20`}
            onPress={handleSave}
            disabled={saving}
          >
              {saving ? (
                  <ActivityIndicator color="white" />
              ) : (
                  <>
                    <Save size={22} color="white" />
                    <Text className="text-white font-bold text-lg">Save Parameters</Text>
                  </>
              )}
          </TouchableOpacity>
      </View>
    </View>
  );
}

const ConfigSection = ({ title, desc, value, onChange, placeholder, icon, multiline }: any) => (
  <View className="mb-8">
      <View className="flex-row items-center gap-3 mb-2">
         <View className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 items-center justify-center">
            {icon}
         </View>
         <View>
            <Text className="text-white font-bold">{title}</Text>
            <Text className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">{desc}</Text>
         </View>
      </View>
      <TextInput 
         className={`bg-slate-900 border border-slate-800 rounded-2xl px-5 py-4 text-white font-medium ${multiline ? 'min-h-[120px] text-top' : ''}`}
         placeholder={placeholder}
         placeholderTextColor="#475569"
         value={value}
         onChangeText={onChange}
         multiline={multiline}
         numberOfLines={multiline ? 4 : 1}
         textAlignVertical={multiline ? 'top' : 'center'}
      />
  </View>
);
