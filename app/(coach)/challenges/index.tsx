import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Challenge, ChallengeWithProgress, AISuggestion } from '@/types/database';
import { Target, Plus, TrendingUp, History, Sparkles } from 'lucide-react-native';

/**
 * Coach Challenges Dashboard
 * 
 * Three main tabs:
 * 1. Active Challenges - All active challenges across clients
 * 2. AI Suggestions - Pending suggestions awaiting approval
 * 3. History - Completed/cancelled challenges
 */

type TabType = 'active' | 'suggestions' | 'history';

export default function CoachChallengesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [activeTab, setActiveTab] = useState<TabType>('active');
  const [activeChallenges, setActiveChallenges] = useState<ChallengeWithProgress[]>([]);
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [historyChallenges, setHistoryChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      if (activeTab === 'active') {
        await loadActiveChallenges();
      } else if (activeTab === 'suggestions') {
        await loadSuggestions();
      } else {
        await loadHistory();
      }
    } catch (error) {
      console.error('Error loading challenges:', error);
      Alert.alert('Error', 'Failed to load challenges');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadActiveChallenges = async () => {
    const { data, error } = await supabase
      .from('challenges')
      .select(`
        *,
        progress:challenge_progress(*)
      `)
      .eq('coach_id', user!.id)
      .eq('status', 'active')
      .order('start_date', { ascending: false });

    if (error) throw error;
    setActiveChallenges(data || []);
  };

  const loadSuggestions = async () => {
    const { data, error } = await supabase
      .rpc('get_coach_challenge_suggestions', {
        p_coach_id: user!.id
      });

    if (error) throw error;
    setSuggestions(data || []);
  };

  const loadHistory = async () => {
    const { data, error } = await supabase
      .from('challenges')
      .select('*')
      .eq('coach_id', user!.id)
      .in('status', ['completed', 'cancelled'])
      .order('updated_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    setHistoryChallenges(data || []);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const navigateToCreate = () => {
    router.push('/(coach)/challenges/create');
  };

  const navigateToSuggest = () => {
    router.push('/(coach)/challenges/suggest');
  };

  const navigateToChallenge = (challengeId: string) => {
    router.push(`/(coach)/challenges/${challengeId}`);
  };

  const navigateToSuggestionDetail = (suggestionId: string) => {
    router.push(`/(coach)/challenges/suggestions/${suggestionId}`);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Challenges</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.aiButton}
            onPress={navigateToSuggest}
          >
            <Sparkles size={20} color="#fff" />
            <Text style={styles.aiButtonText}>AI Generate</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.createButton}
            onPress={navigateToCreate}
          >
            <Plus size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'active' && styles.activeTab]}
          onPress={() => setActiveTab('active')}
        >
          <Target size={20} color={activeTab === 'active' ? '#6366f1' : '#666'} />
          <Text style={[styles.tabText, activeTab === 'active' && styles.activeTabText]}>
            Active
          </Text>
          {activeChallenges.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{activeChallenges.length}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'suggestions' && styles.activeTab]}
          onPress={() => setActiveTab('suggestions')}
        >
          <TrendingUp size={20} color={activeTab === 'suggestions' ? '#6366f1' : '#666'} />
          <Text style={[styles.tabText, activeTab === 'suggestions' && styles.activeTabText]}>
            Suggestions
          </Text>
          {suggestions.length > 0 && (
            <View style={[styles.badge, styles.badgeWarning]}>
              <Text style={styles.badgeText}>{suggestions.length}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'history' && styles.activeTab]}
          onPress={() => setActiveTab('history')}
        >
          <History size={20} color={activeTab === 'history' ? '#6366f1' : '#666'} />
          <Text style={[styles.tabText, activeTab === 'history' && styles.activeTabText]}>
            History
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {activeTab === 'active' && (
          <FlatList
            data={activeChallenges}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <ActiveChallengeCard
                challenge={item}
                onPress={() => navigateToChallenge(item.id)}
              />
            )}
            ListEmptyComponent={
              <EmptyState
                icon={Target}
                title="No Active Challenges"
                description="Create a new challenge or use AI to generate one for your clients"
              />
            }
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
            }
          />
        )}

        {activeTab === 'suggestions' && (
          <FlatList
            data={suggestions}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <SuggestionCard
                suggestion={item}
                onPress={() => navigateToSuggestionDetail(item.id)}
              />
            )}
            ListEmptyComponent={
              <EmptyState
                icon={Sparkles}
                title="No AI Suggestions"
                description="AI suggestions appear here when clients need extra support"
              />
            }
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
            }
          />
        )}

        {activeTab === 'history' && (
          <FlatList
            data={historyChallenges}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <HistoryChallengeCard
                challenge={item}
                onPress={() => navigateToChallenge(item.id)}
              />
            )}
            ListEmptyComponent={
              <EmptyState
                icon={History}
                title="No Challenge History"
                description="Completed and cancelled challenges will appear here"
              />
            }
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
            }
          />
        )}
      </View>
    </View>
  );
}

// ============================
// SUBCOMPONENTS
// ============================

interface ActiveChallengeCardProps {
  challenge: ChallengeWithProgress;
  onPress: () => void;
}

function ActiveChallengeCard({ challenge, onPress }: ActiveChallengeCardProps) {
  const completedDays = challenge.progress?.filter(p => p.completed).length || 0;
  const completionRate = Math.round((completedDays / challenge.duration_days) * 100);

  const focusIcons: Record<string, any> = {
    training: '💪',
    nutrition: '🥗',
    recovery: '😴',
    consistency: '🎯',
  };

  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.cardHeader}>
        <Text style={styles.focusEmoji}>{focusIcons[challenge.focus_type]}</Text>
        <View style={styles.cardHeaderText}>
          <Text style={styles.cardTitle}>{challenge.name}</Text>
          <Text style={styles.cardSubtitle}>
            Client ID: {challenge.client_id.substring(0, 8)}...
          </Text>
        </View>
        {challenge.created_by === 'ai' && (
          <View style={styles.aiTag}>
            <Sparkles size={12} color="#6366f1" />
            <Text style={styles.aiTagText}>AI</Text>
          </View>
        )}
      </View>

      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${completionRate}%` }]} />
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.progressText}>
          {completedDays}/{challenge.duration_days} days • {completionRate}%
        </Text>
        <Text style={styles.daysLeft}>
          {challenge.duration_days - completedDays} days left
        </Text>
      </View>
    </TouchableOpacity>
  );
}

interface SuggestionCardProps {
  suggestion: AISuggestion;
  onPress: () => void;
}

function SuggestionCard({ suggestion }: SuggestionCardProps) {
  const payload = suggestion.challenge_payload;
  const priorityColors = {
    5: '#ef4444',
    4: '#f97316',
    3: '#eab308',
    2: '#22c55e',
    1: '#3b82f6',
  };

  return (
    <TouchableOpacity style={[styles.card, styles.suggestionCard]}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderText}>
          <Text style={styles.cardTitle}>{payload.name}</Text>
          <Text style={styles.cardSubtitle}>
            {suggestion.trigger_reason.replace(/_/g, ' ')}
          </Text>
        </View>
        <View 
          style={[
            styles.priorityBadge, 
            { backgroundColor: priorityColors[suggestion.priority as keyof typeof priorityColors] }
          ]}
        >
          <Text style={styles.priorityText}>P{suggestion.priority}</Text>
        </View>
      </View>

      <Text style={styles.suggestionDescription}>
        {payload.description}
      </Text>

      <View style={styles.suggestionFooter}>
        <Text style={styles.suggestionMeta}>
          {payload.duration_days} days • {payload.intensity}
        </Text>
        <Text style={styles.expiresText}>
          Expires: {new Date(suggestion.expires_at).toLocaleDateString()}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

interface HistoryChallengeCardProps {
  challenge: Challenge;
  onPress: () => void;
}

function HistoryChallengeCard({ challenge, onPress }: HistoryChallengeCardProps) {
  return (
    <TouchableOpacity style={[styles.card, styles.historyCard]} onPress={onPress}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderText}>
          <Text style={styles.cardTitle}>{challenge.name}</Text>
          <Text style={styles.cardSubtitle}>
            {challenge.focus_type} • {challenge.duration_days} days
          </Text>
        </View>
        <View style={[
          styles.statusBadge,
          challenge.status === 'completed' ? styles.completedBadge : styles.cancelledBadge
        ]}>
          <Text style={styles.statusText}>
            {challenge.status === 'completed' ? '✓ Completed' : '✗ Cancelled'}
          </Text>
        </View>
      </View>

      <Text style={styles.historyDate}>
        {new Date(challenge.start_date).toLocaleDateString()} - {new Date(challenge.end_date).toLocaleDateString()}
      </Text>
    </TouchableOpacity>
  );
}

interface EmptyStateProps {
  icon: any;
  title: string;
  description: string;
}

function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <View style={styles.emptyState}>
      <Icon size={48} color="#ccc" />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDescription}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  aiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366f1',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  aiButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  createButton: {
    backgroundColor: '#10b981',
    padding: 8,
    borderRadius: 8,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#6366f1',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#6366f1',
    fontWeight: '600',
  },
  badge: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  badgeWarning: {
    backgroundColor: '#f97316',
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  card: {
    backgroundColor: '#fff',
    margin: 12,
    marginBottom: 0,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  suggestionCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#6366f1',
  },
  historyCard: {
    opacity: 0.8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  focusEmoji: {
    fontSize: 24,
    marginRight: 8,
  },
  cardHeaderText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#666',
    textTransform: 'capitalize',
  },
  aiTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ede9fe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  aiTagText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6366f1',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#e5e7eb',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: 3,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  daysLeft: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '600',
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  priorityText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  suggestionDescription: {
    fontSize: 14,
    color: '#444',
    marginBottom: 12,
    lineHeight: 20,
  },
  suggestionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  suggestionMeta: {
    fontSize: 12,
    color: '#666',
    textTransform: 'capitalize',
  },
  expiresText: {
    fontSize: 11,
    color: '#f97316',
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  completedBadge: {
    backgroundColor: '#dcfce7',
  },
  cancelledBadge: {
    backgroundColor: '#fee2e2',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  historyDate: {
    fontSize: 12,
    color: '#666',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptyDescription: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
});
