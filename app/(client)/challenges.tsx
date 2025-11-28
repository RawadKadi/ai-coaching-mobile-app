import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Habit, HabitLog } from '@/types/database';
import { CheckCircle, Circle, ArrowLeft, Trophy } from 'lucide-react-native';

export default function ChallengesScreen() {
  const router = useRouter();
  const { client } = useAuth();
  const [loading, setLoading] = useState(true);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [todayLogs, setTodayLogs] = useState<HabitLog[]>([]);

  useEffect(() => {
    if (client) {
      loadChallenges();
    } else {
      // If client is null, stop loading to show empty state
      setLoading(false);
    }
  }, [client]);

  const loadChallenges = async () => {
    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];

      const [habitsResult, logsResult] = await Promise.all([
        supabase
          .from('habits')
          .select('*')
          .eq('client_id', client?.id)
          .eq('is_active', true),
        supabase
          .from('habit_logs')
          .select('*')
          .eq('client_id', client?.id)
          .eq('date', today),
      ]);

      if (habitsResult.error) throw habitsResult.error;
      if (logsResult.error) throw logsResult.error;

      setHabits(habitsResult.data || []);
      setTodayLogs(logsResult.data || []);
    } catch (error) {
      console.error('Error loading challenges:', error);
    } finally {
      setLoading(false);
    }
  };

  const timeoutRefs = useRef<{ [key: string]: any }>({});

  useEffect(() => {
    return () => {
      // Clear all timeouts on unmount
      Object.values(timeoutRefs.current).forEach((timeout) => clearTimeout(timeout));
    };
  }, []);

  const sendCompletionMessage = async (habitName: string) => {
    try {
      // Get the coach ID for this client
      // We need to find the active coach link first
      const { data: linkData, error: linkError } = await supabase
        .from('coach_client_links')
        .select('coach_id')
        .eq('client_id', client?.id)
        .eq('status', 'active')
        .single();

      if (linkError || !linkData) {
        console.log('No active coach found to message');
        return;
      }

      // Get coach's user_id (profile id) to send message to
      const { data: coachData, error: coachError } = await supabase
        .from('coaches')
        .select('user_id')
        .eq('id', linkData.coach_id)
        .single();

      if (coachError || !coachData) return;

      const { error } = await supabase
        .from('messages')
        .insert({
          sender_id: client?.user_id, // client's profile id
          recipient_id: coachData.user_id,
          content: `Finished this task: ${habitName}`,
          read: false,
          ai_generated: false,
        });

      if (error) throw error;
      console.log('Automated message sent for:', habitName);
    } catch (error) {
      console.error('Error sending automated message:', error);
    }
  };

  const toggleChallenge = async (habit: Habit) => {
    try {
      if (habit.verification_type === 'camera') {
        // TODO: Implement Camera Logic
        Alert.alert('Photo Required', 'This challenge requires a photo verification. Camera feature coming soon!');
        return;
      }

      const today = new Date().toISOString().split('T')[0];
      const existingLog = todayLogs.find((log) => log.habit_id === habit.id);

      // Clear existing timeout if any
      if (timeoutRefs.current[habit.id]) {
        clearTimeout(timeoutRefs.current[habit.id]);
        delete timeoutRefs.current[habit.id];
      }

      if (existingLog) {
        // Toggle completion
        const newCompleted = !existingLog.completed;
        const { data, error } = await supabase
          .from('habit_logs')
          .update({ completed: newCompleted })
          .eq('id', existingLog.id)
          .select()
          .single();

        if (error) throw error;
        setTodayLogs(todayLogs.map((log) => (log.id === existingLog.id ? data : log)));

        // If marked as completed, schedule message
        if (newCompleted) {
          timeoutRefs.current[habit.id] = setTimeout(() => {
            sendCompletionMessage(habit.name);
            delete timeoutRefs.current[habit.id];
          }, 10000); // 10 seconds
        }
      } else {
        // Create new log (completed by default)
        const { data, error } = await supabase
          .from('habit_logs')
          .insert({
            client_id: client?.id,
            habit_id: habit.id,
            date: today,
            completed: true,
          })
          .select()
          .single();

        if (error) throw error;
        setTodayLogs([...todayLogs, data]);

        // Schedule message
        timeoutRefs.current[habit.id] = setTimeout(() => {
          sendCompletionMessage(habit.name);
          delete timeoutRefs.current[habit.id];
        }, 10000); // 10 seconds
      }
    } catch (error) {
      console.error('Error toggling challenge:', error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>Daily Challenges</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      ) : (
        <ScrollView style={styles.content}>
          <View style={styles.banner}>
            <Trophy size={32} color="#F59E0B" />
            <View style={styles.bannerTextContainer}>
              <Text style={styles.bannerTitle}>Keep the Streak!</Text>
              <Text style={styles.bannerSubtitle}>Complete your daily challenges to build consistency.</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Today's List</Text>
          
          {habits.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No active challenges set by your coach yet.</Text>
            </View>
          ) : (
            habits.map((habit) => {
              const log = todayLogs.find((l) => l.habit_id === habit.id);
              const isCompleted = log?.completed || false;

              return (
                <TouchableOpacity
                  key={habit.id}
                  style={[styles.card, isCompleted && styles.cardCompleted]}
                  onPress={() => toggleChallenge(habit)}
                >
                  <View style={styles.cardContent}>
                    <Text style={[styles.cardTitle, isCompleted && styles.textCompleted]}>
                      {habit.name}
                    </Text>
                    {habit.description && (
                      <Text style={styles.cardSubtitle}>{habit.description}</Text>
                    )}
                  </View>
                  {isCompleted ? (
                    <CheckCircle size={24} color="#10B981" />
                  ) : (
                    <Circle size={24} color="#D1D5DB" />
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 24,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  banner: {
    flexDirection: 'row',
    backgroundColor: '#FFFBEB',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  bannerTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#92400E',
  },
  bannerSubtitle: {
    fontSize: 14,
    color: '#B45309',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  emptyState: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    color: '#6B7280',
    textAlign: 'center',
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    justifyContent: 'space-between',
  },
  cardCompleted: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  cardContent: {
    flex: 1,
    marginRight: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  textCompleted: {
    textDecorationLine: 'line-through',
    color: '#059669',
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
});
