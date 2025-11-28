import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Meal, Workout, Habit, HabitLog } from '@/types/database';
import { Utensils, Dumbbell, Calendar as CalendarIcon, CheckCircle, Circle } from 'lucide-react-native';

export default function ActivityScreen() {
  const { client } = useAuth();
  const [loading, setLoading] = useState(true);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitLogs, setHabitLogs] = useState<HabitLog[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (client) {
      loadActivityData();
    }
  }, [client, selectedDate]);

  const loadActivityData = async () => {
    try {
      setLoading(true);
      const [mealsResult, workoutsResult, habitsResult, logsResult] = await Promise.all([
        supabase
          .from('meals')
          .select('*')
          .eq('client_id', client?.id)
          .eq('date', selectedDate)
          .order('created_at', { ascending: false }),
        supabase
          .from('workouts')
          .select('*')
          .eq('client_id', client?.id)
          .eq('date', selectedDate)
          .order('created_at', { ascending: false }),
        supabase
          .from('habits')
          .select('*')
          .eq('client_id', client?.id)
          .eq('is_active', true),
        supabase
          .from('habit_logs')
          .select('*')
          .eq('client_id', client?.id)
          .eq('date', selectedDate),
      ]);

      if (mealsResult.error) throw mealsResult.error;
      if (workoutsResult.error) throw workoutsResult.error;
      if (habitsResult.error) throw habitsResult.error;
      if (logsResult.error) throw logsResult.error;

      setMeals(mealsResult.data || []);
      setWorkouts(workoutsResult.data || []);
      setHabits(habitsResult.data || []);
      setHabitLogs(logsResult.data || []);
    } catch (error) {
      console.error('Error loading activity:', error);
    } finally {
      setLoading(false);
    }
  };

  const timeoutRefs = useRef<{ [key: string]: any }>({});

  useEffect(() => {
    return () => {
      Object.values(timeoutRefs.current).forEach((timeout) => clearTimeout(timeout));
    };
  }, []);

  const sendCompletionMessage = async (habitName: string) => {
    try {
      const { data: linkData, error: linkError } = await supabase
        .from('coach_client_links')
        .select('coach_id')
        .eq('client_id', client?.id)
        .eq('status', 'active')
        .single();

      if (linkError || !linkData) return;

      const { data: coachData, error: coachError } = await supabase
        .from('coaches')
        .select('user_id')
        .eq('id', linkData.coach_id)
        .single();

      if (coachError || !coachData) return;

      await supabase.from('messages').insert({
        sender_id: client?.user_id,
        recipient_id: coachData.user_id,
        content: `Finished this task: ${habitName}`,
        read: false,
        ai_generated: false,
      });
    } catch (error) {
      console.error('Error sending automated message:', error);
    }
  };

  const toggleChallenge = async (habit: Habit) => {
    try {
      if (habit.verification_type === 'camera') {
        Alert.alert('Photo Required', 'Camera feature coming soon!');
        return;
      }

      const today = new Date().toISOString().split('T')[0];
      const existingLog = habitLogs.find((log) => log.habit_id === habit.id);

      if (timeoutRefs.current[habit.id]) {
        clearTimeout(timeoutRefs.current[habit.id]);
        delete timeoutRefs.current[habit.id];
      }

      if (existingLog) {
        const newCompleted = !existingLog.completed;
        const { data, error } = await supabase
          .from('habit_logs')
          .update({ completed: newCompleted })
          .eq('id', existingLog.id)
          .select()
          .single();

        if (error) throw error;
        setHabitLogs(habitLogs.map((log) => (log.id === existingLog.id ? data : log)));

        if (newCompleted) {
          timeoutRefs.current[habit.id] = setTimeout(() => {
            sendCompletionMessage(habit.name);
            delete timeoutRefs.current[habit.id];
          }, 10000);
        }
      } else {
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
        setHabitLogs([...habitLogs, data]);

        timeoutRefs.current[habit.id] = setTimeout(() => {
          sendCompletionMessage(habit.name);
          delete timeoutRefs.current[habit.id];
        }, 10000);
      }
    } catch (error) {
      console.error('Error toggling challenge:', error);
    }
  };

  const totalCalories = meals.reduce((sum, meal) => sum + (meal.calories || 0), 0);
  const totalWorkoutMinutes = workouts.reduce((sum, workout) => sum + (workout.duration_minutes || 0), 0);
  const completedHabits = habitLogs.filter((log) => log.completed).length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Activity</Text>
        <Text style={styles.date}>
          {new Date(selectedDate).toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </Text>
      </View>

      <View style={styles.summaryContainer}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{totalCalories}</Text>
          <Text style={styles.summaryLabel}>Calories</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{totalWorkoutMinutes}m</Text>
          <Text style={styles.summaryLabel}>Active Time</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{completedHabits}/{habits.length}</Text>
          <Text style={styles.summaryLabel}>Habits</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      ) : (
        <ScrollView style={styles.content}>
          <Text style={styles.sectionTitle}>Challenges</Text>
          {habits.length === 0 ? (
            <Text style={styles.emptyText}>No active challenges</Text>
          ) : (
            habits.map((habit) => {
              const log = habitLogs.find((l) => l.habit_id === habit.id);
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

          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Meals</Text>
          {meals.length === 0 ? (
            <Text style={styles.emptyText}>No meals logged today</Text>
          ) : (
            meals.map((meal) => (
              <View key={meal.id} style={styles.card}>
                <View style={styles.iconContainer}>
                  <Utensils size={20} color="#F59E0B" />
                </View>
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>{meal.name}</Text>
                  <Text style={styles.cardSubtitle}>
                    {meal.meal_type.charAt(0).toUpperCase() + meal.meal_type.slice(1)} • {meal.calories} kcal
                  </Text>
                </View>
              </View>
            ))
          )}

          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Workouts</Text>
          {workouts.length === 0 ? (
            <Text style={styles.emptyText}>No workouts logged today</Text>
          ) : (
            workouts.map((workout) => (
              <View key={workout.id} style={styles.card}>
                <View style={[styles.iconContainer, { backgroundColor: '#ECFDF5' }]}>
                  <Dumbbell size={20} color="#10B981" />
                </View>
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>{workout.name}</Text>
                  <Text style={styles.cardSubtitle}>
                    {workout.duration_minutes} min • {workout.exercises?.length || 0} exercises
                  </Text>
                </View>
              </View>
            ))
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
    backgroundColor: '#FFFFFF',
    padding: 24,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },
  date: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  summaryContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6B7280',
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  emptyText: {
    color: '#9CA3AF',
    fontStyle: 'italic',
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
  },
  cardCompleted: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFBEB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
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
