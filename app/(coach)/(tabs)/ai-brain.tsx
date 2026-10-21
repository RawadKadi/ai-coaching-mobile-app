import { useBrandColors, useTheme } from '@/contexts/BrandContext';
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert, Platform, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { MotiView, AnimatePresence } from 'moti';
import { ArrowLeft, Sparkles, Brain, Zap, Shield, ChevronRight, Save } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { AICoachBrain } from '@/types/database';
import { safeBack } from '@/lib/navigation-utils';

export default function AIBrainScreen() {
  const theme = useTheme();
  const colors = theme.colors;
  const isDarkMode = theme.isDark;
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
      Alert.alert('Saved', 'AI settings updated successfully.');
      loadBrainConfig();
    } catch (e) {
      Alert.alert('Error', 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      {/* Header */}
      <View 
        className="px-6 pt-16 pb-6 flex-row items-center gap-4 border-b"
        style={{ backgroundColor: colors.surface, borderBottomColor: colors.border }}
      >
        <TouchableOpacity 
          onPress={() => safeBack('/(coach)/(tabs)/profile')} 
          className="p-2 rounded-full border"
          style={{ backgroundColor: colors.background, borderColor: colors.border }}
        >
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <Text className="text-xl font-bold" style={{ color: colors.text }}>AI Setup</Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 120 }}>
          {/* AI Core Hero */}
          <MotiView 
            from={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mx-6 mt-8 p-10 rounded-[48px] border items-center overflow-hidden"
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
          >
              <MotiView 
                from={{ scale: 1 }}
                animate={{ scale: 1.05 }}
                transition={{ loop: true, type: 'timing', duration: 2000 }}
                className="w-20 h-20 rounded-[28px] items-center justify-center mb-6"
                style={{ backgroundColor: colors.primary }}
              >
                 <Brain size={40} color="#FFFFFF" />
              </MotiView>
              <Text className="text-2xl font-bold text-center" style={{ color: colors.text }}>AI Assistant Style</Text>
              <Text className="text-center mt-3 text-sm leading-5 px-4 font-medium" style={{ color: colors.textSecondary }}>
                Choose how your AI talks to clients, gives advice, and motivates them.
              </Text>
          </MotiView>

          {/* Configuration Forms */}
          <View className="px-6 mt-10">
              <ConfigSection 
                title="Tone of Voice" 
                desc="How your AI should sound"
                value={tone}
                onChange={setTone}
                placeholder="Friendly, motivating, and clear"
                icon={<Sparkles size={18} color="#818CF8" />}
                colors={colors}
              />
              <ConfigSection 
                title="Coaching Style" 
                desc="How the AI guides clients"
                value={style}
                onChange={setStyle}
                placeholder="Supportive and action-focused"
                icon={<Shield size={18} color="#10B981" />}
                colors={colors}
              />
              <ConfigSection 
                title="Key Rules & Philosophy" 
                desc="Core coaching rules to follow"
                value={philosophy}
                onChange={setPhilosophy}
                placeholder="Consistency first, celebrate small wins..."
                icon={<Zap size={18} color="#F59E0B" />}
                multiline
                colors={colors}
              />
              <ConfigSection 
                title="Specialty Focus" 
                desc="Main area of training expertise"
                value={specialtyFocus}
                onChange={setSpecialtyFocus}
                placeholder="Strength training and nutrition"
                icon={<ChevronRight size={18} color={colors.primary} />}
                colors={colors}
              />
          </View>
      </ScrollView>

      {/* Save Action */}
      <View 
        className="absolute bottom-0 w-full p-6 border-t"
        style={{ backgroundColor: colors.surface, borderTopColor: colors.border }}
      >
          <TouchableOpacity 
            className="h-16 rounded-2xl flex-row items-center justify-center gap-3 shadow-lg"
            style={{ backgroundColor: colors.primary }}
            onPress={handleSave}
            disabled={saving}
          >
              {saving ? (
                  <ActivityIndicator color="white" />
              ) : (
                  <>
                    <Save size={22} color="white" />
                    <Text className="text-white font-bold text-lg">Save Settings</Text>
                  </>
              )}
          </TouchableOpacity>
      </View>
    </View>
  );
}

const ConfigSection = ({ title, desc, value, onChange, placeholder, icon, multiline, colors }: any) => (
  <View className="mb-8">
      <View className="flex-row items-center gap-3 mb-2">
         <View 
            className="w-8 h-8 rounded-lg border items-center justify-center"
            style={{ backgroundColor: colors.background, borderColor: colors.border }}
         >
            {icon}
         </View>
         <View>
            <Text className="font-bold" style={{ color: colors.text }}>{title}</Text>
            <Text className="text-[10px] font-bold uppercase tracking-widest" style={{ color: colors.textSecondary }}>{desc}</Text>
         </View>
      </View>
      <TextInput 
         className={`border rounded-2xl px-5 py-4 font-medium ${multiline ? 'min-h-[120px]' : ''}`}
         style={{ 
           backgroundColor: colors.surface, 
           borderColor: colors.border, 
           color: colors.text 
         }}
         placeholder={placeholder}
         placeholderTextColor={colors.textTertiary || '#94A3B8'}
         value={value}
         onChangeText={onChange}
         multiline={multiline}
         numberOfLines={multiline ? 4 : 1}
         textAlignVertical={multiline ? 'top' : 'center'}
      />
  </View>
);
