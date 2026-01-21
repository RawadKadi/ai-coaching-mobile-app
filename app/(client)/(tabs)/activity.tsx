
import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/BrandContext';
import { supabase } from '@/lib/supabase';
import { Meal, Workout, Habit, HabitLog } from '@/types/database';
import { Utensils, Dumbbell, Calendar as CalendarIcon, CheckCircle, Circle, Camera } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';

export default function ActivityScreen() {
  const router = useRouter();
  const { client } = useAuth();
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitLogs, setHabitLogs] = useState<HabitLog[]>([]);
  const [challenges, setChallenges] = useState<any[]>([]);
  const [challengeProgress, setChallengeProgress] = useState<any[]>([]);
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
          .eq('meal_date', selectedDate)
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
      const logs = logsResult.data || [];
      setHabitLogs(logs);
      // Get sub-challenges via RPC
      const { data: subsData, error: subsError } = await supabase.rpc('get_todays_sub_challenges', {
        p_client_id: client?.id,
        p_date: selectedDate
      });

      if (subsError) {
        console.error('Error loading challenges:', subsError);
      }

      setChallenges(subsData || []);
      setChallengeProgress([]);

      // Initialize last reported status
      logs.forEach(log => {
        lastReportedStatus.current[log.habit_id] = log.completed;
      });
    } catch (error) {
      console.error('Error loading activity:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleChallenge = async (challenge: any) => {
    try {
      const newCompleted = !challenge.completed;

      // Optimistic update
      setChallenges((prev) =>
        prev.map((c) => (c.id === challenge.id ? { ...c, completed: newCompleted } : c))
      );

      // Update via RPC
      const { error } = await supabase.rpc('mark_sub_challenge', {
        p_sub_challenge_id: challenge.id,
        p_client_id: client?.id,
        p_completed: newCompleted,
      });

      if (error) throw error;

      // Send auto-message to coach if completed
      if (newCompleted) {
        const { data: motherData } = await supabase
          .from('mother_challenges')
          .select('coach_id')
          .eq('id', challenge.mother_challenge_id)
          .single();

        if (motherData?.coach_id) {
          const { data: coachData } = await supabase
            .from('coaches')
            .select('user_id')
            .eq('id', motherData.coach_id)
            .single();

          if (coachData?.user_id) {
            await supabase.from('messages').insert({
              sender_id: client!.user_id,
              recipient_id: coachData.user_id,
              content: JSON.stringify({
                type: 'challenge_completed',
                title: 'Client finished this task',
                taskName: challenge.name,
                taskDescription: challenge.description || '',
                completedAt: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
                focusType: challenge.focus_type,
                intensity: challenge.intensity,
              }),
              ai_generated: true,
              message_type: 'system',
            });
          }
        }
      }
    } catch (error: any) {
      console.error('Error toggling challenge:', error);
      Alert.alert('Error', 'Failed to update challenge');
      loadActivityData();
    }
  };

  const timeoutRefs = useRef<{ [key: string]: any }>({});
  const lastReportedStatus = useRef<{ [key: string]: boolean }>({});

  useEffect(() => {
    return () => {
      Object.values(timeoutRefs.current).forEach((timeout) => clearTimeout(timeout));
    };
  }, []);



  const sendCompletionMessage = async (habitName: string, isCompletion: boolean, imageUrl?: string, description?: string) => {
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

      const messageContent = JSON.stringify({
        type: 'task_completion',
        taskName: habitName,
        isCompletion: isCompletion,
        clientName: (client as any)?.profiles?.full_name || 'Client',
        imageUrl: imageUrl || null,
        description: description || '',
        timestamp: new Date().toISOString(),
      });

      const { data, error } = await supabase
        .from('messages')
        .insert({
          sender_id: client?.user_id,
          recipient_id: coachData.user_id,
          content: messageContent,
          read: false,
          ai_generated: false,
        })
        .select()
        .single();

      if (error) throw error;
      console.log('[Activity] Task completion message sent:', data);
      return data;
    } catch (error) {
      console.error('Error sending automated message:', error);
      return null;
    }
  };

  const handleCameraVerification = async (habit: Habit) => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('Permission Required', 'You need to allow camera access to verify this challenge.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        const fileExt = 'jpg';
        const fileName = `${client?.id}/${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('habit-verifications')
          .upload(filePath, decode(result.assets[0].base64), {
            contentType: 'image/jpeg',
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('habit-verifications')
          .getPublicUrl(filePath);

        const today = new Date().toISOString().split('T')[0];
        const { data, error } = await supabase
          .from('habit_logs')
          .insert({
            client_id: client?.id,
            habit_id: habit.id,
            date: today,
            completed: true,
            image_url: publicUrl,
          })
          .select()
          .single();

        if (error) throw error;
        setHabitLogs([...habitLogs, data]);

        sendCompletionMessage(habit.name, true, publicUrl, habit.description);
      }
    } catch (error) {
      console.error('Error in camera verification:', error);
      Alert.alert('Error', 'Failed to verify challenge with camera');
    }
  };

  const toggleChallenge = async (habit: Habit) => {
    try {
      if (habit.verification_type === 'camera') {
        const existingLog = habitLogs.find((log) => log.habit_id === habit.id);
        if (existingLog && existingLog.completed) {
           // allow undo
        } else {
           await handleCameraVerification(habit);
           return;
        }
      }

      const today = new Date().toISOString().split('T')[0];
      const existingLog = habitLogs.find((log) => log.habit_id === habit.id);

      if (timeoutRefs.current[habit.id]) {
        clearTimeout(timeoutRefs.current[habit.id]);
        delete timeoutRefs.current[habit.id];
      }

      let newCompleted = true;

      if (existingLog) {
        newCompleted = !existingLog.completed;
        const { data, error } = await supabase
          .from('habit_logs')
          .update({ completed: newCompleted })
          .eq('id', existingLog.id)
          .select()
          .single();

        if (error) throw error;
        setHabitLogs(habitLogs.map((log) => (log.id === existingLog.id ? data : log)));
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
      }

      // Schedule message check
      timeoutRefs.current[habit.id] = setTimeout(() => {
        // Check if the current status is different from the last reported status
        const lastStatus = lastReportedStatus.current[habit.id] ?? false; 
        
        if (newCompleted !== lastStatus) {
          sendCompletionMessage(habit.name, newCompleted, undefined, habit.description);
          lastReportedStatus.current[habit.id] = newCompleted;
        }
        
        delete timeoutRefs.current[habit.id];
      }, 5000); // 5 seconds

    } catch (error) {
      console.error('Error toggling challenge:', error);
    }
  };

  const totalCalories = meals.reduce((sum, meal) => sum + (meal.calories || 0), 0);
  const totalWorkoutMinutes = workouts.reduce((sum, workout) => sum + (workout.duration_minutes || 0), 0);
  const completedHabits = habitLogs.filter((log) => log.completed).length;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Activity</Text>
        <Text style={styles.date}>
          {new Date(selectedDate).toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </Text>
      </View>

      <View style={styles.summaryContainer}>
        <View style={[styles.summaryCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.summaryValue, { color: theme.colors.text }]}>{totalCalories}</Text>
          <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>Calories</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.summaryValue, { color: theme.colors.text }]}>{totalWorkoutMinutes}m</Text>
          <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>Active Time</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.summaryValue, { color: theme.colors.text }]}>{completedHabits}/{habits.length}</Text>
          <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>Habits</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <ScrollView style={styles.content}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Challenges</Text>
          {challenges.length === 0 ? (
            <Text style={styles.emptyText}>No active challenges</Text>
          ) : (
            challenges.map((challenge) => {
              const isCompleted = challenge.completed || false;

              return (
                <TouchableOpacity
                  key={challenge.id}
                  style={[
                    styles.card,
                    { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                    isCompleted && { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.primary }
                  ]}
                  onPress={() => handleToggleChallenge(challenge)}
                >
                  <View style={styles.cardContent}>
                    <View style={styles.challengeHeader}>
                      <Text style={[styles.cardTitle, { color: theme.colors.text }, isCompleted && { color: theme.colors.primary, textDecorationLine: 'line-through' }]}>
                        {challenge.name}
                      </Text>
                      <Text style={styles.challengeBadge}>
                        {challenge.focus_type}
                      </Text>
                    </View>
                    {challenge.description && (
                      <Text style={[styles.cardSubtitle, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                        {challenge.description}
                      </Text>
                    )}
                  </View>
                  {isCompleted ? (
                    <CheckCircle size={24} color="#10B981" />
                  ) : (
                    <Circle size={24} color="#6366f1" />
                  )}
                </TouchableOpacity>
              );
            })
          )}

          <Text style={[styles.sectionTitle, { marginTop: 24, color: theme.colors.text }]}>Meals</Text>
          {meals.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.colors.textTertiary }]}>No meals logged today</Text>
          ) : (
            meals.map((meal) => (
              <View key={meal.id} style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <View style={styles.iconContainer}>
                  <Utensils size={20} color="#F59E0B" />
                </View>
                <View style={styles.cardContent}>
                  <Text style={[styles.cardTitle, { color: theme.colors.text }]}>{meal.name}</Text>
                  <Text style={[styles.cardSubtitle, { color: theme.colors.textSecondary }]}>
                    {meal.meal_type.charAt(0).toUpperCase() + meal.meal_type.slice(1)} • {meal.calories} kcal
                  </Text>
                </View>
              </View>
            ))
          )}

          <Text style={[styles.sectionTitle, { marginTop: 24, color: theme.colors.text }]}>Workouts</Text>
          {workouts.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.colors.textTertiary }]}>No workouts logged today</Text>
          ) : (
            workouts.map((workout) => (
              <View key={workout.id} style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <View style={[styles.iconContainer, { backgroundColor: '#ECFDF5' }]}>
                  <Dumbbell size={20} color="#10B981" />
                </View>
                <View style={styles.cardContent}>
                  <Text style={[styles.cardTitle, { color: theme.colors.text }]}>{workout.name}</Text>
                  <Text style={[styles.cardSubtitle, { color: theme.colors.textSecondary }]}>
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
  },
  header: {
    padding: 24,
    paddingTop: 60,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
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
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
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
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 1,
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
  challengeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  challengeBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6366f1',
    backgroundColor: '#ede9fe',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  challengeProgressBar: {
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    marginTop: 8,
    overflow: 'hidden',
  },
  challengeProgressFill: {
    height: '100%',
    backgroundColor: '#6366f1',
    borderRadius: 2,
  },
});
