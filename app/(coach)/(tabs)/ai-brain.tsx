import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
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
    if (coach) {
      loadBrainConfig();
    } else {
      setLoading(false);
    }
  }, [coach]);

  const loadBrainConfig = async () => {
    if (!coach) return;

    try {
      const { data } = await supabase
        .from('ai_coach_brains')
        .select('*')
        .eq('coach_id', coach.id)
        .maybeSingle();

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
      const updates = {
        tone,
        style,
        philosophy,
        specialty_focus: specialtyFocus,
        updated_at: new Date().toISOString(),
      };

      if (brainConfig) {
        await supabase
          .from('ai_coach_brains')
          .update(updates)
          .eq('coach_id', coach.id);
      } else {
        await supabase.from('ai_coach_brains').insert({
          coach_id: coach.id,
          ...updates,
        });
      }

      Alert.alert('Success', 'AI Brain configuration saved successfully');
      loadBrainConfig();
    } catch (error) {
      Alert.alert('Error', 'Failed to save configuration');
      console.error('Error saving brain config:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>AI Brain Configuration</Text>
        <Text style={styles.subtitle}>
          Customize how AI communicates with your clients
        </Text>
      </View>

      <View style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.label}>Tone</Text>
          <Text style={styles.description}>
            How should the AI communicate? (e.g., professional, friendly,
            motivating)
          </Text>
          <TextInput
            style={styles.input}
            value={tone}
            onChangeText={setTone}
            placeholder="professional and motivating"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Style</Text>
          <Text style={styles.description}>
            What approach should the AI take? (e.g., supportive, educational,
            direct)
          </Text>
          <TextInput
            style={styles.input}
            value={style}
            onChangeText={setStyle}
            placeholder="supportive and educational"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Philosophy</Text>
          <Text style={styles.description}>
            What are your core coaching principles?
          </Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={philosophy}
            onChangeText={setPhilosophy}
            placeholder="Describe your coaching philosophy..."
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={4}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Specialty Focus</Text>
          <Text style={styles.description}>
            What area do you specialize in? (e.g., weight loss, muscle
            building, mindset)
          </Text>
          <TextInput
            style={styles.input}
            value={specialtyFocus}
            onChangeText={setSpecialtyFocus}
            placeholder="weight loss and nutrition"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>Save Configuration</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    marginBottom: 16,
    padding: 8,
    alignSelf: 'flex-start',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  content: {
    padding: 16,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
    lineHeight: 20,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#111827',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
