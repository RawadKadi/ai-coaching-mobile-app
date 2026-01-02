import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { X, AlertCircle, CheckCircle, Calendar, Target } from 'lucide-react-native';

/**
 * Daily Challenge Detail Screen (Coach View)
 * Shows single challenge details for a specific date
 */

export default function ChallengeDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [challenge, setChallenge] = useState<any>(null);
  const [clientName, setClientName] = useState('');

  useEffect(() => {
    loadChallengeDetails();
  }, [id]);

  const loadChallengeDetails = async () => {
    if (!id || !user) return;

    try {
      setLoading(true);

      // Get challenge from daily_challenges
      const { data, error } = await supabase
        .from('daily_challenges')
        .select(`
          *,
          client:clients(
            id,
            profiles:user_id(full_name)
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      setChallenge(data);

      // Extract client name
      const clientData = data.client;
      const profiles = Array.isArray(clientData?.profiles)
        ? clientData.profiles[0]
        : clientData?.profiles;
      setClientName(profiles?.full_name || 'Client');
    } catch (error) {
      console.error('Error loading challenge:', error);
      Alert.alert('Error', 'Failed to load challenge details');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    Alert.alert(
      'Cancel Challenge',
      'Are you sure you want to cancel this challenge?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              const { data: coachData } = await supabase
                .from('coaches')
                .select('id')
                .eq('user_id', user!.id)
                .single();

              if (!coachData) throw new Error('Coach not found');

              const { error } = await supabase.rpc('cancel_daily_challenge', {
                p_challenge_id: id,
                p_coach_id: coachData.id,
              });

              if (error) throw error;

              Alert.alert('Success', 'Challenge cancelled', [
                { text: 'OK', onPress: () => router.back() },
              ]);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to cancel challenge');
            }
          },
        },
      ]
    );
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
        <AlertCircle size={48} color="#ef4444" />
        <Text style={styles.errorText}>Challenge not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <X size={24} color="#666" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Challenge Details</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scrollView}>
        {/* Challenge Info */}
        <View style={styles.section}>
          <View style={styles.titleRow}>
            <Text style={styles.challengeTitle}>{challenge.name}</Text>
            <View
              style={[
                styles.statusBadge,
                challenge.status === 'active'
                  ? styles.activeBadge
                  : challenge.completed
                  ? styles.completedBadge
                  : styles.cancelledBadge,
              ]}
            >
              <Text style={styles.statusText}>
                {challenge.completed ? 'Completed' : challenge.status}
              </Text>
            </View>
          </View>

          {challenge.created_by === 'ai' && (
            <View style={styles.aiTag}>
              <Text style={styles.aiTagText}>🤖 AI Generated</Text>
            </View>
          )}

          <Text style={styles.clientName}>👤 {clientName}</Text>

          {challenge.description && (
            <Text style={styles.description}>{challenge.description}</Text>
          )}

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Calendar size={16} color="#666" />
              <Text style={styles.metaText}>
                {new Date(challenge.assigned_date).toLocaleDateString()}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Target size={16} color="#666" />
              <Text style={styles.metaText}>{challenge.focus_type}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaText}>
                {challenge.intensity} intensity
              </Text>
            </View>
          </View>
        </View>

        {/* Completion Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Status</Text>
          <View style={styles.statusBox}>
            {challenge.completed ? (
              <>
                <CheckCircle size={32} color="#10b981" />
                <Text style={styles.completedText}>Completed ✓</Text>
                {challenge.completed_at && (
                  <Text style={styles.completedTimeText}>
                    {new Date(challenge.completed_at).toLocaleString()}
                  </Text>
                )}
                {challenge.notes && (
                  <View style={styles.notesBox}>
                    <Text style={styles.notesLabel}>Client Notes:</Text>
                    <Text style={styles.notesText}>{challenge.notes}</Text>
                  </View>
                )}
              </>
            ) : (
              <>
                <AlertCircle size={32} color="#f59e0b" />
                <Text style={styles.pendingText}>Not yet completed</Text>
              </>
            )}
          </View>
        </View>

        {/* Rules */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rules</Text>
          {challenge.rules?.map((rule: string, index: number) => (
            <View key={index} style={styles.ruleRow}>
              <Text style={styles.ruleNumber}>{index + 1}.</Text>
              <Text style={styles.ruleText}>{rule}</Text>
            </View>
          ))}
        </View>

        {/* AI Reasoning */}
        {challenge.ai_reasoning && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>AI Insight</Text>
            <View style={styles.insightBox}>
              <Text style={styles.insightText}>{challenge.ai_reasoning}</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Actions */}
      {challenge.status === 'active' && !challenge.completed && (
        <View style={styles.footer}>
          <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
            <Text style={styles.cancelButtonText}>Cancel Challenge</Text>
          </TouchableOpacity>
        </View>
      )}
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
    marginTop: 16,
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
  section: {
    backgroundColor: '#fff',
    margin: 12,
    padding: 16,
    borderRadius: 12,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  challengeTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111',
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeBadge: {
    backgroundColor: '#dcfce7',
  },
  completedBadge: {
    backgroundColor: '#dbeafe',
  },
  cancelledBadge: {
    backgroundColor: '#fee2e2',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#111',
    textTransform: 'capitalize',
  },
  aiTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#ede9fe',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  aiTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6366f1',
  },
  clientName: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 12,
    color: '#666',
    textTransform: 'capitalize',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
    marginBottom: 12,
  },
  statusBox: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
  },
  completedText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#10b981',
    marginTop: 8,
  },
  completedTimeText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  pendingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f59e0b',
    marginTop: 8,
  },
  notesBox: {
    width: '100%',
    marginTop: 16,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
  },
  ruleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  ruleNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366f1',
  },
  ruleText: {
    flex: 1,
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
  },
  insightBox: {
    backgroundColor: '#ede9fe',
    padding: 12,
    borderRadius: 8,
  },
  insightText: {
    fontSize: 14,
    color: '#444',
  },
  footer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  cancelButton: {
    backgroundColor: '#ef4444',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
