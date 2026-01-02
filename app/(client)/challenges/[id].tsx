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
import { X, Check, Calendar as CalendarIcon, TrendingUp, CheckCircle } from 'lucide-react-native';

/**
 * Client Progress Tracker
 * Daily check-in interface for clients to mark challenge progress
 */

interface ProgressEntry {
  id: string;
  date: string;
  completed: boolean;
  notes: string | null;
}

interface Challenge {
  id: string;
  name: string;
  description: string;
  focus_type: string;
  duration_days: number;
  start_date: string;
  end_date: string;
  rules: string[];
}

export default function ChallengeProgressScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [progress, setProgress] = useState<ProgressEntry[]>([]);
  const [todayProgress, setTodayProgress] = useState<ProgressEntry | null>(null);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadChallengeAndProgress();
  }, [id]);

  const loadChallengeAndProgress = async () => {
    if (!id || !user) return;

    try {
      setLoading(true);

      // Get full challenge with progress
      const { data, error } = await supabase.rpc('get_challenge_with_progress', {
        p_challenge_id: id,
      });

      if (error) throw error;

      if (data) {
        setChallenge(data.challenge);
        setProgress(data.progress || []);

        // Check if today's progress exists
        const today = new Date().toISOString().split('T')[0];
        const todayEntry = data.progress?.find((p: any) => p.date === today);
        
        if (todayEntry) {
          setTodayProgress(todayEntry);
          setNotes(todayEntry.notes || '');
        } else {
          setTodayProgress(null);
          setNotes('');
        }
      }
    } catch (error) {
      console.error('Error loading challenge:', error);
      Alert.alert('Error', 'Failed to load challenge');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkProgress = async (completed: boolean) => {
    if (!challenge || !user) return;

    try {
      setSubmitting(true);

      // Get client ID
      const { data: clientData } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!clientData) throw new Error('Client not found');

      const today = new Date().toISOString().split('T')[0];

      const { error } = await supabase.rpc('mark_challenge_progress', {
        p_challenge_id: id,
        p_client_id: clientData.id,
        p_date: today,
        p_completed: completed,
        p_notes: notes.trim() || null,
        p_proof_url: null,
      });

      if (error) throw error;

      Alert.alert(
        'Success',
        completed ? 'Great job! Keep up the momentum! 🎉' : 'Progress saved',
        [
          {
            text: 'OK',
            onPress: () => loadChallengeAndProgress(),
          },
        ]
      );
    } catch (error: any) {
      console.error('Error marking progress:', error);
      Alert.alert('Error', error.message || 'Failed to save progress');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  if (!challenge) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Challenge not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const completedDays = progress.filter((p) => p.completed).length;
  const completionRate = Math.round((completedDays / challenge.duration_days) * 100);
  const today = new Date().toISOString().split('T')[0];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <X size={24} color="#666" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Track Progress</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Challenge Info */}
        <View style={styles.challengeInfo}>
          <Text style={styles.challengeName}>{challenge.name}</Text>
          <View style={styles.progressSummary}>
            <TrendingUp size={20} color="#6366f1" />
            <Text style={styles.progressSummaryText}>
              {completedDays}/{challenge.duration_days} days • {completionRate}%
            </Text>
          </View>
        </View>

        {/* Today's Check-in */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <CalendarIcon size={20} color="#6366f1" />
            <Text style={styles.sectionTitle}>Today's Check-in</Text>
          </View>

          <Text style={styles.dateText}>{new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}</Text>

          {todayProgress ? (
            <View style={styles.completedBanner}>
              <CheckCircle size={24} color="#10b981" />
              <Text style={styles.completedText}>
                {todayProgress.completed ? '✓ Completed for today!' : '✓ Logged for today'}
              </Text>
            </View>
          ) : (
            <View style={styles.pendingBanner}>
              <Text style={styles.pendingText}>⏰ Pending for today</Text>
            </View>
          )}

          {/* Notes Input */}
          <View style={styles.notesContainer}>
            <Text style={styles.inputLabel}>Notes (Optional)</Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="How did it go today? Any challenges or wins?"
              multiline
              numberOfLines={4}
              maxLength={500}
            />
            <Text style={styles.charCount}>{notes.length}/500</Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.actionButton, styles.skipButton]}
              onPress={() => handleMarkProgress(false)}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#666" />
              ) : (
                <>
                  <X size={20} color="#666" />
                  <Text style={styles.skipButtonText}>Skip Today</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.completeButton]}
              onPress={() => handleMarkProgress(true)}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Check size={20} color="#fff" />
                  <Text style={styles.completeButtonText}>Mark Complete</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Progress Calendar */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Progress Calendar</Text>
          <View style={styles.calendar}>
            {Array.from({ length: challenge.duration_days }, (_, i) => {
              const date = new Date(challenge.start_date);
              date.setDate(date.getDate() + i);
              const dateString = date.toISOString().split('T')[0];
              const dayProgress = progress.find((p) => p.date === dateString);
              const isToday = dateString === today;
              const isPast = new Date(dateString) < new Date(today);
              const isFuture = new Date(dateString) > new Date(today);

              return (
                <View
                  key={i}
                  style={[
                    styles.calendarDay,
                    dayProgress?.completed && styles.calendarDayCompleted,
                    isToday && styles.calendarDayToday,
                    isFuture && styles.calendarDayFuture,
                  ]}
                >
                  <Text
                    style={[
                      styles.calendarDayNumber,
                      dayProgress?.completed && styles.calendarDayNumberCompleted,
                      isToday && styles.calendarDayNumberToday,
                      isFuture && styles.calendarDayNumberFuture,
                    ]}
                  >
                    {i + 1}
                  </Text>
                  {dayProgress?.completed && (
                    <Check size={12} color="#fff" style={styles.calendarCheck} />
                  )}
                  {isToday && !dayProgress && (
                    <Text style={styles.todayIndicator}>•</Text>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* Previous Entries */}
        {progress.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Previous Entries</Text>
            {progress
              .filter((p) => p.date !== today)
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .slice(0, 5)
              .map((entry) => (
                <View key={entry.id} style={styles.historyEntry}>
                  <View style={styles.historyHeader}>
                    <Text style={styles.historyDate}>
                      {new Date(entry.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </Text>
                    {entry.completed ? (
                      <View style={styles.completedBadge}>
                        <Check size={12} color="#10b981" />
                        <Text style={styles.completedBadgeText}>Completed</Text>
                      </View>
                    ) : (
                      <Text style={styles.skippedText}>Skipped</Text>
                    )}
                  </View>
                  {entry.notes && (
                    <Text style={styles.historyNotes}>{entry.notes}</Text>
                  )}
                </View>
              ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
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
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  challengeInfo: {
    backgroundColor: '#6366f1',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  challengeName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  progressSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progressSummaryText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  section: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
  },
  dateText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  completedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#d1fae5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  completedText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#065f46',
  },
  pendingBanner: {
    backgroundColor: '#fef3c7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  pendingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400e',
  },
  notesContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  notesInput: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#111',
    height: 100,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 11,
    color: '#999',
    textAlign: 'right',
    marginTop: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 14,
    borderRadius: 8,
  },
  skipButton: {
    backgroundColor: '#f3f4f6',
  },
  skipButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  completeButton: {
    backgroundColor: '#10b981',
  },
  completeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  calendar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  calendarDay: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  calendarDayCompleted: {
    backgroundColor: '#10b981',
  },
  calendarDayToday: {
    borderColor: '#6366f1',
    borderWidth: 2,
  },
  calendarDayFuture: {
    opacity: 0.4,
  },
  calendarDayNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  calendarDayNumberCompleted: {
    color: '#fff',
  },
  calendarDayNumberToday: {
    color: '#6366f1',
  },
  calendarDayNumberFuture: {
    color: '#999',
  },
  calendarCheck: {
    position: 'absolute',
    bottom: 2,
    right: 2,
  },
  todayIndicator: {
    position: 'absolute',
    bottom: -2,
    fontSize: 16,
    color: '#6366f1',
  },
  historyEntry: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  historyDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#d1fae5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  completedBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#10b981',
  },
  skippedText: {
    fontSize: 11,
    color: '#999',
  },
  historyNotes: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
});
