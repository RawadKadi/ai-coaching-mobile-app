
import { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, Alert, Modal, StatusBar, RefreshControl, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/BrandContext';
import { supabase } from '@/lib/supabase';
import { Meal, Workout, Habit, HabitLog } from '@/types/database';
import { 
  Utensils, 
  Dumbbell, 
  Calendar as CalendarIcon, 
  CheckCircle, 
  Circle, 
  Camera, 
  Zap, 
  ChevronRight, 
  Clock, 
  Target,
  Award,
  Sparkles,
  ArrowUpRight,
  ChevronDown,
  X
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ActivityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { client, profile } = useAuth();
  const theme = useTheme();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitLogs, setHabitLogs] = useState<HabitLog[]>([]);
  const [challenges, setChallenges] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedChallenge, setSelectedChallenge] = useState<any | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  useEffect(() => {
    if (client) {
      loadActivityData();
    }
  }, [client, selectedDate]);

  const loadActivityData = async () => {
    try {
      if (!refreshing) setLoading(true);
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

      // Initialize last reported status
      logs.forEach(log => {
        lastReportedStatus.current[log.habit_id] = log.completed;
      });
    } catch (error) {
      console.error('Error loading activity:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadActivityData();
  };

  const handleOpenDetails = (challenge: any) => {
    setSelectedChallenge(challenge);
    setShowDetailsModal(true);
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

  const toggleHabit = async (habit: Habit) => {
    try {
      if (habit.verification_type === 'camera') {
        const existingLog = habitLogs.find((log) => log.habit_id === habit.id);
        if (existingLog && existingLog.completed) {
           // Allow undo
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
        const lastStatus = lastReportedStatus.current[habit.id] ?? false; 
        
        if (newCompleted !== lastStatus) {
          sendCompletionMessage(habit.name, newCompleted, undefined, habit.description);
          lastReportedStatus.current[habit.id] = newCompleted;
        }
        
        delete timeoutRefs.current[habit.id];
      }, 5000);

    } catch (error) {
      console.error('Error toggling habit:', error);
    }
  };

  const totalCalories = meals.reduce((sum, meal) => sum + (meal.calories || 0), 0);
  const totalWorkoutMinutes = workouts.reduce((sum, workout) => sum + (workout.duration_minutes || 0), 0);
  const completedHabits = habitLogs.filter((log) => log.completed).length;

  const formattedDate = new Date(selectedDate).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  if (loading && !refreshing) {
    return (
      <View style={{ flex: 1, backgroundColor: '#020617', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#020617' }}>
      <StatusBar barStyle="light-content" translucent />
      
      <View style={{ flex: 1, paddingTop: insets.top }}>
        {/* Header Section */}
        <View style={{ paddingHorizontal: 24, paddingTop: 40, paddingBottom: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <View>
              <Text style={{ color: 'white', fontSize: 24, fontWeight: '900' }}>Your Progress</Text>
              <Text style={{ color: '#3b82f6', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 2, fontSize: 10, marginTop: 4 }}>{formattedDate}</Text>
            </View>
            <TouchableOpacity 
              style={{ width: 48, height: 48, backgroundColor: '#0f172a', borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#1e293b' }}
              onPress={() => {/* Date Picker functionality */}}
            >
              <CalendarIcon size={20} color="#3B82F6" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView 
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh} 
              tintColor="#3B82F6" 
            />
          }
        >
          {/* Summary Metric Grid */}
          <View style={{ paddingHorizontal: 24, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 16, marginBottom: 40 }}>
            <MetricCard 
              label="KCAL Burnt" 
              value={totalCalories.toString()} 
              icon={<Utensils size={18} color="#F59E0B" />} 
            />
            <MetricCard 
              label="Active Time" 
              value={`${totalWorkoutMinutes}m`} 
              icon={<Clock size={18} color="#10B981" />} 
            />
            <MetricCard 
              label="Habit Velocity" 
              value={`${completedHabits}/${habits.length}`} 
              icon={<Award size={18} color="#818CF8" />} 
            />
            <MetricCard 
              label="Rank Status" 
              value="Protocol-A" 
              icon={<Zap size={18} color="#3B82F6" />} 
            />
          </View>

          {/* Activity Logs Section */}
          <View style={{ paddingHorizontal: 24 }}>
            
            {/* Challenges Section */}
            <SectionHeader title="Active Challenges" count={challenges.length} />
            {challenges.length === 0 ? (
              <EmptyState message="No active challenges assigned." />
            ) : (
              <View style={{ gap: 12 }}>
                {challenges.map((challenge, idx) => (
                  <ActivityCard 
                    key={challenge.id}
                    title={challenge.name}
                    sub={challenge.focus_type}
                    completed={challenge.completed}
                    icon={<Target size={20} color={challenge.completed ? '#3B82F6' : '#94A3B8'} />}
                    onToggle={() => handleToggleChallenge(challenge)}
                    onPress={() => handleOpenDetails(challenge)}
                    delay={idx * 50}
                  />
                ))}
              </View>
            )}

            {/* Habits Section */}
            <SectionHeader title="Daily Protocols" count={habits.length} marginTop={32} />
            {habits.length === 0 ? (
              <EmptyState message="No habits established for this protocol." />
            ) : (
              <View style={{ gap: 12 }}>
                {habits.map((habit, idx) => {
                  const log = habitLogs.find(l => l.habit_id === habit.id);
                  const isCompleted = log?.completed || false;
                  return (
                    <ActivityCard 
                      key={habit.id}
                      title={habit.name}
                      sub={habit.verification_type === 'camera' ? 'Camera Verification Required' : 'Manual Toggle'}
                      completed={isCompleted}
                      icon={<CheckCircle size={20} color={isCompleted ? '#3B82F6' : '#94A3B8'} />}
                      onToggle={() => toggleHabit(habit)}
                      delay={idx * 50}
                    />
                  );
                })}
              </View>
            )}

            {/* Meals Section */}
            <SectionHeader title="Nutrition Intake" count={meals.length} marginTop={32} />
            {meals.length === 0 ? (
              <EmptyState message="No meals tracked for today." />
            ) : (
              <View style={{ gap: 12 }}>
                {meals.map((meal, idx) => (
                  <ActivityCard 
                    key={meal.id}
                    title={meal.name}
                    sub={`${meal.meal_type.toUpperCase()} • ${meal.calories} kcal`}
                    completed={true}
                    icon={<Utensils size={20} color="#F59E0B" />}
                    readOnly
                    delay={idx * 50}
                  />
                ))}
              </View>
            )}

            {/* Workouts Section */}
            <SectionHeader title="Performance Training" count={workouts.length} marginTop={32} />
            {workouts.length === 0 ? (
              <EmptyState message="No workouts recorded for today." />
            ) : (
              <View style={{ gap: 12 }}>
                {workouts.map((workout, idx) => (
                  <ActivityCard 
                    key={workout.id}
                    title={workout.name}
                    sub={`${workout.duration_minutes} MIN • ${workout.exercises?.length || 0} EXERCISES`}
                    completed={true}
                    icon={<Dumbbell size={20} color="#10B981" />}
                    readOnly
                    delay={idx * 50}
                  />
                ))}
              </View>
            )}

          </View>
        </ScrollView>
      </View>

      {/* Modern Details Overlay */}
        {showDetailsModal && selectedChallenge && (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, justifyContent: 'flex-end' }}>
            {/* Backdrop */}
            <TouchableOpacity 
              activeOpacity={1} 
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)' }} 
              onPress={() => setShowDetailsModal(false)} 
            />
            
            <View style={{ backgroundColor: '#0f172a', borderTopLeftRadius: 48, borderTopRightRadius: 48, padding: 32, borderTopWidth: 1, borderTopColor: '#1e293b', maxHeight: '85%', paddingBottom: insets.bottom + 32 }}>
              <View style={{ width: 48, height: 6, backgroundColor: '#1e293b', borderRadius: 3, alignSelf: 'center', marginBottom: 32 }} />
              
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 48, height: 48, backgroundColor: '#3b82f61a', borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#3b82f633' }}>
                    <Sparkles size={24} color="#3B82F6" />
                  </View>
                  <View>
                    <Text style={{ color: 'white', fontSize: 24, fontWeight: '900' }}>{selectedChallenge.name}</Text>
                    <Text style={{ color: '#475569', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5 }}>Global Protocol</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => setShowDetailsModal(false)} style={{ width: 40, height: 40, backgroundColor: '#020617', borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#1e293b' }}>
                  <X size={20} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 32 }}>
                  <Badge label={selectedChallenge.focus_type} />
                  {selectedChallenge.intensity && <Badge label={selectedChallenge.intensity} color="border-orange-500/20 text-orange-500 bg-orange-500/5" />}
                  <Badge label="Daily Objective" color="border-green-500/20 text-green-500 bg-green-500/5" />
                </View>

                <Text style={{ color: '#94a3b8', fontSize: 16, lineHeight: 28, fontWeight: '500', marginBottom: 40 }}>
                  {selectedChallenge.description || 'No detailed instructions provided for this challenge. Ensure you maintain proper form and stay hydrated.'}
                </Text>

                <TouchableOpacity 
                  style={{ 
                    padding: 24, 
                    borderRadius: 32, 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    flexDirection: 'row', 
                    gap: 12, 
                    backgroundColor: selectedChallenge.completed ? '#1e293b' : '#2563eb' 
                  }}
                  onPress={() => {
                    handleToggleChallenge(selectedChallenge);
                    setShowDetailsModal(false);
                  }}
                >
                  {selectedChallenge.completed ? (
                    <>
                      <X size={20} color="#94A3B8" />
                      <Text style={{ color: '#94a3b8', fontWeight: '900', textTransform: 'uppercase', letterSpacing: 2, fontSize: 14 }}>Remove Completion</Text>
                    </>
                  ) : (
                    <>
                      <CheckCircle size={20} color="white" />
                      <Text style={{ color: 'white', fontWeight: '900', textTransform: 'uppercase', letterSpacing: 2, fontSize: 14 }}>Confirm Completion</Text>
                    </>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        )}
    </View>
  );
}

// Support Components
const MetricCard = ({ label, value, icon }: any) => (
  <View style={{ width: '47%', backgroundColor: '#0f172a66', padding: 20, borderRadius: 36, borderWidth: 1, borderColor: '#1e293b', alignItems: 'center', justifyContent: 'center' }}>
    <View style={{ width: 40, height: 40, backgroundColor: '#020617', borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#1e293b', marginBottom: 12 }}>
      {icon}
    </View>
    <Text style={{ color: 'white', fontSize: 20, fontWeight: '900', letterSpacing: -0.5 }}>{value}</Text>
    <Text style={{ color: '#64748b', fontSize: 8, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 2, marginTop: 4 }}>{label}</Text>
  </View>
);

const SectionHeader = ({ title, count, marginTop = 0 }: any) => (
  <View style={{ marginTop, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingHorizontal: 4 }}>
    <Text style={{ color: 'white', fontSize: 20, fontWeight: '900', letterSpacing: -0.5 }}>{title}</Text>
    <View style={{ backgroundColor: '#0f172a', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: '#1e293b' }}>
      <Text style={{ color: '#64748b', fontSize: 10, fontWeight: 'bold' }}>{count}</Text>
    </View>
  </View>
);

const ActivityCard = ({ title, sub, completed, icon, onToggle, onPress, readOnly, delay = 0 }: any) => (
  <View style={{ marginBottom: 12 }}>
    <TouchableOpacity 
      activeOpacity={0.7}
      disabled={!onPress}
      onPress={onPress}
      style={{ 
        flexDirection: 'row', 
        alignItems: 'center', 
        padding: 20, 
        backgroundColor: '#0f172a66', 
        borderRadius: 32, 
        borderWidth: 1, 
        borderColor: completed ? '#3b82f633' : '#1e293b' 
      }}
    >
      <View style={{ width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 16, borderWidth: 1, backgroundColor: completed ? '#3b82f61a' : '#020617', borderColor: completed ? '#3b82f633' : '#1e293b' }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>{icon}</View>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: 'bold', color: completed ? 'white' : '#cbd5e1' }}>{title}</Text>
        <Text style={{ color: '#64748b', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 4 }}>{sub}</Text>
      </View>
      {!readOnly && (
        <TouchableOpacity 
          onPress={() => {
            onToggle && onToggle();
          }}
          style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, backgroundColor: completed ? '#2563eb' : '#020617', borderColor: completed ? '#3b82f6' : '#1e293b' }}
        >
          {completed ? <CheckCircle size={20} color="white" /> : <Circle size={20} color="#475569" />}
        </TouchableOpacity>
      )}
      {readOnly && (
        <ArrowUpRight size={18} color="#475569" />
      )}
    </TouchableOpacity>
  </View>
);

const EmptyState = ({ message }: { message: string }) => (
  <View style={{ padding: 32, backgroundColor: '#0f172a33', borderRadius: 32, borderWidth: 1, borderColor: '#1e293b', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' }}>
    <Text style={{ color: '#475569', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5, textAlign: 'center' }}>{message}</Text>
  </View>
);

const Badge = ({ label, color = "#3b82f6" }: any) => {
  const isCustom = color !== "#3b82f6";
  return (
    <View style={{ 
        paddingHorizontal: 16, 
        paddingVertical: 8, 
        borderRadius: 999, 
        borderWidth: 1, 
        borderColor: isCustom ? 'rgba(249, 115, 22, 0.2)' : 'rgba(59, 130, 246, 0.2)',
        backgroundColor: isCustom ? 'rgba(249, 115, 22, 0.05)' : 'rgba(59, 130, 246, 0.05)'
    }}>
      <Text style={{ color: isCustom ? '#f97316' : '#3b82f6', fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5 }}>{label}</Text>
    </View>
  );
};
