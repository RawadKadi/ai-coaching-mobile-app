import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { CheckIn, Habit, HabitLog } from '@/types/database';
import { Calendar, TrendingUp, Target, Heart } from 'lucide-react-native';

export default function ClientDashboard() {
  const { profile, client } = useAuth();
  const [loading, setLoading] = useState(true);
  const [todayCheckIn, setTodayCheckIn] = useState<CheckIn | null>(null);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [todayHabitLogs, setTodayHabitLogs] = useState<HabitLog[]>([]);

  useEffect(() => {
    if (client) {
      loadDashboardData();
    }
  }, [client]);

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
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  const completedHabits = todayHabitLogs.filter((log) => log.completed).length;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Hello, {profile?.full_name}!</Text>
        <Text style={styles.date}>
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </Text>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <View style={styles.statIconContainer}>
            <Calendar size={24} color="#3B82F6" />
          </View>
          <Text style={styles.statValue}>
            {todayCheckIn ? 'Done' : 'Pending'}
          </Text>
          <Text style={styles.statLabel}>Daily Check-in</Text>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statIconContainer}>
            <Target size={24} color="#10B981" />
          </View>
          <Text style={styles.statValue}>
            {completedHabits}/{habits.length}
          </Text>
          <Text style={styles.statLabel}>Habits</Text>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statIconContainer}>
            <TrendingUp size={24} color="#F59E0B" />
          </View>
          <Text style={styles.statValue}>
            {todayCheckIn?.weight_kg || '--'}
          </Text>
          <Text style={styles.statLabel}>Weight (kg)</Text>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statIconContainer}>
            <Heart size={24} color="#EF4444" />
          </View>
          <Text style={styles.statValue}>
            {todayCheckIn?.energy_level || '--'}/10
          </Text>
          <Text style={styles.statLabel}>Energy</Text>
        </View>
      </View>

      {!todayCheckIn && (
        <TouchableOpacity style={styles.checkInPrompt}>
          <Text style={styles.checkInPromptTitle}>
            Complete Your Daily Check-in
          </Text>
          <Text style={styles.checkInPromptText}>
            Track your progress and get personalized insights
          </Text>
        </TouchableOpacity>
      )}

      {todayCheckIn?.ai_analysis && (
        <View style={styles.aiInsightCard}>
          <Text style={styles.aiInsightTitle}>Today's Insights</Text>
          <Text style={styles.aiInsightText}>{todayCheckIn.ai_analysis}</Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionGrid}>
          <TouchableOpacity style={styles.actionCard}>
            <Text style={styles.actionCardText}>Log Meal</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionCard}>
            <Text style={styles.actionCardText}>Log Workout</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  greeting: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  date: {
    fontSize: 14,
    color: '#6B7280',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  checkInPrompt: {
    backgroundColor: '#3B82F6',
    margin: 16,
    padding: 20,
    borderRadius: 16,
  },
  checkInPromptTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  checkInPromptText: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  aiInsightCard: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  aiInsightTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  aiInsightText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  actionGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  actionCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  actionCardText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
  },
});
