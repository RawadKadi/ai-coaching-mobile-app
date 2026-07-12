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
import { ChevronRight, ChevronLeft, Briefcase } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { Formik, useFormikContext } from 'formik';
import { availabilityService, DayOfWeek } from '@/lib/availability-service';

// Modular Step Components
import Step1 from '@/components/onboarding/coach/Step1';
import Slide1b from '@/components/onboarding/coach/Slide1b';
import Slide1c from '@/components/onboarding/coach/Slide1c';
import Step2 from '@/components/onboarding/coach/Step2';
import Slide2b from '@/components/onboarding/coach/Slide2b';
import Step3 from '@/components/onboarding/coach/Step3';
import Step4 from '@/components/onboarding/coach/Step4';

// Auto-persist Formik values to AsyncStorage
const PersistFormikValues = () => {
  const colors = useBrandColors();
  const { values } = useFormikContext<any>();
  useEffect(() => {
    if (values) {
      AsyncStorage.setItem('@coach_onboarding_form', JSON.stringify(values)).catch(() => {});
    }
  }, [values]);
  return null;
};

const TOTAL_FORM_STEPS = 6; // Form inputs and informational slides; step 7 is success

export default function CoachOnboardingScreen() {
  const router = useRouter();
  const { user, coach, profile, refreshProfile } = useAuth();
  const [step, setStep] = useState(1);
  const [success, setSuccess] = useState(false); // True after successful submit → show Step 4
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [initialValues, setInitialValues] = useState<any>(null);

  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: success ? 1 : step / TOTAL_FORM_STEPS,
      duration: 350,
      useNativeDriver: false,
    }).start();
  }, [step, success]);

  // Load persisted form + step
  useEffect(() => {
    const load = async () => {
      try {
        const savedStep = await AsyncStorage.getItem('@coach_onboarding_step');
        const savedForm = await AsyncStorage.getItem('@coach_onboarding_form');

        const defaults = {
          business_name: '',
          logo_url: '',
          specialty: [] as string[],
          otherSpecialty: '',
          selectedWeekdays: [] as number[],
          start_time: '09:00',
          end_time: '17:00',
        };

        if (savedStep) {
          const p = parseInt(savedStep, 10);
          setStep(p >= 1 && p <= TOTAL_FORM_STEPS ? p : 1);
        }

        if (savedForm) {
          try {
            const parsed = JSON.parse(savedForm);
            setInitialValues({
              business_name: parsed.business_name || '',
              logo_url: parsed.logo_url || '',
              specialty: Array.isArray(parsed.specialty)
                ? parsed.specialty
                : parsed.specialty
                ? [parsed.specialty]
                : [],
              otherSpecialty: parsed.otherSpecialty || '',
              selectedWeekdays: Array.isArray(parsed.selectedWeekdays) ? parsed.selectedWeekdays : [],
              start_time: parsed.start_time || '09:00',
              end_time: parsed.end_time || '17:00',
            });
          } catch {
            setInitialValues(defaults);
          }
        } else {
          setInitialValues(defaults);
        }
      } catch {
        setInitialValues({
          business_name: '',
          logo_url: '',
          specialty: [] as string[],
          otherSpecialty: '',
          selectedWeekdays: [] as number[],
          start_time: '09:00',
          end_time: '17:00',
        });
      }
    };
    load();
  }, []);

  const goNext = (isDisabled: boolean, submitForm: () => void) => {
    if (isDisabled) return;
    if (step < TOTAL_FORM_STEPS) {
      const next = step + 1;
      setStep(next);
      AsyncStorage.setItem('@coach_onboarding_step', String(next)).catch(() => {});
    } else {
      submitForm();
    }
  };

  const goBack = () => {
    if (step > 1) {
      const prev = step - 1;
      setStep(prev);
      AsyncStorage.setItem('@coach_onboarding_step', String(prev)).catch(() => {});
    }
  };

  const handleSubmit = async (values: any) => {
    if (!user || !coach) return;
    setLoading(true);
    try {
      // Resolve specialty: replace "Other" with the custom text if provided
      const resolvedSpecialties = values.specialty.map((s: string) =>
        s === 'Other' ? (values.otherSpecialty?.trim() || 'Other') : s
      );

      const { error: coachError } = await supabase
        .from('coaches')
        .update({
          business_name: values.business_name,
          logo_url: values.logo_url || null,
          specialty: resolvedSpecialties.join(', '),
        })
        .eq('id', coach.id);
      if (coachError) throw coachError;

      const formattedStart = `${values.start_time}:00`;
      const formattedEnd = `${values.end_time}:00`;

      await Promise.all(
        [0, 1, 2, 3, 4, 5, 6].map((dayIndex) => {
          const isActive = values.selectedWeekdays.includes(dayIndex);
          return isActive
            ? availabilityService.updateDayAvailability(coach.id, dayIndex as DayOfWeek, [
                { start_time: formattedStart, end_time: formattedEnd, is_active: true },
              ])
            : availabilityService.updateDayAvailability(coach.id, dayIndex as DayOfWeek, []);
        })
      );

      await supabase
        .from('profiles')
        .update({ onboarding_completed: true })
        .eq('id', user.id);

      await AsyncStorage.multiRemove(['@coach_onboarding_step', '@coach_onboarding_form']);
      await refreshProfile();

      // Show the success screen (Step 4) instead of navigating away immediately
      setSuccess(true);
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
        const toggleSpecialty = (spec: string) => {
          const updated = values.specialty.includes(spec)
            ? values.specialty.filter((s: string) => s !== spec)
            : [...values.specialty, spec];
          setFieldValue('specialty', updated);
        };

        const toggleWeekday = (dayIdx: number) => {
          const updated = values.selectedWeekdays.includes(dayIdx)
            ? values.selectedWeekdays.filter((w: number) => w !== dayIdx)
            : [...values.selectedWeekdays, dayIdx];
          setFieldValue('selectedWeekdays', updated);
        };

        const pickImage = async () => {
          try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permission Required', 'Please allow access to your photos.');
              return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.8,
            });
            if (!result.canceled && result.assets[0]) {
              await uploadLogo(result.assets[0].uri);
            }
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Could not open photos');
          }
        };

        const uploadLogo = async (uri: string) => {
          try {
            setUploading(true);
            const ext = uri.split('.').pop()?.split('?')[0]?.toLowerCase() || 'jpg';
            const safeExt = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext) ? ext : 'jpg';
            const filePath = `brands/brand-logo-${Date.now()}.${safeExt}`;

            const response = await fetch(uri);
            if (!response.ok) throw new Error('Failed to fetch image');
            const arrayBuffer = await response.arrayBuffer();

            const mimeMap: Record<string, string> = {
              jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
              gif: 'image/gif', webp: 'image/webp',
            };

            const { error: uploadError } = await supabase.storage
              .from('meal-photos')
              .upload(filePath, arrayBuffer, {
                contentType: mimeMap[safeExt] || 'image/jpeg',
                upsert: true,
              });
            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
              .from('meal-photos')
              .getPublicUrl(filePath);

            setFieldValue('logo_url', publicUrl);
          } catch (error: any) {
            Alert.alert('Upload Failed', error.message);
          } finally {
            setUploading(false);
          }
        };

        const isDisabled =
          loading ||
          uploading ||
          (step === 1 && (values.business_name || '').trim().length === 0) ||
          (step === 4 && (!values.specialty || values.specialty.length === 0)) ||
          (step === 6 && (!values.selectedWeekdays?.length || !values.start_time || !values.end_time));

        const clearDraft = () => {
          Alert.alert('Reset Draft', 'Clear all progress and start fresh?', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Clear',
              style: 'destructive',
              onPress: async () => {
                await AsyncStorage.multiRemove(['@coach_onboarding_step', '@coach_onboarding_form']);
                setStep(1);
                setSuccess(false);
                setFieldValue('business_name', '');
                setFieldValue('logo_url', '');
                setFieldValue('specialty', []);
                setFieldValue('otherSpecialty', '');
                setFieldValue('selectedWeekdays', []);
                setFieldValue('start_time', '09:00');
                setFieldValue('end_time', '17:00');
              },
            },
          ]);
        };

        return (
          <View style={{ flex: 1, backgroundColor: '#020617' }}>
            <SafeAreaView style={{ flex: 1 }}>
              {!success && <PersistFormikValues />}

              {/* Header — hidden on success screen */}
              {!success && (
                <View style={{ paddingHorizontal: 24, paddingTop: 32, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View>
                    <Text style={{ color: '#FFFFFF', fontSize: 28, fontWeight: '900' }}>Coaching Setup</Text>
                    <Text style={{ color: '#64748B', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 4, marginTop: 4 }}>
                      Step {step} of {TOTAL_FORM_STEPS}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={clearDraft}
                    style={{ width: 48, height: 48, backgroundColor: 'rgba(59,130,246,0.1)', borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)' }}
                  >
                    <Briefcase size={22} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              )}

              {/* Progress bar — shows full on success */}
              {!success && (
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
              )}

              {/* Step content */}
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: 24, paddingBottom: 40, paddingTop: success ? 32 : 0 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {!success && step === 1 && (
                  <Step1
                    formData={values}
                    updateForm={(key, val) => setFieldValue(key, val)}
                    pickImage={pickImage}
                    removeLogo={() => setFieldValue('logo_url', '')}
                    uploading={uploading}
                  />
                )}
                {!success && step === 2 && (
                  <Slide1b formData={values} />
                )}
                {!success && step === 3 && (
                  <Slide1c />
                )}
                {!success && step === 4 && (
                  <Step2
                    formData={values}
                    toggleSpecialty={toggleSpecialty}
                    updateForm={(key, val) => setFieldValue(key, val)}
                  />
                )}
                {!success && step === 5 && (
                  <Slide2b formData={values} />
                )}
                {!success && step === 6 && (
                  <Step3
                    formData={values}
                    updateForm={(key, val) => setFieldValue(key, val)}
                    toggleWeekday={toggleWeekday}
                  />
                )}
                {success && (
                  <Step4 coachName={profile?.full_name?.split(' ')[0]} />
                )}
              </ScrollView>

              {/* Footer — only shown during form steps */}
              {!success && (
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
                          {step === 6 ? 'Activate Workspace' : 'Next'}
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
