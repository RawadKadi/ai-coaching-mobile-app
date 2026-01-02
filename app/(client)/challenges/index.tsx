import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Target, CheckCircle, Circle } from 'lucide-react-native';
import type { TodaysSubChallenge } from '@/types/challenges-v3';

/**
 * Client Challenges Screen V3
 * Shows today's sub-challenges grouped by mother challenge
 */

export default function ClientChallengesScreen() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [subChallenges, setSubChallenges] = useState<TodaysSubChallenge[]>([]);
  const [coachName, setCoachName] = useState('');

  useEffect(() => {
    loadChallenges();
  }, []);

  const loadChallenges = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Get client ID
      const { data: clientData } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!clientData) return;

      // Get TODAY'S sub-challenges
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase.rpc('get_todays_sub_challenges', {
        p_client_id: clientData.id,
        p_date: today,
      });

      if (error) throw error;

      setSubChallenges(data || []);

      // Get coach name
      if (data && data.length > 0) {
        const firstSub = data[0];
        const { data: motherData } = await supabase
          .from('mother_challenges')
          .select('coach_id')
          .eq('id', firstSub.mother_challenge_id)
          .single();

        if (motherData) {
          const { data: coachData } = await supabase
            .from('coaches')
            .select('profiles:user_id(full_name)')
            .eq('id', motherData.coach_id)
            .single();

          if (coachData) {
            const profiles = Array.isArray(coachData.profiles)
              ? coachData.profiles[0]
              : coachData.profiles;
            setCoachName(profiles?.full_name || 'Your Coach');
          }
        }
      }
    } catch (error) {
      console.error('Error loading challenges:', error);
      Alert.alert('Error', 'Failed to load challenges');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadChallenges();
  };

  const toggleSubChallenge = async (sub: TodaysSubChallenge) => {
    try {
      const newCompleted = !sub.completed;

      // Optimistic update
      setSubChallenges((prev) =>
        prev.map((s) => (s.id === sub.id ? { ...s, completed: newCompleted } : s))
      );

      // Get client ID
      const { data: clientData } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', user!.id)
        .single();

      if (!clientData) throw new Error('Client not found');

      // Update via RPC
      const { error } = await supabase.rpc('mark_sub_challenge', {
        p_sub_challenge_id: sub.id,
        p_client_id: clientData.id,
        p_completed: newCompleted,
      });

      if (error) throw error;
    } catch (error: any) {
      console.error('Error toggling sub-challenge:', error);
      Alert.alert('Error', error.message || 'Failed to update challenge');
      // Revert on error
      loadChallenges();
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  // Group by mother challenge
  const grouped = subChallenges.reduce((acc, sub) => {
    const key = sub.mother_challenge_id;
    if (!acc[key]) {
      acc[key] = {
        motherName: sub.mother_name,
        subs: [],
      };
    }
    acc[key].subs.push(sub);
    return acc;
  }, {} as Record<string, { motherName: string; subs: TodaysSubChallenge[] }>);

  const motherChallenges = Object.values(grouped);

  if (motherChallenges.length === 0) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Today's Challenges</Text>
          <Text style={styles.subtitle}>
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </Text>
        </View>

        <View style={styles.emptyState}>
          <Target size={64} color="#ccc" />
          <Text style={styles.emptyTitle}>No Challenges Today</Text>
          <Text style={styles.emptyDescription}>
            No challenges assigned for today. Check back tomorrow or talk to your coach!
          </Text>
        </View>
      </ScrollView>
    );
  }

  const completedCount = subChallenges.filter((s) => s.completed).length;
  const totalCount = subChallenges.length;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Today's Challenges</Text>
        <Text style={styles.subtitle}>
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </Text>
      </View>

      <View style={styles.statsBox}>
        <Text style={styles.statsText}>
          {completedCount} of {totalCount} completed
        </Text>
      </View>

      {/* Mother Challenges with Sub-Challenges */}
      {motherChallenges.map((mother) => {
        const motherCompleted = mother.subs.filter((s) => s.completed).length;
        const motherTotal = mother.subs.length;

        return (
          <View key={mother.motherName} style={styles.motherCard}>
            <View style={styles.motherHeader}>
              <Text style={styles.motherName}>{mother.motherName}</Text>
              <Text style={styles.motherProgress}>
                {motherCompleted}/{motherTotal}
              </Text>
            </View>

            {mother.subs.map((sub) => (
              <TouchableOpacity
                key={sub.id}
                style={[styles.subCard, sub.completed && styles.subCardCompleted]}
                onPress={() => toggleSubChallenge(sub)}
              >
                <View style={styles.subContent}>
                  <View style={styles.focusEmoji}>
                    <Text>{getFocusEmoji(sub.focus_type)}</Text>
                  </View>
                  <View style={styles.subInfo}>
                    <Text style={[styles.subName, sub.completed && styles.subNameCompleted]}>
                      {sub.name}
                    </Text>
                    {sub.description && (
                      <Text style={styles.subDescription} numberOfLines={2}>
                        {sub.description}
                      </Text>
                    )}
                    <View style={styles.subMeta}>
                      <Text style={styles.metaText}>{sub.focus_type}</Text>
                      <Text style={styles.metaBullet}>•</Text>
                      <Text style={styles.metaText}>{sub.intensity} intensity</Text>
                    </View>
                  </View>
                  <View style={styles.checkbox}>
                    {sub.completed ? (
                      <CheckCircle size={28} color="#10b981" />
                    ) : (
                      <Circle size={28} color="#d1d5db" />
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        );
      })}

      {/* Coach Message */}
      {coachName && (
        <View style={styles.coachMessage}>
          <Text style={styles.coachMessageTitle}>💪 Message from {coachName}</Text>
          <Text style={styles.coachMessageText}>
            You've got this! Take it one challenge at a time today.
          </Text>
        </View>
      )}
    </ScrollView>
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
  scrollContent: {
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  statsBox: {
    backgroundColor: '#6366f1',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 80,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptyDescription: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  motherCard: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
    overflow: 'hidden',
  },
  motherHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  motherName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
    flex: 1,
  },
  motherProgress: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366f1',
  },
  subCard: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  subCardCompleted: {
    backgroundColor: '#ecfdf5',
  },
  subContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  focusEmoji: {
    fontSize: 24,
  },
  subInfo: {
    flex: 1,
  },
  subName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111',
    marginBottom: 4,
  },
  subNameCompleted: {
    color: '#059669',
    textDecorationLine: 'line-through',
  },
  subDescription: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    marginBottom: 6,
  },
  subMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 11,
    color: '#666',
    textTransform: 'capitalize',
  },
  metaBullet: {
    fontSize: 11,
    color: '#666',
  },
  checkbox: {
    marginLeft: 'auto',
  },
  coachMessage: {
    backgroundColor: '#ecfdf5',
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  coachMessageTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#065f46',
    marginBottom: 8,
  },
  coachMessageText: {
    fontSize: 13,
    color: '#047857',
    lineHeight: 18,
  },
});
