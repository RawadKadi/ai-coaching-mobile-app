import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { ChallengeFocusType } from '@/types/database';
import { X, Plus, Calendar, Target, Trash2 } from 'lucide-react-native';

/**
 * V3 Challenge Creation Screen
 * Creates Mother Challenges with daily Sub-Challenges
 */

interface Client {
  id: string;
  full_name: string;
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
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [durationDays, setDurationDays] = useState('7');
  const [subChallenges, setSubChallenges] = useState<SubChallenge[]>([]);

  // UI State
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [showClientPicker, setShowClientPicker] = useState(false);

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    // Auto-generate sub-challenges when duration changes
    const duration = parseInt(durationDays);
    if (!isNaN(duration) && duration >= 3 && duration <= 14) {
      generateSubChallenges(duration);
    }
  }, [durationDays, startDate]);

  const loadClients = async () => {
    if (!coach) return;

    try {
      const { data, error } = await supabase.rpc('get_coach_clients', {
        p_coach_id: coach.id
      });

      if (error) throw error;

      setClients(data || []);

      // Pre-select client if provided via URL
      if (clientId && data) {
        const preSelectedClient = data.find((c: Client) => c.id === clientId);
        if (preSelectedClient) {
          setSelectedClient(preSelectedClient);
        }
      }
    } catch (error) {
      console.error('Error loading clients:', error);
      Alert.alert('Error', 'Failed to load clients');
    }
  };

  const generateSubChallenges = (days: number) => {
    const start = new Date(startDate);
    const subs: SubChallenge[] = [];

    for (let i = 0; i < days; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      
      subs.push({
        name: `Day ${i + 1} Task`,
        description: '',
        assigned_date: date.toISOString().split('T')[0],
        focus_type: 'training',
        intensity: 'moderate',
      });
    }

    setSubChallenges(subs);
  };

  const updateSubChallenge = (index: number, field: keyof SubChallenge, value: any) => {
    const updated = [...subChallenges];
    updated[index] = { ...updated[index], [field]: value };
    setSubChallenges(updated);
  };

  const validateForm = (): boolean => {
    if (!selectedClient) {
      Alert.alert('Validation Error', 'Please select a client');
      return false;
    }

    if (!name.trim()) {
      Alert.alert('Validation Error', 'Please enter a challenge name');
      return false;
    }

    const duration = parseInt(durationDays);
    if (isNaN(duration) || duration < 3 || duration > 14) {
      Alert.alert('Validation Error', 'Duration must be between 3 and 14 days');
      return false;
    }

    const invalidSubs = subChallenges.filter(s => !s.name.trim());
    if (invalidSubs.length > 0) {
      Alert.alert('Validation Error', 'All sub-challenges must have a name');
      return false;
    }

    return true;
  };

  const handleCreate = async () => {
    if (!validateForm() || !coach) return;

    try {
      setLoading(true);

      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + parseInt(durationDays) - 1);

      const { data, error } = await supabase.rpc('create_mother_challenge', {
        p_coach_id: coach.id,
        p_client_id: selectedClient!.id,
        p_name: name.trim(),
        p_description: description.trim() || null,
        p_start_date: startDate,
        p_end_date: endDate.toISOString().split('T')[0],
        p_sub_challenges: subChallenges,
        p_created_by: 'coach',
      });

      if (error) throw error;

      Alert.alert(
        'Success',
        'Challenge created successfully!',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error: any) {
      console.error('Error creating challenge:', error);
      Alert.alert('Error', error.message || 'Failed to create challenge');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
            <X size={24} color="#666" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Challenge</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Client Selection */}
        <View style={styles.section}>
          <Text style={styles.label}>Client *</Text>
          <TouchableOpacity
            style={styles.clientSelector}
            onPress={() => setShowClientPicker(!showClientPicker)}
          >
            <Text style={selectedClient ? styles.clientText : styles.placeholderText}>
              {selectedClient ? selectedClient.full_name : 'Select a client'}
            </Text>
          </TouchableOpacity>

          {showClientPicker && (
            <View style={styles.clientPicker}>
              {clients.map((client) => (
                <TouchableOpacity
                  key={client.id}
                  style={styles.clientOption}
                  onPress={() => {
                    setSelectedClient(client);
                    setShowClientPicker(false);
                  }}
                >
                  <Text style={styles.clientOptionText}>{client.full_name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Challenge Name */}
        <View style={styles.section}>
          <Text style={styles.label}>Challenge Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., 7-Day Wellness Challenge"
            value={name}
            onChangeText={setName}
            maxLength={100}
          />
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Explain what this challenge is about..."
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Duration */}
        <View style={styles.section}>
          <Text style={styles.label}>Duration (3-14 days) *</Text>
          <View style={styles.durationRow}>
            <TextInput
              style={[styles.input, styles.durationInput]}
              placeholder="7"
              value={durationDays}
              onChangeText={setDurationDays}
              keyboardType="number-pad"
              maxLength={2}
            />
            <Text style={styles.durationText}>days</Text>
          </View>
        </View>

        {/* Start Date */}
        <View style={styles.section}>
          <Text style={styles.label}>Start Date *</Text>
          <View style={styles.dateRow}>
            <Calendar size={20} color="#666" />
            <TextInput
              style={[styles.input, styles.dateInput]}
              value={startDate}
              onChangeText={setStartDate}
              placeholder="YYYY-MM-DD"
            />
          </View>
        </View>

        {/* Sub-Challenges */}
        <View style={styles.section}>
          <Text style={styles.label}>Daily Tasks ({subChallenges.length})</Text>
          <Text style={styles.helperText}>
            Customize the daily tasks for each day of the challenge
          </Text>
          
          {subChallenges.map((sub, index) => (
            <View key={index} style={styles.subChallengeCard }>
              <View style={styles.subChallengeHeader}>
                <Text style={styles.subChallengeDay}>
                  Day {index + 1} - {sub.assigned_date}
                </Text>
              </View>
              
              <TextInput
                style={[styles.input, styles.subInput]}
                placeholder={`Day ${index + 1} task name`}
                value={sub.name}
                onChangeText={(value) => updateSubChallenge(index, 'name', value)}
              />
              
              <TextInput
                style={[styles.input, styles.textArea, { marginTop: 8 }]}
                placeholder="Task description (optional)"
                value={sub.description}
                onChangeText={(value) => updateSubChallenge(index, 'description', value)}
                multiline
                numberOfLines={2}
              />

              <View style={styles.subMeta}>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Focus:</Text>
                  <View style={styles.focusButtons}>
                    {(['training', 'nutrition', 'recovery', 'consistency'] as ChallengeFocusType[]).map(
                      (type) => (
                        <TouchableOpacity
                          key={type}
                          style={[
                            styles.metaChip,
                            sub.focus_type === type && styles.metaChipActive,
                          ]}
                          onPress={() => updateSubChallenge(index, 'focus_type', type)}
                        >
                          <Text
                            style={[
                              styles.metaChipText,
                              sub.focus_type === type && styles.metaChipTextActive,
                            ]}
                          >
                            {type}
                          </Text>
                        </TouchableOpacity>
                      )
                    )}
                  </View>
                </View>

                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Intensity:</Text>
                  <View style={styles.focusButtons}>
                    {(['light', 'moderate', 'intense'] as const).map((intensity) => (
                      <TouchableOpacity
                        key={intensity}
                        style={[
                          styles.metaChip,
                          sub.intensity === intensity && styles.metaChipActive,
                        ]}
                        onPress={() => updateSubChallenge(index, 'intensity', intensity)}
                      >
                        <Text
                          style={[
                            styles.metaChipText,
                            sub.intensity === intensity && styles.metaChipTextActive,
                          ]}
                        >
                          {intensity}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => router.back()}
          disabled={loading}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.createButton, loading && styles.createButtonDisabled]}
          onPress={handleCreate}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Target size={20} color="#fff" />
              <Text style={styles.createButtonText}>Create Challenge</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function getFocusEmoji(focusType: ChallengeFocusType): string {
  const emojis: Record<ChallengeFocusType, string> = {
    training: '💪',
    nutrition: '🥗',
    recovery: '😴',
    consistency: '🎯',
  };
  return emojis[focusType];
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111',
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  helperText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 12,
  },
  subChallengeCard: {
   backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  subChallengeHeader: {
    marginBottom: 12,
  },
  subChallengeDay: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3B82F6',
  },
  subInput: {
    fontWeight: '600',
  },
  subMeta: {
    marginTop: 12,
    gap: 8,
  },
  metaRow: {
    gap: 8,
  },
  metaLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  focusButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  metaChip: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  metaChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  metaChipText: {
    fontSize: 11,
    color: '#666',
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  metaChipTextActive: {
    color: '#3B82F6',
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#111',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  clientSelector: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
  },
  clientText: {
    fontSize: 14,
    color: '#111',
  },
  placeholderText: {
    fontSize: 14,
    color: '#9ca3af',
  },
  clientPicker: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    marginTop: 8,
    maxHeight: 200,
  },
  clientOption: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  clientOptionText: {
    fontSize: 14,
    color: '#111',
  },
  focusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  focusChip: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  focusChipActive: {
    borderColor: '#6366f1',
    backgroundColor: '#ede9fe',
  },
  focusChipText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  focusChipTextActive: {
    color: '#6366f1',
    fontWeight: '600',
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  durationInput: {
    flex: 1,
    maxWidth: 80,
  },
  durationText: {
    fontSize: 14,
    color: '#666',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
  },
  dateInput: {
    flex: 1,
    borderWidth: 0,
    padding: 0,
  },
  rulesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  addRuleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addRuleText: {
    fontSize: 14,
    color: '#6366f1',
    fontWeight: '600',
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 12,
  },
  ruleNumber: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
    marginTop: 12,
  },
  ruleInput: {
    flex: 1,
  },
  previewSection: {
    marginTop: 16,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  previewCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  previewName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 8,
  },
  previewDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  previewMeta: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  previewMetaText: {
    fontSize: 12,
    color: '#666',
    textTransform: 'capitalize',
  },
  previewRules: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 12,
  },
  previewRulesTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  previewRule: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  createButton: {
    flex: 2,
    flexDirection: 'row',
    backgroundColor: '#6366f1',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  createButtonDisabled: {
    opacity: 0.5,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
