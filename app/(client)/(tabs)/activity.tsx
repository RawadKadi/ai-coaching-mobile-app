
import { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, Alert, Modal, StatusBar, RefreshControl, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { MotiView, AnimatePresence } from 'moti';
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
      <View className="flex-1 bg-slate-950 justify-center items-center">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-950">
      <StatusBar barStyle="light-content" translucent />
      
      <View style={{ flex: 1, paddingTop: insets.top }}>
        {/* Header Section */}
        <MotiView 
          from={{ opacity: 0, translateY: -10 }}
          animate={{ opacity: 1, translateY: 0 }}
          className="px-6 pt-10 pb-6"
        >
          <View className="flex-row items-center justify-between mb-2">
            <View>
              <Text className="text-white text-3xl font-black tracking-tighter">Your Progress</Text>
              <Text className="text-blue-500 font-bold uppercase tracking-[2px] text-[10px] mt-1">{formattedDate}</Text>
            </View>
            <TouchableOpacity 
              className="w-12 h-12 bg-slate-900 rounded-2xl items-center justify-center border border-white/5"
              onPress={() => {/* Date Picker functionality */}}
            >
              <CalendarIcon size={20} color="#3B82F6" />
            </TouchableOpacity>
          </View>
        </MotiView>

        <ScrollView 
          className="flex-1" 
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
          <MotiView 
            from={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'timing', duration: 400, delay: 100 }}
            className="px-6 flex-row flex-wrap justify-between gap-y-4 mb-10"
          >
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
          </MotiView>

          {/* Activity Logs Section */}
          <View className="px-6">
            
            {/* Challenges Section */}
            <SectionHeader title="Active Challenges" count={challenges.length} />
            {challenges.length === 0 ? (
              <EmptyState message="No active challenges assigned." />
            ) : (
              <View className="gap-3">
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
              <View className="gap-3">
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
              <View className="gap-3">
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
              <View className="gap-3">
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

      {/* Modern Details Overlay (Replaces Modal to fix context issues) */}
      <AnimatePresence>
        {showDetailsModal && selectedChallenge && (
          <MotiView
            from={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[100] flex-1 justify-end"
            pointerEvents={showDetailsModal ? 'auto' : 'none'}
          >
            {/* Backdrop */}
            <TouchableOpacity 
              activeOpacity={1} 
              className="absolute inset-0 bg-black/60" 
              onPress={() => setShowDetailsModal(false)} 
            />
            
            <MotiView
              from={{ translateY: 600 }}
              animate={{ translateY: 0 }}
              exit={{ translateY: 600 }}
              transition={{
                type: 'spring',
                damping: 25,
                stiffness: 200,
              }}
              className="bg-slate-900 rounded-t-[48px] p-8 border-t border-white/10"
              style={{ maxHeight: '85%', paddingBottom: insets.bottom + 32 }}
            >
              <View className="w-12 h-1.5 bg-slate-800 rounded-full self-center mb-8" />
              
              <View className="flex-row items-center justify-between mb-8">
                <View className="flex-row items-center gap-3">
                  <View className="w-12 h-12 bg-blue-600/10 rounded-2xl items-center justify-center border border-blue-600/20">
                    <Sparkles size={24} color="#3B82F6" />
                  </View>
                  <View>
                    <Text className="text-white text-2xl font-black tracking-tight">{selectedChallenge.name}</Text>
                    <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Global Protocol</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => setShowDetailsModal(false)} className="w-10 h-10 bg-slate-950 rounded-full items-center justify-center border border-white/5">
                  <X size={20} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} className="mb-0">
                <View className="flex-row flex-wrap gap-2 mb-8">
                  <Badge label={selectedChallenge.focus_type} />
                  {selectedChallenge.intensity && <Badge label={selectedChallenge.intensity} color="border-orange-500/20 text-orange-500 bg-orange-500/5" />}
                  <Badge label="Daily Objective" color="border-green-500/20 text-green-500 bg-green-500/5" />
                </View>

                <Text className="text-slate-400 text-base leading-7 font-medium mb-10">
                  {selectedChallenge.description || 'No detailed instructions provided for this challenge. Ensure you maintain proper form and stay hydrated.'}
                </Text>

                <TouchableOpacity 
                  className={`p-6 rounded-[32px] items-center justify-center flex-row gap-3 ${selectedChallenge.completed ? 'bg-slate-800' : 'bg-blue-600 shadow-2xl shadow-blue-500/40'}`}
                  onPress={() => {
                    handleToggleChallenge(selectedChallenge);
                    setShowDetailsModal(false);
                  }}
                >
                  {selectedChallenge.completed ? (
                    <>
                      <X size={20} color="#94A3B8" />
                      <Text className="text-slate-400 font-black uppercase tracking-[2px] text-sm">Remove Completion</Text>
                    </>
                  ) : (
                    <>
                      <CheckCircle size={20} color="white" />
                      <Text className="text-white font-black uppercase tracking-[2px] text-sm">Confirm Completion</Text>
                    </>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </MotiView>
          </MotiView>
        )}
      </AnimatePresence>
    </View>
  );
}

// Support Components
const MetricCard = ({ label, value, icon }: any) => (
  <View className="w-[47%] bg-slate-900/40 p-5 rounded-[36px] border border-white/5 items-center justify-center">
    <View className="w-10 h-10 bg-slate-950 rounded-xl items-center justify-center border border-white/5 mb-3">
      {icon}
    </View>
    <Text className="text-white text-xl font-black tracking-tighter">{value}</Text>
    <Text className="text-slate-500 text-[8px] font-black uppercase tracking-[2px] mt-1">{label}</Text>
  </View>
);

const SectionHeader = ({ title, count, marginTop = 0 }: any) => (
  <View style={{ marginTop }} className="flex-row items-center justify-between mb-5 px-1">
    <Text className="text-white text-xl font-black tracking-tight">{title}</Text>
    <View className="bg-slate-900 px-3 py-1 rounded-full border border-white/5">
      <Text className="text-slate-500 text-[10px] font-bold">{count}</Text>
    </View>
  </View>
);

const ActivityCard = ({ title, sub, completed, icon, onToggle, onPress, readOnly, delay = 0 }: any) => (
  <MotiView
    from={{ opacity: 0, translateX: -20 }}
    animate={{ opacity: 1, translateX: 0 }}
    transition={{ type: 'timing', duration: 300, delay }}
  >
    <TouchableOpacity 
      activeOpacity={0.7}
      disabled={!onPress}
      onPress={onPress}
      className={`flex-row items-center p-5 bg-slate-900/40 rounded-[32px] border ${completed ? 'border-blue-500/20' : 'border-white/5'}`}
    >
      <View className={`w-12 h-12 rounded-2xl items-center justify-center mr-4 border ${completed ? 'bg-blue-600/10 border-blue-600/20' : 'bg-slate-950 border-white/5'}`}>
        {icon}
      </View>
      <View className="flex-1">
        <Text className={`text-base font-bold tracking-tight ${completed ? 'text-white' : 'text-slate-300'}`}>{title}</Text>
        <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-0.5">{sub}</Text>
      </View>
      {!readOnly && (
        <TouchableOpacity 
          onPress={(e) => {
            e.stopPropagation();
            onToggle && onToggle();
          }}
          className={`w-10 h-10 rounded-full items-center justify-center border ${completed ? 'bg-blue-600 border-blue-500 shadow-lg shadow-blue-500/40' : 'bg-slate-950 border-white/10'}`}
        >
          {completed ? <CheckCircle size={20} color="white" /> : <Circle size={20} color="#475569" />}
        </TouchableOpacity>
      )}
      {readOnly && (
        <ArrowUpRight size={18} color="#475569" />
      )}
    </TouchableOpacity>
  </MotiView>
);

const EmptyState = ({ message }: { message: string }) => (
  <View className="p-8 bg-slate-900/20 rounded-[32px] border border-white/5 border-dashed items-center justify-center">
    <Text className="text-slate-600 text-[11px] font-black uppercase tracking-widest text-center">{message}</Text>
  </View>
);

const Badge = ({ label, color = "border-blue-500/20 text-blue-500 bg-blue-500/5" }: any) => (
  <View className={`px-4 py-2 rounded-full border ${color}`}>
    <Text className={`${color.split(' ')[1]} text-[9px] font-black uppercase tracking-widest`}>{label}</Text>
  </View>
);
