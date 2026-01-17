import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/BrandContext';
import { supabase } from '@/lib/supabase';
import { CheckIn, Habit, HabitLog } from '@/types/database';
import { Calendar, TrendingUp, Target, Heart } from 'lucide-react-native';
import { BrandedText } from '@/components/BrandedText';
import { BrandedCard } from '@/components/BrandedCard';

export default function ClientDashboard() {
  const router = useRouter();
  const { profile, client, loading: authLoading } = useAuth();
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [todayCheckIn, setTodayCheckIn] = useState<CheckIn | null>(null);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [todayHabitLogs, setTodayHabitLogs] = useState<HabitLog[]>([]);



  useEffect(() => {
    if (client) {
      loadDashboardData();
    } else if (!authLoading) {
      // If auth is done but no client, stop local loading to show empty state or error
      setLoading(false);
    }
  }, [client, authLoading]);

  const loadDashboardData = async () => {
    if (!client) return;

    try {
      const today = new Date().toISOString().split('T')[0];

      const [checkInResult, habitsResult, habitLogsResult] = await Promise.all([
        supabase
          .from('check_ins')
          .select('*')
          .eq('client_id', client.id)
          .eq('date', today)
          .maybeSingle(),
        supabase
          .from('habits')
          .select('*')
          .eq('client_id', client.id)
          .eq('is_active', true),
        supabase
          .from('habit_logs')
          .select('*')
          .eq('client_id', client.id)
          .eq('date', today),
      ]);

      setTodayCheckIn(checkInResult.data);
      setHabits(habitsResult.data || []);
      setTodayHabitLogs(habitLogsResult.data || []);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  const completedHabits = todayHabitLogs.filter((log) => log.completed).length;

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View 
        style={[
          styles.header, 
          { 
            backgroundColor: theme.colors.surface,
            borderBottomColor: theme.colors.border,
            paddingHorizontal: 24 * theme.spacing.scale,
            paddingTop: 60 * theme.spacing.scale,
            paddingBottom: 24 * theme.spacing.scale,
          }
        ]}
      >
        <BrandedText variant="xxl" weight="heading" style={styles.greeting}>
          Hello, {profile?.full_name}!
        </BrandedText>
        <BrandedText variant="sm" color="secondary">
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </BrandedText>
      </View>

      <View style={[styles.statsGrid, { padding: 16 * theme.spacing.scale, gap: 12 * theme.spacing.scale }]}>
        <BrandedCard style={styles.statCard} variant="elevated">
          <View 
            style={[
              styles.statIconContainer, 
              { backgroundColor: theme.colors.surfaceAlt }
            ]}
          >
            <Calendar size={24} color={theme.colors.primary} />
          </View>
          <BrandedText variant="xl" weight="heading" style={styles.statValue}>
            {todayCheckIn ? 'Done' : 'Pending'}
          </BrandedText>
          <BrandedText variant="xs" color="secondary" style={styles.statLabel}>
            Daily Check-in
          </BrandedText>
        </BrandedCard>

        <BrandedCard style={styles.statCard} variant="elevated">
          <View 
            style={[
              styles.statIconContainer, 
              { backgroundColor: theme.colors.surfaceAlt }
            ]}
          >
            <Target size={24} color={theme.colors.secondary} />
          </View>
          <BrandedText variant="xl" weight="heading" style={styles.statValue}>
            {completedHabits}/{habits.length}
          </BrandedText>
          <BrandedText variant="xs" color="secondary" style={styles.statLabel}>
            Habits
          </BrandedText>
        </BrandedCard>

        <BrandedCard style={styles.statCard} variant="elevated">
          <View 
            style={[
              styles.statIconContainer, 
              { backgroundColor: theme.colors.surfaceAlt }
            ]}
          >
            <TrendingUp size={24} color={theme.colors.accent} />
          </View>
          <BrandedText variant="xl" weight="heading" style={styles.statValue}>
            {todayCheckIn?.weight_kg || '--'}
          </BrandedText>
          <BrandedText variant="xs" color="secondary" style={styles.statLabel}>
            Weight (kg)
          </BrandedText>
        </BrandedCard>

        <BrandedCard style={styles.statCard} variant="elevated">
          <View 
            style={[
              styles.statIconContainer, 
              { backgroundColor: theme.colors.surfaceAlt }
            ]}
          >
            <Heart size={24} color={theme.colors.error} />
          </View>
          <BrandedText variant="xl" weight="heading" style={styles.statValue}>
            {todayCheckIn?.energy_level || '--'}/10
          </BrandedText>
          <BrandedText variant="xs" color="secondary" style={styles.statLabel}>
            Energy
          </BrandedText>
        </BrandedCard>
      </View>

      {!todayCheckIn && (
        <TouchableOpacity 
          style={[
            styles.checkInPrompt, 
            { 
              backgroundColor: theme.colors.primary,
              margin: 16 * theme.spacing.scale,
              padding: 20 * theme.spacing.scale,
            }
          ]}
        >
          <BrandedText variant="lg" weight="heading" style={styles.checkInPromptTitle}>
            Complete Your Daily Check-in
          </BrandedText>
          <Text style={[styles.checkInPromptText, { color: theme.colors.surface, opacity: 0.9 }]}>
            Track your progress and get personalized insights
          </Text>
        </TouchableOpacity>
      )}

      {todayCheckIn?.ai_analysis && (
        <BrandedCard 
          variant="elevated"
          style={{ margin: 16 * theme.spacing.scale, padding: 20 * theme.spacing.scale }}
        >
          <BrandedText variant="base" weight="heading" style={styles.aiInsightTitle}>
            Today's Insights
          </BrandedText>
          <BrandedText variant="sm" color="secondary" style={styles.aiInsightText}>
            {todayCheckIn.ai_analysis}
          </BrandedText>
        </BrandedCard>
      )}

      <View style={[styles.section, { padding: 16 * theme.spacing.scale }]}>
        <BrandedText variant="lg" weight="heading" style={styles.sectionTitle}>
          Quick Actions
        </BrandedText>
        <View style={[styles.actionGrid, { gap: 12 * theme.spacing.scale }]}>
          <TouchableOpacity 
            style={[
              styles.actionCard,
              { borderColor: theme.colors.border }
            ]}
            onPress={() => router.push('/(client)/log-meal')}
          >
            <BrandedCard variant="flat" style={styles.actionCardInner}>
              <BrandedText variant="sm" weight="heading" color="primary">
                Log Meal
              </BrandedText>
            </BrandedCard>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[
              styles.actionCard,
              { borderColor: theme.colors.border }
            ]}
            onPress={() => router.push('/(client)/challenges')}
          >
            <BrandedCard variant="flat" style={styles.actionCardInner}>
              <BrandedText variant="sm" weight="heading" color="primary">
                View Challenges
              </BrandedText>
            </BrandedCard>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    borderBottomWidth: 1,
  },
  greeting: {
    marginBottom: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    padding: 16,
    alignItems: 'center',
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    marginBottom: 4,
  },
  statLabel: {
    textAlign: 'center',
  },
  checkInPrompt: {
    borderRadius: 16,
  },
  checkInPromptTitle: {
    color: '#FFFFFF',
    marginBottom: 8,
  },
  checkInPromptText: {
    fontSize: 14,
  },
  aiInsightTitle: {
    marginBottom: 12,
  },
  aiInsightText: {
    lineHeight: 20,
  },
  section: {
  },
  sectionTitle: {
    marginBottom: 16,
  },
  actionGrid: {
    flexDirection: 'row',
  },
  actionCard: {
    flex: 1,
    borderRadius: 12,
  },
  actionCardInner: {
    padding: 20,
    alignItems: 'center',
  },
});
