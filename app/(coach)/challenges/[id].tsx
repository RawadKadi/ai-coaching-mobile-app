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
import { ArrowLeft, X, AlertCircle, CheckCircle, Calendar, Target } from 'lucide-react-native';

/**
 * Mother Challenge Detail Screen V3 (Coach View)
 * Shows mother challenge with all sub-challenges
 */

export default function ChallengeDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [challenge, setChallenge] = useState<any>(null);

  useEffect(() => {
    loadChallengeDetails();

    // Set up real-time subscription for sub-challenge updates
    if (!id) return;

    const subscription = supabase
      .channel(`challenge-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sub_challenges',
          filter: `mother_challenge_id=eq.${id}`
        },
        (payload) => {
          console.log('[Real-time] Sub-challenge updated:', payload.new);
          
          // Update the specific sub-challenge in local state
          setChallenge((current: any) => {
            if (!current) return current;
            
            const updatedSubChallenges = current.sub_challenges.map((sub: any) => {
              if (sub.id === payload.new.id) {
                return {
                  ...sub,
                  completed: payload.new.completed,
                  completed_at: payload.new.completed_at
                };
              }
              return sub;
            });

            return {
              ...current,
              sub_challenges: updatedSubChallenges
            };
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [id]);

  const loadChallengeDetails = async () => {
    if (!id || !user) return;

    try {
      setLoading(true);

      // Get mother challenge with all sub-challenges
      const { data, error } = await supabase.rpc('get_mother_challenge_details', {
        p_mother_challenge_id: id
      });

      if (error) throw error;

      if (!data || data.length === 0) {
        Alert.alert('Error', 'Challenge not found');
        router.back();
        return;
      }

      setChallenge(data[0]);
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
              const { error } = await supabase.rpc('cancel_mother_challenge', {
                p_mother_challenge_id: id
              });

              if (error) throw error;

              Alert.alert('Success', 'Challenge cancelled');
              router.back();
            } catch (error:any) {
              console.error('Error cancelling challenge:', error);
              Alert.alert('Error', 'Failed to cancel challenge');
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
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color="#111" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Challenge Details</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.emptyContainer}>
          <AlertCircle size={48} color="#999" />
          <Text style={styles.emptyText}>Challenge not found</Text>
        </View>
      </View>
    );
  }

  const completedCount = challenge.sub_challenges?.filter((s: any) => s.completed).length || 0;
  const totalCount = challenge.sub_challenges?.length || 0;
  const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Challenge Details</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scrollView}>
        {/* Challenge Info Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.challengeName}>{challenge.name}</Text>
            <View style={[styles.statusBadge, challenge.status === 'active' && styles.statusActive]}>
              <Text style={styles.statusText}>{challenge.status}</Text>
            </View>
          </View>

          {challenge.description && (
            <Text style={styles.description}>{challenge.description}</Text>
          )}

          <View style={styles.infoRow}>
            <Calendar size={16} color="#666" />
            <Text style={styles.infoText}>
              {new Date(challenge.start_date).toLocaleDateString()} - {new Date(challenge.end_date).toLocaleDateString()}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Target size={16} color="#666" />
            <Text style={styles.infoText}>
              {challenge.client_name}
            </Text>
          </View>

          {/* Progress */}
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Overall Progress</Text>
              <Text style={styles.progressPercent}>{completionRate}%</Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${completionRate}%` }]} />
            </View>
            <Text style={styles.progressText}>
              {completedCount} of {totalCount} tasks completed
            </Text>
          </View>
        </View>

        {/* Sub-Challenges List */}
        <Text style={styles.sectionTitle}>Daily Tasks ({totalCount})</Text>
        {challenge.sub_challenges?.map((sub: any, index: number) => (
          <View key={sub.id} style={styles.subChallengeCard}>
            <View style={styles.subHeader}>
              <View style={styles.subHeaderLeft}>
                <Text style={styles.subDate}>
                  {new Date(sub.assigned_date).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric'
                  })}
                </Text>
                <View style={[styles.focusBadge, { backgroundColor: getFocusColor(sub.focus_type) }]}>
                  <Text style={styles.focusText}>{sub.focus_type}</Text>
                </View>
              </View>
              {sub.completed ? (
                <CheckCircle size={24} color="#10b981" />
              ) : (
                <View style={styles.incompleteBadge}>
                  <Text style={styles.incompleteText}>Pending</Text>
                </View>
              )}
            </View>

            <Text style={styles.subName}>{sub.name}</Text>
            {sub.description && (
              <Text style={styles.subDescription}>{sub.description}</Text>
            )}

            <View style={styles.subFooter}>
              <Text style={styles.intensityText}>Intensity: {sub.intensity}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Cancel Button */}
      {challenge.status === 'active' && (
        <View style={styles.footer}>
          <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
            <X size={20} color="#ef4444" />
            <Text style={styles.cancelButtonText}>Cancel Challenge</Text>
          </TouchableOpacity>
        </View>
      )}
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
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9fafb' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyText: { fontSize: 16, color: '#999', marginTop: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingTop: 60, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#111' },
  scrollView: { flex: 1 },
  card: { backgroundColor: '#fff', margin: 16, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 },
  challengeName: { fontSize: 20, fontWeight: 'bold', color: '#111', flex: 1, marginRight: 12 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, backgroundColor: '#f3f4f6' },
  statusActive: { backgroundColor: '#dcfce7' },
  statusText: { fontSize: 12, fontWeight: '600', color: '#16a34a', textTransform: 'capitalize' },
  description: { fontSize: 14, color: '#666', lineHeight: 20, marginBottom: 16 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  infoText: { fontSize: 14, color: '#666' },
  progressSection: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  progressLabel: { fontSize: 14, fontWeight: '600', color: '#111' },
  progressPercent: { fontSize: 18, fontWeight: 'bold', color: '#6366f1' },
  progressBar: { height: 8, backgroundColor: '#e5e7eb', borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: '100%', backgroundColor: '#10b981', borderRadius: 4 },
  progressText: { fontSize: 12, color: '#666' },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#111', marginHorizontal: 16, marginTop: 8, marginBottom: 12 },
  subChallengeCard: { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 12, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  subHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  subHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subDate: { fontSize: 13, fontWeight: '600', color: '#111' },
  focusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  focusText: { fontSize: 11, fontWeight: '600', color: '#fff' },
  incompleteBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: '#fef3c7' },
  incompleteText: { fontSize: 11, fontWeight: '600', color: '#92400e' },
  subName: { fontSize: 16, fontWeight: '600', color: '#111', marginBottom: 4 },
  subDescription: { fontSize: 13, color: '#666', lineHeight: 18, marginBottom: 8 },
  subFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  intensityText: { fontSize: 12, color: '#666', textTransform: 'capitalize' },
  footer: { padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  cancelButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, borderRadius: 12, backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fca5a5' },
  cancelButtonText: { fontSize: 16, fontWeight: '600', color: '#ef4444' },
});
