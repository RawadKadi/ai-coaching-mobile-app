import React, { useState } from 'react';
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
import { ArrowLeft, Check, RefreshCw, Plus, Trash2, Edit3 } from 'lucide-react-native';
import { SubChallengeTemplate } from '@/lib/ai-challenge-service';
import { useTheme } from '@/contexts/BrandContext';

export default function ReviewChallengesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { coach } = useAuth();
  const theme = useTheme();

  // Parse challenges from route params
  const initialChallenges: SubChallengeTemplate[] = params.challenges 
    ? JSON.parse(params.challenges as string)
    : [];

  const [challenges, setChallenges] = useState<SubChallengeTemplate[]>(initialChallenges);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

  const clientId = params.clientId as string;
  const clientName = params.clientName as string;
  const startDate = params.startDate as string;

  // Group by date
  const challengesByDate = challenges.reduce((acc, challenge, idx) => {
    const date = challenge.assigned_date;
    if (!acc[date]) acc[date] = [];
    acc[date].push({ ...challenge, index: idx });
    return acc;
  }, {} as Record<string, (SubChallengeTemplate & { index: number })[]>);

  const dates = Object.keys(challengesByDate).sort();

  const handleEdit = (index: number, field: string, value: string) => {
    const updated = [...challenges];
    updated[index] = { ...updated[index], [field]: value };
    setChallenges(updated);
  };

  const handleDelete = (index: number) => {
    Alert.alert('Delete Challenge', 'Remove this task?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setChallenges(challenges.filter((_, i) => i !== index));
        }
      }
    ]);
  };

  const handleAdd = (date: string) => {
    const newChallenge: SubChallengeTemplate = {
      name: 'New Task',
      description: 'Description here',
      assigned_date: date,
      focus_type: 'training',
      intensity: 'medium'
    };
    setChallenges([...challenges, newChallenge]);
  };

  const handleApprove = async () => {
    if (challenges.length === 0) {
      Alert.alert('Error', 'Add at least one challenge');
      return;
    }

    Alert.alert(
      'Create Challenge Program',
      `Create 7-day program with ${challenges.length} tasks for ${clientName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create',
          onPress: async () => {
            try {
              setCreating(true);

              const endDate = new Date(startDate);
              endDate.setDate(endDate.getDate() + 6);

              const { error } = await supabase.rpc('create_mother_challenge', {
                p_coach_id: coach!.id,
                p_client_id: clientId,
                p_name: `Week of ${new Date(startDate).toLocaleDateString()}`,
                p_description: `Personalized 7-day challenge program`,
                p_start_date: startDate,
                p_end_date: endDate.toISOString().split('T')[0],
                p_sub_challenges: challenges.map(c => ({
                  name: c.name,
                  description: c.description,
                  assigned_date: c.assigned_date,
                  focus_type: c.focus_type,
                  intensity: c.intensity
                })),
                p_created_by: 'coach',
                p_mode: 'relative'
              });

              if (error) throw error;

              Alert.alert('Success', 'Challenge program created!');
              router.back();
            } catch (error: any) {
              console.error('Error creating challenge:', error);
              Alert.alert('Error', error.message || 'Failed to create');
            } finally {
              setCreating(false);
            }
          }
        }
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#111" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Review & Edit</Text>
          <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>{clientName}</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scrollView}>
        <Text style={[styles.infoText, { color: theme.colors.textSecondary, backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          {challenges.length} tasks across 7 days. Edit any task before approving.
        </Text>

        {dates.map((date) => {
          const dayChallenges = challengesByDate[date];
          const dayName = new Date(date).toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'short',
            day: 'numeric'
          });

          return (
            <View key={date} style={styles.daySection}>
              <View style={[styles.dayHeader, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
                <Text style={[styles.dayTitle, { color: theme.colors.text }]}>{dayName}</Text>
                <TouchableOpacity onPress={() => handleAdd(date)} style={[styles.addButton, { backgroundColor: `${theme.colors.primary}20` }]}>
                  <Plus size={16} color={theme.colors.primary} />
                  <Text style={[styles.addButtonText, { color: theme.colors.primary }]}>Add</Text>
                </TouchableOpacity>
              </View>

              {dayChallenges.map((challenge) => (
                <View key={challenge.index} style={[styles.challengeCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                  {editingId === challenge.index ? (
                    // Edit Mode
                    <View style={styles.editForm}>
                      <TextInput
                        style={[styles.editInput, { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.border, color: theme.colors.text }]}
                        value={challenge.name}
                        onChangeText={(v) => handleEdit(challenge.index, 'name', v)}
                        placeholder="Task name"
                        placeholderTextColor={theme.colors.textTertiary}
                      />
                      <TextInput
                        style={[styles.editInput, styles.editTextarea, { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.border, color: theme.colors.text }]}
                        value={challenge.description}
                        onChangeText={(v) => handleEdit(challenge.index, 'description', v)}
                        placeholder="Description"
                        placeholderTextColor={theme.colors.textTertiary}
                        multiline
                      />
                      <View style={styles.editRow}>
                        <View style={styles.selectGroup}>
                          <Text style={styles.selectLabel}>Focus</Text>
                          <View style={styles.selectButtons}>
                            {(['training', 'nutrition', 'recovery', 'consistency'] as const).map(type => (
                              <TouchableOpacity
                                key={type}
                                style={[
                                  styles.selectButton,
                                  challenge.focus_type === type && styles.selectButtonActive
                                ]}
                                onPress={() => handleEdit(challenge.index, 'focus_type', type)}
                              >
                                <Text style={[
                                  styles.selectButtonText,
                                  challenge.focus_type === type && styles.selectButtonTextActive
                                ]}>{type}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                      </View>
                      <View style={styles.editRow}>
                        <View style={styles.selectGroup}>
                          <Text style={styles.selectLabel}>Intensity</Text>
                          <View style={styles.selectButtons}>
                            {(['low', 'medium', 'high'] as const).map(level => (
                              <TouchableOpacity
                                key={level}
                                style={[
                                  styles.selectButton,
                                  challenge.intensity === level && styles.selectButtonActive
                                ]}
                                onPress={() => handleEdit(challenge.index, 'intensity', level)}
                              >
                                <Text style={[
                                  styles.selectButtonText,
                                  challenge.intensity === level && styles.selectButtonTextActive
                                ]}>{level}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                      </View>
                      <TouchableOpacity
                        style={[styles.doneButton, { backgroundColor: theme.colors.accent }]}
                        onPress={() => setEditingId(null)}
                      >
                        <Check size={16} color="#fff" />
                        <Text style={styles.doneButtonText}>Done</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    // View Mode
                    <>
                      <View style={styles.challengeHeader}>
                        <Text style={[styles.challengeName, { color: theme.colors.text }]}>{challenge.name}</Text>
                        <View style={styles.challengeActions}>
                          <TouchableOpacity onPress={() => setEditingId(challenge.index)}>
                            <Edit3 size={18} color="#6366f1" />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => handleDelete(challenge.index)}>
                            <Trash2 size={18} color="#ef4444" />
                          </TouchableOpacity>
                        </View>
                      </View>
                      <Text style={[styles.challengeDescription, { color: theme.colors.textSecondary }]}>{challenge.description}</Text>
                      <View style={styles.challengeMeta}>
                        <View style={[styles.badge, { backgroundColor: getFocusColor(challenge.focus_type) }]}>
                          <Text style={styles.badgeText}>{challenge.focus_type}</Text>
                        </View>
                        <View style={[styles.badge, { backgroundColor: '#f3f4f6' }]}>
                          <Text style={[styles.badgeText, { color: '#666' }]}>{challenge.intensity}</Text>
                        </View>
                      </View>
                    </>
                  )}
                </View>
              ))}
            </View>
          );
        })}
      </ScrollView>

      {/* Footer Actions */}
      <View style={[styles.footer, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }]}>
        <TouchableOpacity style={[styles.approveButton, { backgroundColor: theme.colors.primary }]} onPress={handleApprove} disabled={creating}>
          {creating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Check size={20} color="#fff" />
              <Text style={styles.approveButtonText}>Approve All ({challenges.length})</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function getFocusColor(focusType: string): string {
  const colors: Record<string, string> = {
    training: '#3b82f6',
    nutrition: '#10b981',
    recovery: '#8b5cf6',
    consistency: '#f59e0b',
  };
  return colors[focusType] || '#6b7280';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingTop: 60, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  backButton: { padding: 8 },
  headerCenter: { alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#111' },
  headerSubtitle: { fontSize: 13, color: '#666', marginTop: 2 },
  scrollView: { flex: 1 },
  infoText: { fontSize: 14, color: '#666', padding: 16, backgroundColor: '#f0f9ff', borderBottomWidth: 1, borderBottomColor: '#bfdbfe' },
  daySection: { marginBottom: 24 },
  dayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff' },
  dayTitle: { fontSize: 16, fontWeight: '600', color: '#111' },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#eff6ff' },
  addButtonText: { fontSize: 13, fontWeight: '600', color: '#6366f1' },
  challengeCard: { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 12, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  challengeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  challengeName: { flex: 1, fontSize: 16, fontWeight: '600', color: '#111', marginRight: 12 },
  challengeActions: { flexDirection: 'row', gap: 12 },
  challengeDescription: { fontSize: 14, color: '#666', lineHeight: 20, marginBottom: 12 },
  challengeMeta: { flexDirection: 'row', gap: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 11, fontWeight: '600', color: '#fff', textTransform: 'capitalize' },
  editForm: { gap: 12 },
  editInput: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, fontSize: 15, color: '#111' },
  editTextarea: { minHeight: 80, textAlignVertical: 'top' },
  editRow: { flexDirection: 'row', gap: 12 },
  selectGroup: { flex: 1 },
  selectLabel: { fontSize: 12, fontWeight: '600', color: '#666', marginBottom: 6 },
  selectButtons: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  selectButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff' },
  selectButtonActive: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  selectButtonText: { fontSize: 12, fontWeight: '600', color: '#666', textTransform: 'capitalize' },
  selectButtonTextActive: { color: '#fff' },
  doneButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 12, borderRadius: 8, backgroundColor: '#10b981' },
  doneButtonText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  footer: { padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  approveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, borderRadius: 12, backgroundColor: '#6366f1' },
  approveButtonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});
