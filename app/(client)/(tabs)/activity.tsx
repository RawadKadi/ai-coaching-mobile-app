import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Meal, Workout } from '@/types/database';
import { Utensils, Dumbbell, Calendar as CalendarIcon } from 'lucide-react-native';

export default function ActivityScreen() {
  const { client } = useAuth();
  const [loading, setLoading] = useState(true);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (client) {
      loadActivityData();
    }
  }, [client, selectedDate]);

  const loadActivityData = async () => {
    try {
      setLoading(true);
      const [mealsResult, workoutsResult] = await Promise.all([
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
      ]);

      if (mealsResult.error) throw mealsResult.error;
      if (workoutsResult.error) throw workoutsResult.error;

      setMeals(mealsResult.data || []);
      setWorkouts(workoutsResult.data || []);
    } catch (error) {
      console.error('Error loading activity:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalCalories = meals.reduce((sum, meal) => sum + (meal.calories || 0), 0);
  const totalWorkoutMinutes = workouts.reduce((sum, workout) => sum + (workout.duration_minutes || 0), 0);

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
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      ) : (
        <ScrollView style={styles.content}>
          <Text style={styles.sectionTitle}>Meals</Text>
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
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
});
