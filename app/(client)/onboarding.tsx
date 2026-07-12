import { useBrandColors } from '@/contexts/BrandContext';
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ChevronRight, ChevronLeft, Bot } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Formik, useFormikContext } from 'formik';

// Modular Step Components
import Step1 from '@/components/onboarding/client/Step1';
import Step2 from '@/components/onboarding/client/Step2';
import Step3 from '@/components/onboarding/client/Step3';
import Step4 from '@/components/onboarding/client/Step4';

// Auto-persist Formik values to AsyncStorage
const PersistFormikValues = () => {
  const colors = useBrandColors();
  const { values } = useFormikContext<any>();
  useEffect(() => {
    if (values) {
      AsyncStorage.setItem('@client_onboarding_form', JSON.stringify(values)).catch(() => {});
    }
  }, [values]);
  return null;
};

export default function OnboardingScreen() {
  const router = useRouter();
  const { user, refreshProfile } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [initialValues, setInitialValues] = useState<any>(null);

  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: step / 4,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [step]);

  useEffect(() => {
    const load = async () => {
      try {
        const savedStep = await AsyncStorage.getItem('@client_onboarding_step');
        const savedForm = await AsyncStorage.getItem('@client_onboarding_form');

        const defaults = {
          date_of_birth: '',
          gender: '',
          height_cm: '',
          goal: '',
          experience_level: '',
          dietary_restrictions: [] as string[],
        };

        if (savedStep) {
          const p = parseInt(savedStep, 10);
          setStep(p >= 1 && p <= 4 ? p : 1);
        }

        if (savedForm) {
          try {
            const parsed = JSON.parse(savedForm);
            setInitialValues({
              date_of_birth: parsed.date_of_birth || '',
              gender: parsed.gender || '',
              height_cm: parsed.height_cm || '',
              goal: parsed.goal || '',
              experience_level: parsed.experience_level || '',
              dietary_restrictions: Array.isArray(parsed.dietary_restrictions)
                ? parsed.dietary_restrictions
                : [],
            });
          } catch {
            setInitialValues(defaults);
          }
        } else {
          setInitialValues(defaults);
        }
      } catch {
        setInitialValues({
          date_of_birth: '',
          gender: '',
          height_cm: '',
          goal: '',
          experience_level: '',
          dietary_restrictions: [] as string[],
        });
      }
    };
    load();
  }, []);

  const goNext = (isDisabled: boolean, submitForm: () => void) => {
    if (isDisabled) return;
    if (step < 3) {
      const next = step + 1;
      setStep(next);
      AsyncStorage.setItem('@client_onboarding_step', String(next)).catch(() => {});
    } else if (step === 3) {
      submitForm();
    }
  };

  const goBack = () => {
    if (step > 1 && step < 4) {
      const prev = step - 1;
      setStep(prev);
      AsyncStorage.setItem('@client_onboarding_step', String(prev)).catch(() => {});
    }
  };

  const handleSubmit = async (values: any) => {
    if (!user) return;
    setLoading(true);
    try {
      let finalMedicalConditions = [...(values.medical_conditions || [])];
      
      if (finalMedicalConditions.includes('Other +') && values.medical_conditions_other?.trim()) {
        try {
          const { generateText } = await import('@/lib/google-ai');
          const prompt = `Extract exactly 1 to 3 short medical keywords or tags (e.g. 'Tennis Elbow', 'High Blood Pressure', 'Anxiety') from this user input. Return ONLY the keywords separated by commas. No conversational text. Input: "${values.medical_conditions_other}"`;
          const aiResponse = await generateText(prompt);
          
          if (aiResponse) {
            finalMedicalConditions = finalMedicalConditions.filter(c => c !== 'Other +');
            const tags = aiResponse.split(',').map(t => t.trim()).filter(Boolean);
            finalMedicalConditions = [...finalMedicalConditions, ...tags];
          }
        } catch (err) {
          console.error('AI Extraction failed:', err);
          finalMedicalConditions = finalMedicalConditions.filter(c => c !== 'Other +');
          finalMedicalConditions.push('Other (Noted)');
        }
      } else {
        finalMedicalConditions = finalMedicalConditions.filter(c => c !== 'Other +');
      }

      const { error: clientError } = await supabase
        .from('clients')
        .update({
          date_of_birth: values.date_of_birth || null,
          gender: values.gender,
          height_cm: parseFloat(values.height_cm) || null,
          goal: values.goal,
          experience_level: values.experience_level,
          dietary_restrictions: values.dietary_restrictions,
          medical_conditions: finalMedicalConditions,
        })
        .eq('user_id', user.id);
      if (clientError) throw clientError;

      const { data: clientData } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (clientData) {
        // Log initial starting weight into check_ins
        if (values.starting_weight_kg) {
          await supabase.from('check_ins').insert({
            client_id: clientData.id,
            date: new Date().toISOString().split('T')[0],
            weight_kg: parseFloat(values.starting_weight_kg),
            notes: 'Initial Onboarding Baseline',
          });
        }

        const habits = [
          { name: 'Hydration', description: 'Drink enough water daily', target_value: 2000, unit: 'ml', verification_type: 'none', client_id: clientData.id, is_active: true },
          { name: 'Daily Steps', description: 'Walk at least 8,000 steps', target_value: 8000, unit: 'steps', verification_type: 'none', client_id: clientData.id, is_active: true },
        ];
        await supabase.from('habits').insert(habits);
      }

      await supabase.from('profiles').update({ onboarding_completed: true }).eq('id', user.id);
      await AsyncStorage.multiRemove(['@client_onboarding_step', '@client_onboarding_form']);
      await refreshProfile();
      
      // Move to Step 4 (Animated Activation Sequence)
      setStep(4);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!initialValues) {
    return (
      <View style={{ flex: 1, backgroundColor: '#020617', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Formik initialValues={initialValues} onSubmit={handleSubmit}>
      {({ values, setFieldValue, submitForm }) => {
        const isDisabled =
          loading ||
          (step === 1 && (!values.date_of_birth || !values.gender || !values.height_cm || !values.starting_weight_kg)) ||
          (step === 2 && (!values.goal || !values.experience_level));

        const clearDraft = () => {
          Alert.alert('Reset Draft', 'Clear all progress and start fresh?', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Clear',
              style: 'destructive',
              onPress: async () => {
                await AsyncStorage.multiRemove(['@client_onboarding_step', '@client_onboarding_form']);
                setStep(1);
                setFieldValue('date_of_birth', '');
                setFieldValue('gender', '');
                setFieldValue('height_cm', '');
                setFieldValue('goal', '');
                setFieldValue('experience_level', '');
                setFieldValue('dietary_restrictions', []);
              },
            },
          ]);
        };

        return (
          <View style={{ flex: 1, backgroundColor: '#020617' }}>
            <SafeAreaView style={{ flex: 1 }}>
              <PersistFormikValues />

              {/* Header */}
              <View style={{ paddingHorizontal: 24, paddingTop: 32, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View>
                  <Text style={{ color: '#FFFFFF', fontSize: 28, fontWeight: '900' }}>About You</Text>
                  <Text style={{ color: '#64748B', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 4, marginTop: 4 }}>
                    Step {step} of 4
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={clearDraft}
                  style={{ width: 48, height: 48, backgroundColor: 'rgba(59,130,246,0.1)', borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)' }}
                >
                  <Bot size={22} color={colors.primary} />
                </TouchableOpacity>
              </View>

              {/* Progress bar */}
              <View style={{ height: 4, backgroundColor: '#0F172A', marginHorizontal: 24, borderRadius: 4, overflow: 'hidden', marginBottom: 24 }}>
                <Animated.View
                  style={{
                    height: '100%',
                    backgroundColor: colors.primary,
                    borderRadius: 4,
                    width: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                  }}
                />
              </View>

              {/* Step content */}
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: 24, paddingBottom: 32 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {step === 1 && (
                  <Step1
                    formData={values}
                    updateForm={(key, val) => setFieldValue(key, val)}
                  />
                )}
                {step === 2 && (
                  <Step2
                    formData={values}
                    updateForm={(key, val) => setFieldValue(key, val)}
                  />
                )}
                {step === 3 && (
                  <Step3
                    formData={values}
                    updateForm={(key, val) => setFieldValue(key, val)}
                  />
                )}
                {step === 4 && (
                  <Step4
                    formData={values}
                    updateForm={(key, val) => setFieldValue(key, val)}
                  />
                )}
              </ScrollView>

              {/* Footer buttons */}
              {step < 4 && (
                <View style={{ padding: 24, backgroundColor: '#020617', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                  {step > 1 && (
                    <TouchableOpacity
                      onPress={goBack}
                      style={{ width: 64, height: 64, backgroundColor: 'rgba(15,23,42,0.8)', borderRadius: 28, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#1E293B' }}
                    >
                      <ChevronLeft size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={() => goNext(isDisabled, submitForm)}
                    disabled={isDisabled}
                    style={{
                      flex: 1,
                      height: 64,
                      borderRadius: 28,
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexDirection: 'row',
                      gap: 12,
                      backgroundColor: isDisabled ? '#1E293B' : '#2563EB',
                    }}
                  >
                    {loading ? (
                      <ActivityIndicator color="white" />
                    ) : (
                      <>
                        <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 17 }}>
                          {step === 3 ? 'Generate My Program' : 'Next'}
                        </Text>
                        <ChevronRight size={20} color="white" />
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </SafeAreaView>
          </View>
        );
      }}
    </Formik>
  );
}
