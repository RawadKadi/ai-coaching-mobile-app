import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { MotiView, AnimatePresence } from 'moti';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Check, ChevronRight, ChevronLeft, Briefcase, Award, Calendar, Clock } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { availabilityService, DayOfWeek } from '@/lib/availability-service';

export default function CoachOnboardingScreen() {
  const router = useRouter();
  const { user, coach, refreshProfile } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    business_name: '',
    specialty: '',
    bio: '',
    selectedWeekdays: [1, 2, 3, 4, 5] as number[], // Monday-Friday default
    start_time: '09:00',
    end_time: '17:00',
  });

  useEffect(() => {
    const loadPersistedOnboarding = async () => {
      try {
        const savedStep = await AsyncStorage.getItem('@coach_onboarding_step');
        const savedForm = await AsyncStorage.getItem('@coach_onboarding_form');
        if (savedStep) setStep(parseInt(savedStep, 10));
        if (savedForm) setFormData(JSON.parse(savedForm));
      } catch (e) {
        console.error('Failed to load coach onboarding progress:', e);
      }
    };
    loadPersistedOnboarding();
  }, []);

  const updateForm = (key: string, value: any) => {
    setFormData((prev) => {
      const updated = { ...prev, [key]: value };
      AsyncStorage.setItem('@coach_onboarding_form', JSON.stringify(updated)).catch(e => console.error(e));
      return updated;
    });
  };

  const toggleWeekday = (dayIdx: number) => {
    const active = formData.selectedWeekdays.includes(dayIdx);
    const updatedWeekdays = active 
      ? formData.selectedWeekdays.filter(w => w !== dayIdx)
      : [...formData.selectedWeekdays, dayIdx];
    updateForm('selectedWeekdays', updatedWeekdays);
  };

  const handleNext = () => {
    const isStepValid = () => {
        if (step === 1) return formData.business_name && formData.specialty && formData.bio;
        if (step === 2) return formData.selectedWeekdays.length > 0 && formData.start_time && formData.end_time;
        return true;
    };

    if (!isStepValid()) {
        Alert.alert('Incomplete', 'Please fill in all the details for this step.');
        return;
    }

    if (step < 2) {
      const nextStep = step + 1;
      setStep(nextStep);
      AsyncStorage.setItem('@coach_onboarding_step', nextStep.toString()).catch(e => console.error(e));
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      const prevStep = step - 1;
      setStep(prevStep);
      AsyncStorage.setItem('@coach_onboarding_step', prevStep.toString()).catch(e => console.error(e));
    }
  };

  const handleSubmit = async () => {
    if (!user || !coach) return;
    setLoading(true);
    try {
      // 1. Update coach profile details
      const { error: coachError } = await supabase.from('coaches').update({
        business_name: formData.business_name,
        specialty: formData.specialty,
        bio: formData.bio,
      }).eq('id', coach.id);
      if (coachError) throw coachError;

      // 2. Set up working hours availability
      // Format start and end times to HH:MM:SS
      const formattedStart = `${formData.start_time}:00`;
      const formattedEnd = `${formData.end_time}:00`;

      // Clear existing availability and insert for each selected day
      const availabilityPromises = [0, 1, 2, 3, 4, 5, 6].map(async (dayIndex) => {
        const isActive = formData.selectedWeekdays.includes(dayIndex);
        if (isActive) {
          await availabilityService.updateDayAvailability(coach.id, dayIndex as DayOfWeek, [
            { start_time: formattedStart, end_time: formattedEnd, is_active: true }
          ]);
        } else {
          await availabilityService.updateDayAvailability(coach.id, dayIndex as DayOfWeek, []);
        }
      });
      await Promise.all(availabilityPromises);

      // 3. Mark profile onboarding complete
      await supabase.from('profiles').update({ onboarding_completed: true }).eq('id', user.id);
      
      // Clean up local cache
      await AsyncStorage.removeItem('@coach_onboarding_step');
      await AsyncStorage.removeItem('@coach_onboarding_form');

      await refreshProfile();
      router.replace('/(coach)/(tabs)');
    } catch (error: any) { Alert.alert('Error', error.message); } finally { setLoading(false); }
  };

  return (
    <View className="flex-1 bg-slate-950">
      <SafeAreaView className="flex-1">
        <View className="px-6 pt-10 pb-6 flex-row items-center justify-between">
            <View>
                <Text className="text-white text-3xl font-black">Coaching Setup</Text>
                <Text className="text-slate-500 font-bold text-xs uppercase tracking-[4px] mt-1">Configure your workspace</Text>
            </View>
            <View className="w-12 h-12 bg-blue-600/10 rounded-2xl items-center justify-center border border-blue-600/20">
                <Briefcase size={24} color="#3B82F6" />
            </View>
        </View>

        <View className="h-1 bg-slate-900 mx-6 rounded-full overflow-hidden mb-8">
            <MotiView 
                animate={{ width: `${(step / 2) * 100}%` }}
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
                        <SectionLabel label="Step 1" desc="Professional Profile" />
                        <View className="gap-6">
                            <InputGroup label="Business Name" value={formData.business_name} onChange={(v: string) => updateForm('business_name', v)} placeholder="e.g. Apex Performance" />
                            <InputGroup label="Specialty Focus" value={formData.specialty} onChange={(v: string) => updateForm('specialty', v)} placeholder="e.g. Strength Training, Fat Loss" />
                            
                            <View>
                              <Text className="text-slate-600 text-[10px] font-black uppercase tracking-widest mb-3 px-1">Biography / About</Text>
                              <TextInput 
                                  className="bg-slate-900/50 p-6 rounded-[24px] border-2 border-slate-900 text-white font-semibold text-base min-h-[120px]"
                                  placeholder="Briefly describe your coaching style and philosophy..." placeholderTextColor="#1E293B"
                                  value={formData.bio} onChangeText={(v: string) => updateForm('bio', v)} multiline textAlignVertical="top"
                              />
                            </View>
                        </View>
                    </View>
                )}

                {step === 2 && (
                    <View className="gap-8">
                        <SectionLabel label="Step 2" desc="Set Working Hours" />
                        <View className="gap-6">
                            <Text className="text-slate-500 font-bold text-sm">Select the days you are available for client bookings:</Text>
                            
                            <View className="flex-row justify-between my-2">
                                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => {
                                    const dayIdx = (i + 1) % 7; // Convert to 0=Sunday, 1=Monday...
                                    const isSelected = formData.selectedWeekdays.includes(dayIdx);
                                    return (
                                        <TouchableOpacity 
                                            key={i} onPress={() => toggleWeekday(dayIdx)}
                                            className={`w-12 h-12 rounded-2xl items-center justify-center border ${isSelected ? 'bg-blue-600 border-blue-500' : 'bg-slate-900 border-white/5'}`}
                                        >
                                            <Text className={`font-black text-base ${isSelected ? 'text-white' : 'text-slate-500'}`}>{day}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <View className="flex-row gap-4 mt-4">
                                <View className="flex-1">
                                    <InputGroup label="Start Time" value={formData.start_time} onChange={(v: string) => updateForm('start_time', v)} placeholder="09:00" />
                                </View>
                                <View className="flex-1">
                                    <InputGroup label="End Time" value={formData.end_time} onChange={(v: string) => updateForm('end_time', v)} placeholder="17:00" />
                                </View>
                            </View>
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
                        <Text className="text-white font-black text-lg">{step === 2 ? 'Complete Setup' : 'Next'}</Text>
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
