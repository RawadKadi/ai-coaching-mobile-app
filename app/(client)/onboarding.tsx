import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Check, ChevronRight, ChevronLeft } from 'lucide-react-native';

export default function OnboardingScreen() {
  const router = useRouter();
  const { user, refreshProfile } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    date_of_birth: '',
    gender: '',
    height_cm: '',
    weight_kg: '', // We'll store this in check_ins initially or just use for calculations
    goal: '',
    experience_level: '',
    dietary_restrictions: [] as string[],
  });

  const updateForm = (key: string, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleNext = () => {
    if (step < 4) setStep(step + 1);
    else handleSubmit();
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // 1. Update Client Profile
      const { error: clientError } = await supabase
        .from('clients')
        .update({
          date_of_birth: formData.date_of_birth || null,
          gender: formData.gender,
          height_cm: parseFloat(formData.height_cm) || null,
          goal: formData.goal,
          experience_level: formData.experience_level,
          dietary_restrictions: formData.dietary_restrictions,
        })
        .eq('user_id', user.id);

      if (clientError) throw clientError;

      // 2. Create Initial Challenges (Habits) based on Goal
      const habits = [
        {
          name: 'Drink Water',
          description: 'Stay hydrated throughout the day',
          target_value: 2000,
          unit: 'ml',
          verification_type: 'none',
        },
        {
          name: 'Daily Steps',
          description: 'Keep moving!',
          target_value: 8000,
          unit: 'steps',
          verification_type: 'none',
        },
      ];

      if (formData.goal === 'Weight Loss') {
        habits.push({
          name: 'Meal Photo',
          description: 'Take a photo of your lunch',
          target_value: 1,
          unit: 'photo',
          verification_type: 'camera',
        });
      } else {
        habits.push({
          name: 'Protein Intake',
          description: 'Hit your protein goal',
          target_value: 150,
          unit: 'g',
          verification_type: 'none',
        });
      }

      // Get client ID
      const { data: clientData } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (clientData) {
        const habitsToInsert = habits.map(h => ({
          client_id: clientData.id,
          ...h,
          is_active: true,
        }));
        
        await supabase.from('habits').insert(habitsToInsert);
      }

      // 3. Mark Onboarding as Completed
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ onboarding_completed: true })
        .eq('id', user.id);

      if (profileError) throw profileError;

      // 4. Refresh and Redirect
      await refreshProfile();
      router.replace('/(client)/(tabs)');

    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Basic Info</Text>
      <Text style={styles.stepSubtitle}>Let's get to know you better</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Date of Birth (YYYY-MM-DD)</Text>
        <TextInput
          style={styles.input}
          placeholder="1990-01-01"
          value={formData.date_of_birth}
          onChangeText={(text) => updateForm('date_of_birth', text)}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Gender</Text>
        <View style={styles.row}>
          {['Male', 'Female', 'Other'].map((g) => (
            <TouchableOpacity
              key={g}
              style={[styles.optionButton, formData.gender === g && styles.optionSelected]}
              onPress={() => updateForm('gender', g)}
            >
              <Text style={[styles.optionText, formData.gender === g && styles.optionTextSelected]}>{g}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Height (cm)</Text>
        <TextInput
          style={styles.input}
          placeholder="175"
          keyboardType="numeric"
          value={formData.height_cm}
          onChangeText={(text) => updateForm('height_cm', text)}
        />
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Your Goal</Text>
      <Text style={styles.stepSubtitle}>What do you want to achieve?</Text>

      {['Weight Loss', 'Muscle Gain', 'Maintenance', 'Improve Health'].map((g) => (
        <TouchableOpacity
          key={g}
          style={[styles.cardOption, formData.goal === g && styles.cardSelected]}
          onPress={() => updateForm('goal', g)}
        >
          <Text style={[styles.cardText, formData.goal === g && styles.cardTextSelected]}>{g}</Text>
          {formData.goal === g && <Check size={20} color="#3B82F6" />}
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Experience Level</Text>
      <Text style={styles.stepSubtitle}>How active are you currently?</Text>

      {['Beginner', 'Intermediate', 'Advanced'].map((l) => (
        <TouchableOpacity
          key={l}
          style={[styles.cardOption, formData.experience_level === l && styles.cardSelected]}
          onPress={() => updateForm('experience_level', l)}
        >
          <Text style={[styles.cardText, formData.experience_level === l && styles.cardTextSelected]}>{l}</Text>
          {formData.experience_level === l && <Check size={20} color="#3B82F6" />}
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderStep4 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Almost Done!</Text>
      <Text style={styles.stepSubtitle}>Any dietary restrictions?</Text>

      {['None', 'Vegetarian', 'Vegan', 'Gluten Free', 'Keto'].map((d) => {
        const isSelected = formData.dietary_restrictions.includes(d);
        return (
          <TouchableOpacity
            key={d}
            style={[styles.cardOption, isSelected && styles.cardSelected]}
            onPress={() => {
              const current = formData.dietary_restrictions;
              if (isSelected) {
                updateForm('dietary_restrictions', current.filter(i => i !== d));
              } else {
                updateForm('dietary_restrictions', [...current, d]);
              }
            }}
          >
            <Text style={[styles.cardText, isSelected && styles.cardTextSelected]}>{d}</Text>
            {isSelected && <Check size={20} color="#3B82F6" />}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${(step / 4) * 100}%` }]} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
      </ScrollView>

      <View style={styles.footer}>
        {step > 1 ? (
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <ChevronLeft size={24} color="#6B7280" />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        ) : <View />}

        <TouchableOpacity style={styles.nextButton} onPress={handleNext} disabled={loading}>
          <Text style={styles.nextButtonText}>{step === 4 ? (loading ? 'Saving...' : 'Finish') : 'Next'}</Text>
          {!loading && <ChevronRight size={20} color="#FFFFFF" />}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  progressBar: {
    height: 4,
    backgroundColor: '#E5E7EB',
    marginTop: 60,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3B82F6',
  },
  content: {
    padding: 24,
    flexGrow: 1,
  },
  stepContainer: {
    gap: 24,
  },
  stepTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#111827',
  },
  stepSubtitle: {
    fontSize: 18,
    color: '#6B7280',
    marginTop: -16,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  optionButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  optionSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  optionText: {
    color: '#6B7280',
    fontWeight: '500',
  },
  optionTextSelected: {
    color: '#3B82F6',
  },
  cardOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  cardSelected: {
    borderColor: '#3B82F6',
    backgroundColor: '#EFF6FF',
  },
  cardText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#374151',
  },
  cardTextSelected: {
    color: '#3B82F6',
  },
  footer: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  backButtonText: {
    fontSize: 16,
    color: '#6B7280',
    marginLeft: 4,
  },
  nextButton: {
    backgroundColor: '#3B82F6',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
