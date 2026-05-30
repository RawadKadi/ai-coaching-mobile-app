import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { MotiView, AnimatePresence } from 'moti';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Check, ChevronRight, ChevronLeft, Shield, Zap, Flame, User, Activity, Bot } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function OnboardingScreen() {
  const router = useRouter();
  const { user, refreshProfile } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    date_of_birth: '',
    gender: '',
    height_cm: '',
    goal: '',
    experience_level: '',
    dietary_restrictions: [] as string[],
  });

  useEffect(() => {
    const loadPersistedOnboarding = async () => {
      try {
        const savedStep = await AsyncStorage.getItem('@client_onboarding_step');
        const savedForm = await AsyncStorage.getItem('@client_onboarding_form');
        if (savedStep) setStep(parseInt(savedStep, 10));
        if (savedForm) setFormData(JSON.parse(savedForm));
      } catch (e) {
        console.error('Failed to load onboarding progress:', e);
      }
    };
    loadPersistedOnboarding();
  }, []);

  const updateForm = (key: string, value: any) => {
    setFormData((prev) => {
      const updated = { ...prev, [key]: value };
      AsyncStorage.setItem('@client_onboarding_form', JSON.stringify(updated)).catch(e => console.error(e));
      return updated;
    });
  };

  const handleNext = () => {
    const isStepValid = () => {
        if (step === 1) return formData.date_of_birth && formData.gender && formData.height_cm;
        if (step === 2) return formData.goal;
        if (step === 3) return formData.experience_level;
        return true;
    };

    if (!isStepValid()) {
        Alert.alert('Incomplete', 'Please fill in all the details for this step.');
        return;
    }

    if (step < 4) {
      const nextStep = step + 1;
      setStep(nextStep);
      AsyncStorage.setItem('@client_onboarding_step', nextStep.toString()).catch(e => console.error(e));
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      const prevStep = step - 1;
      setStep(prevStep);
      AsyncStorage.setItem('@client_onboarding_step', prevStep.toString()).catch(e => console.error(e));
    }
  };

  const handleSubmit = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { error: clientError } = await supabase.from('clients').update({
        date_of_birth: formData.date_of_birth || null,
        gender: formData.gender,
        height_cm: parseFloat(formData.height_cm) || null,
        goal: formData.goal,
        experience_level: formData.experience_level,
        dietary_restrictions: formData.dietary_restrictions,
      }).eq('user_id', user.id);
      if (clientError) throw clientError;

      const { data: clientData } = await supabase.from('clients').select('id').eq('user_id', user.id).single();
      if (clientData) {
        const habits = [
            { name: 'Hydration', description: 'Drink enough water daily', target_value: 2000, unit: 'ml', verification_type: 'none', client_id: clientData.id, is_active: true },
            { name: 'Daily Steps', description: 'Walk at least 8,000 steps', target_value: 8000, unit: 'steps', verification_type: 'none', client_id: clientData.id, is_active: true }
        ];
        await supabase.from('habits').insert(habits);
      }

      await supabase.from('profiles').update({ onboarding_completed: true }).eq('id', user.id);
      
      // Clean up local cache
      await AsyncStorage.removeItem('@client_onboarding_step');
      await AsyncStorage.removeItem('@client_onboarding_form');

      await refreshProfile();
      router.replace('/(client)/(tabs)');
    } catch (error: any) { Alert.alert('Error', error.message); } finally { setLoading(false); }
  };

  return (
    <View className="flex-1 bg-slate-950">
      <SafeAreaView className="flex-1">
        <View className="px-6 pt-10 pb-6 flex-row items-center justify-between">
            <View>
                <Text className="text-white text-3xl font-black">About You</Text>
                <Text className="text-slate-500 font-bold text-xs uppercase tracking-[4px] mt-1">Let's get set up</Text>
            </View>
            <View className="w-12 h-12 bg-blue-600/10 rounded-2xl items-center justify-center border border-blue-600/20">
                <Bot size={24} color="#3B82F6" />
            </View>
        </View>

        <View className="h-1 bg-slate-900 mx-6 rounded-full overflow-hidden mb-8">
            <MotiView 
                animate={{ width: `${(step / 4) * 100}%` }}
                className="h-full bg-blue-600 shadow-sm shadow-blue-500"
            />
        </View>

        <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 140 }}>
          <AnimatePresence mode="wait">
            <MotiView
                key={step}
                from={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: 'timing', duration: 400 }}
            >
                {step === 1 && (
                    <View className="gap-8">
                        <SectionLabel label="Step 1" desc="Basic Info" />
                        <View className="gap-6">
                            <InputGroup label="Birthday" value={formData.date_of_birth} onChange={(v: string) => updateForm('date_of_birth', v)} placeholder="YYYY-MM-DD" />
                            <View>
                                <Text className="text-slate-600 text-[10px] font-black uppercase tracking-widest mb-4 px-1">Gender</Text>
                                <View className="flex-row gap-3">
                                    {['Male', 'Female', 'Other'].map(g => (
                                        <TouchableOpacity key={g} onPress={() => updateForm('gender', g)} className={`flex-1 py-5 items-center rounded-[24px] border-2 ${formData.gender === g ? 'bg-blue-600 border-blue-400' : 'bg-slate-900/50 border-slate-900'}`}>
                                            <Text className={`font-black ${formData.gender === g ? 'text-white' : 'text-slate-500'}`}>{g}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                            <InputGroup label="Height (CM)" value={formData.height_cm} onChange={(v: string) => updateForm('height_cm', v)} placeholder="e.g. 180" keyboardType="numeric" />
                        </View>
                    </View>
                )}

                {step === 2 && (
                    <View className="gap-8">
                        <SectionLabel label="Step 2" desc="What is your main goal?" />
                        <View className="gap-4">
                            <CardOption label="Lose Weight" desc="Burn fat and get leaner" icon={<Flame size={20} color="#E11D48" />} selected={formData.goal === 'Weight Loss'} onSelect={() => updateForm('goal', 'Weight Loss')} activeColor="#E11D48" />
                            <CardOption label="Build Muscle" desc="Gain strength and size" icon={<Zap size={20} color="#F59E0B" />} selected={formData.goal === 'Muscle Gain'} onSelect={() => updateForm('goal', 'Muscle Gain')} activeColor="#F59E0B" />
                            <CardOption label="Stay Fit" desc="Maintain weight and feel healthy" icon={<Activity size={20} color="#10B981" />} selected={formData.goal === 'Maintenance'} onSelect={() => updateForm('goal', 'Maintenance')} activeColor="#10B981" />
                        </View>
                    </View>
                )}

                {step === 3 && (
                    <View className="gap-8">
                        <SectionLabel label="Step 3" desc="What is your experience level?" />
                        <View className="gap-4">
                            <CardOption label="Beginner" desc="New to fitness or starting out" icon={<Shield size={20} color="#94A3B8" />} selected={formData.experience_level === 'Beginner'} onSelect={() => updateForm('experience_level', 'Beginner')} />
                            <CardOption label="Intermediate" desc="Active and have some experience" icon={<Activity size={20} color="#94A3B8" />} selected={formData.experience_level === 'Intermediate'} onSelect={() => updateForm('experience_level', 'Intermediate')} />
                            <CardOption label="Advanced" desc="Very active and experienced" icon={<Zap size={20} color="#3B82F6" />} selected={formData.experience_level === 'Advanced'} onSelect={() => updateForm('experience_level', 'Advanced')} activeColor="#3B82F6" />
                        </View>
                    </View>
                )}

                {step === 4 && (
                    <View className="gap-8">
                        <SectionLabel label="Step 4" desc="Any dietary preferences?" />
                        <View className="gap-4">
                            {[
                                { key: 'Standard', label: 'No Restrictions', desc: 'Eat everything' },
                                { key: 'Vegetarian', label: 'Vegetarian', desc: 'No meat or fish' },
                                { key: 'Vegan', label: 'Vegan', desc: 'Plant-based only' },
                                { key: 'Ketogenic', label: 'Keto', desc: 'Low carb, high fat' }
                            ].map(item => {
                                const active = formData.dietary_restrictions.includes(item.key);
                                return <CardOption key={item.key} label={item.label} desc={item.desc} selected={active} onSelect={() => {
                                    const cur = formData.dietary_restrictions;
                                    updateForm('dietary_restrictions', active ? cur.filter(i => i !== item.key) : [...cur, item.key]);
                                }} activeColor="#3B82F6" />;
                            })}
                        </View>
                    </View>
                )}
            </MotiView>
          </AnimatePresence>
        </ScrollView>

        <View className="absolute bottom-0 left-0 right-0 p-6 bg-slate-950/80 border-t border-slate-900/50 backdrop-blur-xl flex-row gap-4 items-center">
            {step > 1 && (
                <TouchableOpacity onPress={handleBack} className="w-16 h-16 bg-slate-900/50 rounded-[28px] items-center justify-center border border-slate-800">
                    <ChevronLeft size={24} color="#475569" />
                </TouchableOpacity>
            )}
            <TouchableOpacity 
                onPress={handleNext} disabled={loading}
                className={`flex-1 h-16 rounded-[28px] items-center justify-center flex-row gap-3 ${loading ? 'bg-slate-800' : 'bg-blue-600 shadow-2xl shadow-blue-500/40'}`}
            >
                {loading ? <ActivityIndicator color="white" /> : (
                    <>
                        <Text className="text-white font-black text-lg">{step === 4 ? 'Finish' : 'Next'}</Text>
                        <ChevronRight size={20} color="white" />
                    </>
                )}
            </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const SectionLabel = ({ label, desc }: any) => (
    <View className="mb-2">
        <Text className="text-white text-3xl font-black">{label}</Text>
        <Text className="text-slate-500 font-bold mt-1 text-base">{desc}</Text>
    </View>
);

const InputGroup = ({ label, value, onChange, placeholder, ...rest }: any) => (
    <View>
        <Text className="text-slate-600 text-[10px] font-black uppercase tracking-widest mb-3 px-1">{label}</Text>
        <TextInput 
            className="bg-slate-900/50 p-6 rounded-[24px] border-2 border-slate-900 text-white font-black text-base"
            placeholder={placeholder} placeholderTextColor="#1E293B"
            value={value} onChangeText={onChange} {...rest}
        />
    </View>
);

const CardOption = ({ label, desc, icon, selected, onSelect, activeColor = '#3B82F6' }: any) => (
    <TouchableOpacity 
        onPress={onSelect}
        className={`p-6 rounded-[32px] border-2 flex-row items-center justify-between transition-all ${selected ? 'bg-slate-900 border-blue-600/50' : 'bg-slate-900/30 border-slate-900'}`}
    >
        <View className="flex-row items-center gap-5 flex-1">
            <View style={selected ? { backgroundColor: activeColor + '20' } : {}} className={`w-14 h-14 rounded-2xl items-center justify-center ${selected ? '' : 'bg-slate-950 border border-slate-800'}`}>
                {icon || <Shield size={20} color={selected ? activeColor : '#475569'} />}
            </View>
            <View className="flex-1">
                <Text className={`text-lg font-black ${selected ? 'text-white' : 'text-slate-400'}`}>{label}</Text>
                <Text className={`text-xs font-bold ${selected ? 'text-slate-500' : 'text-slate-600'}`}>{desc}</Text>
            </View>
        </View>
        {selected && (
            <MotiView from={{ scale: 0 }} animate={{ scale: 1 }} className="w-6 h-6 bg-blue-600 rounded-full items-center justify-center shadow-lg shadow-blue-500/50">
                <Check size={14} color="white" strokeWidth={4} />
            </MotiView>
        )}
    </TouchableOpacity>
);
