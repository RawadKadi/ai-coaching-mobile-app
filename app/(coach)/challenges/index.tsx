// COPY THIS ENTIRE CONTENT AND PASTE INTO:
// app/(coach)/challenges/index.tsx

import React, { useState, useCallback, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Target, Sparkles, Clock } from 'lucide-react-native';
import type { MotherChallengeWithProgress } from '@/types/challenges-v3';

export default function CoachChallengesDashboard() {
  const router = useRouter();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeChallenges, setActiveChallenges] = useState<MotherChallengeWithProgress[]>([]);
  const [historyChallenges, setHistoryChallenges] = useState<MotherChallengeWithProgress[]>([]);

  // ✅ CHANGED: useFocusEffect instead of useEffect - reloads when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadChallenges();
    }, [])
  );

  // Real-time subscription for sub-challenge updates
  useEffect(() => {
    if (!user) return;

    const subscription = supabase
      .channel('sub-challenges-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sub_challenges'
        },
        (payload) => {
          console.log('[Dashboard Real-time] Sub-challenge updated');
          // Reload challenges to update progress
          loadChallenges();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [user]);

  const loadChallenges = async () => {
    if (!user) return;

    try {
      setLoading(true);

      const { data: coachData } = await supabase
        .from('coaches')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!coachData) {
        console.error('Coach not found');
        return;
      }

      const { data, error } = await supabase.rpc('get_coach_mother_challenges', {
        p_coach_id: coachData.id,
      });

      if (error) throw error;

      const active = (data || []).filter((c: any) => c.status === 'active');
      const history = (data || []).filter((c: any) => c.status !== 'active');

      setActiveChallenges(active);
      setHistoryChallenges(history);
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

  const navigateToCreate = () => {
    router.push('/(coach)/challenges/create');
  };

  const navigateToAIGenerate = () => {
    router.push('/(coach)/challenges/suggest');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  const challenges = activeTab === 'active' ? activeChallenges : historyChallenges;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Challenges</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.aiButton} onPress={navigateToAIGenerate}>
            <Sparkles size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.addButton} onPress={navigateToCreate}>
            <Plus size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'active' && styles.tabActive]}
          onPress={() => setActiveTab('active')}
        >
          <Text style={[styles.tabText, activeTab === 'active' && styles.tabTextActive]}>
            Active
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'history' && styles.tabActive]}
          onPress={() => setActiveTab('history')}
        >
          <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>
            History
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {challenges.length === 0 ? (
          <View style={styles.emptyState}>
            <Target size={64} color="#ccc" />
            <Text style={styles.emptyTitle}>
              {activeTab === 'active' ? 'No Active Challenges' : 'No Challenge History'}
            </Text>
            <Text style={styles.emptyDescription}>
              {activeTab === 'active'
                ? 'Create a new challenge or use AI to generate one for your clients.'
                : 'Completed and cancelled challenges will appear here.'}
            </Text>
          </View>
        ) : (
          challenges.map((challenge) => (
            <TouchableOpacity
              key={challenge.id}
              style={styles.challengeCard}
              onPress={() => router.push(`/(coach)/challenges/${challenge.id}`)}
            >
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  <Text style={styles.cardTitle}>{challenge.name}</Text>
                  {challenge.created_by === 'ai' && (
                    <View style={styles.aiTag}>
                      <Sparkles size={12} color="#6366f1" />
                      <Text style={styles.aiTagText}>AI</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.clientName}>👤 {challenge.client_name}</Text>
              </View>

              {challenge.description && (
                <Text style={styles.cardDescription} numberOfLines={2}>
                  {challenge.description}
                </Text>
              )}

              <View style={styles.cardMeta}>
                <View style={styles.metaItem}>
                  <Clock size={14} color="#666" />
                  <Text style={styles.metaText}>
                    {new Date(challenge.start_date).toLocaleDateString()} -{' '}
                    {new Date(challenge.end_date).toLocaleDateString()}
                  </Text>
                </View>
                <View style={styles.metaItem}>
                  <Text style={styles.metaText}>{challenge.duration_days} days</Text>
                </View>
              </View>

              <View style={styles.progressContainer}>
                <View style={styles.progressStats}>
                  <Text style={styles.progressText}>
                    {challenge.completed_subs} / {challenge.total_subs} tasks completed
                  </Text>
                  <Text style={styles.progressPercent}>{challenge.completion_rate}%</Text>
                </View>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${challenge.completion_rate}%` },
                    ]}
                  />
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9fafb' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#111' },
  headerActions: { flexDirection: 'row', gap: 8 },
  aiButton: { backgroundColor: '#6366f1', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  addButton: { backgroundColor: '#10b981', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  tabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#6366f1' },
  tabText: { fontSize: 14, fontWeight: '500', color: '#666' },
  tabTextActive: { color: '#6366f1', fontWeight: '600' },
  scrollView: { flex: 1 },
  emptyState: { alignItems: 'center', justifyContent: 'center', padding: 40, marginTop: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#666', marginTop: 16 },
  emptyDescription: { fontSize: 14, color: '#999', marginTop: 8, textAlign: 'center', lineHeight: 20 },
  challengeCard: { backgroundColor: '#fff', margin: 16, marginBottom: 0, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  cardHeader: { marginBottom: 12 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#111', flex: 1 },
  aiTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#ede9fe', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  aiTagText: { fontSize: 10, fontWeight: '600', color: '#6366f1' },
  clientName: { fontSize: 13, color: '#666' },
  cardDescription: { fontSize: 13, color: '#666', lineHeight: 18, marginBottom: 12 },
  cardMeta: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: '#666' },
  progressContainer: { paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  progressStats: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  progressText: { fontSize: 12, color: '#666' },
  progressPercent: { fontSize: 14, fontWeight: '600', color: '#6366f1' },
  progressBar: { height: 6, backgroundColor: '#e5e7eb', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#10b981', borderRadius: 3 },
});
