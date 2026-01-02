import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { X, Check, Edit2, Trash2, Sparkles, AlertCircle } from 'lucide-react-native';

/**
 * Suggestion Detail Screen
 * Allows coaches to review, approve with edits, or dismiss AI suggestions
 */

interface AISuggestion {
  id: string;
  client_id: string;
  client_name: string;
  challenge_payload: any;
  trigger_reason: string;
  trigger_data: any;
  priority: number;
  expires_at: string;
  created_at: string;
}

export default function SuggestionDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [suggestion, setSuggestion] = useState<AISuggestion | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Editable fields
  const [editedName, setEditedName] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [editedDuration, setEditedDuration] = useState('');
  const [editedRules, setEditedRules] = useState<string[]>([]);

  useEffect(() => {
    loadSuggestion();
  }, [id]);

  const loadSuggestion = async () => {
    if (!id || !user) return;

    try {
      setLoading(true);

      // Get coach ID
      const { data: coachData } = await supabase
        .from('coaches')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!coachData) return;

      const { data, error } = await supabase
        .rpc('get_coach_challenge_suggestions', {
          p_coach_id: coachData.id,
        });

      if (error) throw error;

      const found = data?.find((s: any) => s.id === id);
      if (found) {
        setSuggestion(found);
        setEditedName(found.challenge_payload.name);
        setEditedDescription(found.challenge_payload.description);
        setEditedDuration(found.challenge_payload.duration_days.toString());
        setEditedRules(found.challenge_payload.rules || []);
      }
    } catch (error) {
      console.error('Error loading suggestion:', error);
      Alert.alert('Error', 'Failed to load suggestion');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!suggestion) return;

    try {
      setSubmitting(true);

      // Get coach ID
      const { data: coachData } = await supabase
        .from('coaches')
        .select('id')
        .eq('user_id', user!.id)
        .single();

      if (!coachData) throw new Error('Coach not found');

      const modifications = editMode
        ? {
            name: editedName,
            description: editedDescription,
            duration_days: parseInt(editedDuration),
            rules: editedRules.filter((r) => r.trim().length > 0),
          }
        : null;

      const { error } = await supabase.rpc('approve_challenge_suggestion', {
        p_suggestion_id: id,
        p_coach_id: coachData.id,
        p_modifications: modifications,
      });

      if (error) throw error;

      Alert.alert('Success', 'Challenge created successfully!', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error: any) {
      console.error('Error approving suggestion:', error);
      Alert.alert('Error', error.message || 'Failed to approve suggestion');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDismiss = async () => {
    Alert.alert(
      'Dismiss Suggestion',
      'Are you sure you want to dismiss this AI suggestion?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Dismiss',
          style: 'destructive',
          onPress: async () => {
            try {
              setSubmitting(true);

              // Get coach ID
              const { data: coachData } = await supabase
                .from('coaches')
                .select('id')
                .eq('user_id', user!.id)
                .single();

              if (!coachData) throw new Error('Coach not found');

              const { error } = await supabase.rpc('dismiss_challenge_suggestion', {
                p_suggestion_id: id,
                p_coach_id: coachData.id,
              });

              if (error) throw error;

              Alert.alert('Dismissed', 'Suggestion has been dismissed', [
                {
                  text: 'OK',
                  onPress: () => router.back(),
                },
              ]);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to dismiss suggestion');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const handleAddRule = () => {
    setEditedRules([...editedRules, '']);
  };

  const handleRemoveRule = (index: number) => {
    setEditedRules(editedRules.filter((_, i) => i !== index));
  };

  const handleRuleChange = (index: number, value: string) => {
    const newRules = [...editedRules];
    newRules[index] = value;
    setEditedRules(newRules);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  if (!suggestion) {
    return (
      <View style={styles.errorContainer}>
        <AlertCircle size={48} color="#ef4444" />
        <Text style={styles.errorText}>Suggestion not found or expired</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const payload = suggestion.challenge_payload;
  const priorityColors: Record<number, string> = {
    5: '#ef4444',
    4: '#f97316',
    3: '#eab308',
    2: '#22c55e',
    1: '#3b82f6',
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <X size={24} color="#666" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Sparkles size={20} color="#6366f1" />
          <Text style={styles.headerTitle}>AI Suggestion</Text>
        </View>
        <TouchableOpacity
          onPress={() => setEditMode(!editMode)}
          style={styles.editButton}
          disabled={submitting}
        >
          <Edit2 size={20} color={editMode ? '#6366f1' : '#666'} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Priority & Trigger */}
        <View style={styles.metaSection}>
          <View
            style={[
              styles.priorityBadge,
              { backgroundColor: priorityColors[suggestion.priority] },
            ]}
          >
            <Text style={styles.priorityText}>Priority {suggestion.priority}</Text>
          </View>
          <Text style={styles.triggerText}>
            Triggered by: {suggestion.trigger_reason.replace(/_/g, ' ')}
          </Text>
        </View>

        {/* Client Info */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Client</Text>
          <Text style={styles.clientName}>👤 {suggestion.client_name}</Text>
        </View>

        {/* Challenge Details */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Challenge Name</Text>
          {editMode ? (
            <TextInput
              style={styles.input}
              value={editedName}
              onChangeText={setEditedName}
              placeholder="Challenge name"
            />
          ) : (
            <Text style={styles.challengeTitle}>{payload.name}</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Description</Text>
          {editMode ? (
            <TextInput
              style={[styles.input, styles.textArea]}
              value={editedDescription}
              onChangeText={setEditedDescription}
              placeholder="Challenge description"
              multiline
              numberOfLines={4}
            />
          ) : (
            <Text style={styles.description}>{payload.description}</Text>
          )}
        </View>

        {/* Meta Info */}
        <View style={styles.section}>
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Focus</Text>
              <Text style={styles.metaValue}>{getFocusEmoji(payload.focus_type)} {payload.focus_type}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Duration</Text>
              {editMode ? (
                <TextInput
                  style={[styles.input, styles.durationInput]}
                  value={editedDuration}
                  onChangeText={setEditedDuration}
                  keyboardType="number-pad"
                  maxLength={2}
                />
              ) : (
                <Text style={styles.metaValue}>{payload.duration_days} days</Text>
              )}
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Intensity</Text>
              <Text style={styles.metaValue}>{payload.intensity}</Text>
            </View>
          </View>
        </View>

        {/* Rules */}
        <View style={styles.section}>
          <View style={styles.rulesHeader}>
            <Text style={styles.sectionLabel}>Rules</Text>
            {editMode && (
              <TouchableOpacity onPress={handleAddRule} style={styles.addRuleButton}>
                <Text style={styles.addRuleText}>+ Add Rule</Text>
              </TouchableOpacity>
            )}
          </View>
          {editMode ? (
            editedRules.map((rule, index) => (
              <View key={index} style={styles.ruleEditRow}>
                <Text style={styles.ruleNumber}>{index + 1}.</Text>
                <TextInput
                  style={[styles.input, styles.ruleInput]}
                  value={rule}
                  onChangeText={(value) => handleRuleChange(index, value)}
                  placeholder="Rule description"
                  multiline
                />
                {editedRules.length > 1 && (
                  <TouchableOpacity onPress={() => handleRemoveRule(index)}>
                    <X size={20} color="#ef4444" />
                  </TouchableOpacity>
                )}
              </View>
            ))
          ) : (
            payload.rules?.map((rule: string, index: number) => (
              <View key={index} style={styles.ruleRow}>
                <Text style={styles.ruleNumber}>{index + 1}.</Text>
                <Text style={styles.ruleText}>{rule}</Text>
              </View>
            ))
          )}
        </View>

        {/* AI Reasoning */}
        {payload.reasoning && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>AI Reasoning</Text>
            <View style={styles.reasoningBox}>
              <Text style={styles.reasoningText}>{payload.reasoning}</Text>
            </View>
          </View>
        )}

        {/* Trigger Data */}
        {suggestion.trigger_data && Object.keys(suggestion.trigger_data).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Trigger Data</Text>
            <View style={styles.triggerDataBox}>
              {Object.entries(suggestion.trigger_data).map(([key, value]) => (
                <Text key={key} style={styles.triggerDataText}>
                  • {key.replace(/_/g, ' ')}: {JSON.stringify(value)}
                </Text>
              ))}
            </View>
          </View>
        )}

        {/* Expiration Warning */}
        <View style={styles.expirationWarning}>
          <AlertCircle size={16} color="#f97316" />
          <Text style={styles.expirationText}>
            Expires: {new Date(suggestion.expires_at).toLocaleString()}
          </Text>
        </View>
      </ScrollView>

      {/* Actions Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.dismissButton}
          onPress={handleDismiss}
          disabled={submitting}
        >
          <Trash2 size={18} color="#ef4444" />
          <Text style={styles.dismissButtonText}>Dismiss</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.approveButton, submitting && styles.approveButtonDisabled]}
          onPress={handleApprove}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Check size={20} color="#fff" />
              <Text style={styles.approveButtonText}>
                {editMode ? 'Approve with Edits' : 'Approve'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function getFocusEmoji(focusType: string): string {
  const emojis: Record<string, string> = {
    training: '💪',
    nutrition: '🥗',
    recovery: '😴',
    consistency: '🎯',
  };
  return emojis[focusType] || '🎯';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    padding: 24,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  backButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#6366f1',
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 60,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  closeButton: {
    padding: 8,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111',
  },
  editButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  metaSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  priorityBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  priorityText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  triggerText: {
    fontSize: 12,
    color: '#666',
    textTransform: 'capitalize',
  },
  section: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  clientName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
  },
  challengeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111',
  },
  description: {
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
  },
  input: {
    backgroundColor: '#f9fafb',
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
  metaRow: {
    flexDirection: 'row',
    gap: 16,
  },
  metaItem: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 11,
    color: '#666',
    marginBottom: 4,
  },
  metaValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
    textTransform: 'capitalize',
  },
  durationInput: {
    padding: 8,
    fontSize: 14,
  },
  rulesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addRuleButton: {
    paddingHorizontal: 8,
  },
  addRuleText: {
    fontSize: 12,
    color: '#6366f1',
    fontWeight: '600',
  },
  ruleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  ruleEditRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  ruleNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366f1',
    marginTop: 12,
  },
  ruleText: {
    flex: 1,
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
  },
  ruleInput: {
    flex: 1,
  },
  reasoningBox: {
    backgroundColor: '#fef3c7',
    padding: 12,
    borderRadius: 8,
  },
  reasoningText: {
    fontSize: 13,
    color: '#78350f',
  },
  triggerDataBox: {
    backgroundColor: '#f3f4f6',
    padding: 12,
    borderRadius: 8,
  },
  triggerDataText: {
    fontSize: 12,
    color: '#374151',
    marginBottom: 4,
  },
  expirationWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff7ed',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  expirationText: {
    fontSize: 12,
    color: '#c2410c',
    fontWeight: '500',
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
  dismissButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dismissButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ef4444',
  },
  approveButton: {
    flex: 2,
    flexDirection: 'row',
    backgroundColor: '#10b981',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  approveButtonDisabled: {
    opacity: 0.5,
  },
  approveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
