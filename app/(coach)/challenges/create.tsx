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
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { ChallengeFocusType } from '@/types/database';
import { X, Plus, Calendar, Target } from 'lucide-react-native';

/**
 * Manual Challenge Creation Screen
 * Allows coaches to create challenges without AI assistance
 */

interface Client {
  id: string;
  full_name: string;
}

export default function CreateChallengeScreen() {
  const router = useRouter();
  const { user } = useAuth();

  // Form State
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [focusType, setFocusType] = useState<ChallengeFocusType>('training');
  const [durationDays, setDurationDays] = useState('7');
  const [rules, setRules] = useState<string[]>(['']);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);

  // UI State
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [showClientPicker, setShowClientPicker] = useState(false);

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('coach_client_links')
        .select(`
          client_id,
          profiles:client_id (
            id,
            full_name
          )
        `)
        .eq('coach_id', user.id)
        .eq('status', 'active');

      if (error) throw error;

      const clientList = data
        .map((link: any) => ({
          id: link.profiles.id,
          full_name: link.profiles.full_name,
        }))
        .filter(Boolean);

      setClients(clientList);
    } catch (error) {
      console.error('Error loading clients:', error);
      Alert.alert('Error', 'Failed to load clients');
    }
  };

  const handleAddRule = () => {
    setRules([...rules, '']);
  };

  const handleRemoveRule = (index: number) => {
    setRules(rules.filter((_, i) => i !== index));
  };

  const handleRuleChange = (index: number, value: string) => {
    const newRules = [...rules];
    newRules[index] = value;
    setRules(newRules);
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

    const validRules = rules.filter(r => r.trim().length > 0);
    if (validRules.length === 0) {
      Alert.alert('Validation Error', 'Please add at least one rule');
      return false;
    }

    return true;
  };

  const handleCreate = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);

      const validRules = rules.filter(r => r.trim().length > 0);

      const { data, error } = await supabase.rpc('create_manual_challenge', {
        p_coach_id: user!.id,
        p_client_id: selectedClient!.id,
        p_name: name.trim(),
        p_description: description.trim() || null,
        p_focus_type: focusType,
        p_duration_days: parseInt(durationDays),
        p_rules: validRules,
        p_start_date: startDate,
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
    <View style={styles.container}>
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
            placeholder="e.g., Walk 10,000 Steps Daily"
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
            placeholder="Explain what this challenge is about and why it matters..."
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Focus Type */}
        <View style={styles.section}>
          <Text style={styles.label}>Focus Type *</Text>
          <View style={styles.focusGrid}>
            {(['training', 'nutrition', 'recovery', 'consistency'] as ChallengeFocusType[]).map(
              (type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.focusChip,
                    focusType === type && styles.focusChipActive,
                  ]}
                  onPress={() => setFocusType(type)}
                >
                  <Text
                    style={[
                      styles.focusChipText,
                      focusType === type && styles.focusChipTextActive,
                    ]}
                  >
                    {getFocusEmoji(type)} {type}
                  </Text>
                </TouchableOpacity>
              )
            )}
          </View>
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

        {/* Rules */}
        <View style={styles.section}>
          <View style={styles.rulesHeader}>
            <Text style={styles.label}>Rules *</Text>
            <TouchableOpacity style={styles.addRuleButton} onPress={handleAddRule}>
              <Plus size={16} color="#6366f1" />
              <Text style={styles.addRuleText}>Add Rule</Text>
            </TouchableOpacity>
          </View>

          {rules.map((rule, index) => (
            <View key={index} style={styles.ruleRow}>
              <Text style={styles.ruleNumber}>{index + 1}.</Text>
              <TextInput
                style={[styles.input, styles.ruleInput]}
                placeholder="e.g., Walk at least 10,000 steps every day"
                value={rule}
                onChangeText={(value) => handleRuleChange(index, value)}
                multiline
              />
              {rules.length > 1 && (
                <TouchableOpacity onPress={() => handleRemoveRule(index)}>
                  <X size={20} color="#ef4444" />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>

        {/* Preview */}
        <View style={styles.previewSection}>
          <Text style={styles.previewTitle}>Preview</Text>
          <View style={styles.previewCard}>
            <Text style={styles.previewName}>{name || 'Challenge Name'}</Text>
            <Text style={styles.previewDescription}>
              {description || 'No description provided'}
            </Text>
            <View style={styles.previewMeta}>
              <Text style={styles.previewMetaText}>
                {getFocusEmoji(focusType)} {focusType}
              </Text>
              <Text style={styles.previewMetaText}>
                {durationDays || '?'} days
              </Text>
            </View>
            <View style={styles.previewRules}>
              <Text style={styles.previewRulesTitle}>Rules:</Text>
              {rules
                .filter(r => r.trim())
                .map((rule, i) => (
                  <Text key={i} style={styles.previewRule}>
                    • {rule}
                  </Text>
                ))}
            </View>
          </View>
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
    </View>
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
