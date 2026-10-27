import { useBrand, useBrandColors } from '@/contexts/BrandContext';
import { isDarkColor } from '@/lib/theme-utils';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  RefreshControl,
  Alert,
  Animated as RNAnimated,
  Easing,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';

import { useRouter, useFocusEffect } from 'expo-router';
import { MotiView, AnimatePresence } from 'moti';
import {
  Calendar,
  TrendingUp,
  Target,
  Heart,
  Camera,
  ChevronRight,
  Zap,
  Brain,
  Sparkles,
  ClipboardCheck,
  Award,
  CheckCircle2,
  Utensils,
  Activity,
  Video,
  Clock,
  Footprints,
  Dumbbell,
  Moon,
  Plus,
  Circle,
  Check,
  Flame,
  X,
  Apple,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { CheckIn, Habit, HabitLog, Meal, Workout } from '@/types/database';
import { formatCompactNumber } from '@/lib/format-utils';
import { BrandedAvatar } from '@/components/BrandedAvatar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  isHealthSyncAvailable,
  requestHealthPermissions,
  getTodaySteps,
  isHealthSyncEnabled,
  syncAllHealthData,
} from '@/lib/health-service';
import { FirstTimeHeroCards } from '@/components/client/FirstTimeHeroCards';
import { useTabBarScroll } from '@/contexts/TabBarScrollContext';
import { useStreak } from '@/hooks/useStreak';
import { useGreeting } from '@/hooks/useGreeting';
import StreakBadge from '@/components/StreakBadge';
import { processCheckInAI } from '@/lib/checkin-ai-service';

interface TodaysChallenge {
  id: string;
  mother_challenge_id: string;
  mother_name: string;
  name: string;
  description?: string;
  focus_type: string;
  intensity: string;
  completed: boolean;
  completed_at?: string;
  notes?: string;
  proof_image_url?: string;
}

export default function ClientDashboard() {
  const colors = useBrandColors();
  const { brand, refreshBrand } = useBrand();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, client, loading: authLoading } = useAuth();
  const { handleScroll } = useTabBarScroll();
  const { streak, isCold } = useStreak();
  const { greeting, emoji, refreshGreeting } = useGreeting();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Core Data States
  const [todayCheckIn, setTodayCheckIn] = useState<CheckIn | null>(null);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [todayHabitLogs, setTodayHabitLogs] = useState<HabitLog[]>([]);

  // Challenge & Workout States
  const [todayChallenge, setTodayChallenge] = useState<TodaysChallenge | null>(null);
  const [todayWorkout, setTodayWorkout] = useState<Workout | null>(null);
  const [showWorkoutModal, setShowWorkoutModal] = useState(false);
  const [savingWorkout, setSavingWorkout] = useState(false);

  // Nutrition & Macros States
  const [todayMeals, setTodayMeals] = useState<Meal[]>([]);
  const [todayCalories, setTodayCalories] = useState<number>(0);
  const [todayProtein, setTodayProtein] = useState<number>(0);
  const [todayCarbs, setTodayCarbs] = useState<number>(0);
  const [todayFat, setTodayFat] = useState<number>(0);
  const [targetCalories, setTargetCalories] = useState<number | null>(null);
  const [targetProtein, setTargetProtein] = useState<number | null>(null);
  const [targetCarbs, setTargetCarbs] = useState<number | null>(null);
  const [targetFat, setTargetFat] = useState<number | null>(null);

  // Sleep & Recovery States
  const [todaySleep, setTodaySleep] = useState<number | null>(null);
  const [todayEnergy, setTodayEnergy] = useState<number | null>(null);
  const [todayRestingHR, setTodayRestingHR] = useState<number | null>(null);
  const [recoveryScore, setRecoveryScore] = useState<number | null>(null);
  const [recoveryStatus, setRecoveryStatus] = useState<string>('');

  // Steps State
  const [todaySteps, setTodaySteps] = useState<number | null>(null);
  const [stepsSyncEnabled, setStepsSyncEnabled] = useState<boolean>(false);

  // Upcoming Session
  const [upcomingSession, setUpcomingSession] = useState<any>(null);
  const [nowMs, setNowMs] = useState<number>(Date.now());

  // Tick nowMs every 30s so the Join button re-evaluates without a full reload
  useEffect(() => {
    const ticker = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(ticker);
  }, []);

  const isGeneratingAnalysisRef = useRef(false);

  // Auto-resolve check-in AI analysis if client checked in but analysis is pending/missing
  useEffect(() => {
    if (todayCheckIn && !todayCheckIn.ai_analysis && !isGeneratingAnalysisRef.current) {
      isGeneratingAnalysisRef.current = true;
      processCheckInAI(todayCheckIn.id, {
        weight: todayCheckIn.weight_kg,
        sleep: todayCheckIn.sleep_hours,
        energy: todayCheckIn.energy_level,
        stress: todayCheckIn.stress_level,
        hunger: todayCheckIn.hunger_level,
        mood: todayCheckIn.mood,
        notes: todayCheckIn.notes,
      })
        .then((analysis) => {
          setTodayCheckIn((prev) => (prev ? { ...prev, ai_analysis: analysis } : prev));
        })
        .catch((err) => {
          console.error('[Dashboard] Error auto-generating check-in AI analysis:', err);
        })
        .finally(() => {
          isGeneratingAnalysisRef.current = false;
        });
    }
  }, [todayCheckIn?.id, todayCheckIn?.ai_analysis]);

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      refreshGreeting();
      if (client) loadDashboardData();
      else if (!authLoading) setLoading(false);
    }, [client, authLoading, refreshGreeting])
  );

  // Real-time subscription for dashboard updates
  useEffect(() => {
    if (!client) return;

    const today = new Date().toISOString().split('T')[0];
    const channel = supabase
      .channel('client_dashboard_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'check_ins',
          filter: `client_id=eq.${client.id}`,
        },
        (payload: any) => {
          if (payload.new && payload.new.date === today) {
            setTodayCheckIn(payload.new as CheckIn);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'habit_logs',
          filter: `client_id=eq.${client.id}`,
        },
        () => loadDashboardData()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'habits',
          filter: `client_id=eq.${client.id}`,
        },
        () => loadDashboardData()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workouts',
          filter: `client_id=eq.${client.id}`,
        },
        () => loadDashboardData()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'meals',
          filter: `client_id=eq.${client.id}`,
        },
        () => loadDashboardData()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sub_challenges',
        },
        () => loadDashboardData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [client]);

  const loadDashboardData = async () => {
    if (!client) return;
    try {
      const today = new Date().toISOString().split('T')[0];

      // Fetch sync status from local storage
      const isSyncEnabled = await isHealthSyncEnabled();
      setStepsSyncEnabled(isSyncEnabled);

      // Fetch next upcoming session for this client
      const { data: sessionData } = await supabase
        .from('sessions')
        .select('*, coaches(profiles(full_name, avatar_url))')
        .eq('client_id', client.id)
        .eq('status', 'scheduled')
        .gt('scheduled_at', new Date().toISOString())
        .order('scheduled_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (sessionData) {
        const sessionDate = new Date(sessionData.scheduled_at).toDateString();
        const todayStr = new Date().toDateString();
        setUpcomingSession(sessionDate === todayStr ? sessionData : null);
      } else {
        setUpcomingSession(null);
      }

      // Parallel fetch for all dashboard components
      const [
        checkInResult,
        habitsResult,
        habitLogsResult,
        mealsResult,
        mealPlanResult,
        dailyLogResult,
        challengeResult,
        workoutResult,
      ] = await Promise.all([
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
        supabase
          .from('meals')
          .select('*')
          .eq('client_id', client.id)
          .eq('meal_date', today)
          .order('created_at', { ascending: false }),
        supabase
          .from('meal_plans')
          .select('daily_calories, meals_data')
          .eq('client_id', client.id)
          .eq('status', 'active')
          .maybeSingle(),
        supabase
          .from('daily_logs')
          .select('*')
          .eq('client_id', client.id)
          .eq('date', today)
          .maybeSingle(),
        supabase.rpc('get_todays_sub_challenges', {
          p_client_id: client.id,
          p_date: today,
        }),
        supabase
          .from('workouts')
          .select('*')
          .eq('client_id', client.id)
          .eq('date', today)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const checkIn = checkInResult.data;
      setTodayCheckIn(checkIn);
      setHabits(habitsResult.data || []);
      setTodayHabitLogs(habitLogsResult.data || []);

      // 1. Challenges
      const rawChallenges = challengeResult.data || [];
      setTodayChallenge(rawChallenges.length > 0 ? (rawChallenges[0] as TodaysChallenge) : null);

      // 2. Workouts
      setTodayWorkout(workoutResult.data || null);

      // 3. Meals & Macros
      const mealsData: Meal[] = mealsResult.data || [];
      setTodayMeals(mealsData);
      const calSum = mealsData.reduce((sum, m) => sum + (m.calories || 0), 0);
      const protSum = mealsData.reduce((sum, m) => sum + (m.protein_g || 0), 0);
      const carbSum = mealsData.reduce((sum, m) => sum + (m.carbs_g || 0), 0);
      const fatSum = mealsData.reduce((sum, m) => sum + (m.fat_g || 0), 0);

      setTodayCalories(calSum);
      setTodayProtein(protSum);
      setTodayCarbs(carbSum);
      setTodayFat(fatSum);

      const targetCal = mealPlanResult.data?.daily_calories || 2000;
      setTargetCalories(targetCal);
      setTargetProtein(
        mealPlanResult.data?.meals_data?.target_protein || Math.round((targetCal * 0.3) / 4)
      );
      setTargetCarbs(
        mealPlanResult.data?.meals_data?.target_carbs || Math.round((targetCal * 0.45) / 4)
      );
      setTargetFat(
        mealPlanResult.data?.meals_data?.target_fat || Math.round((targetCal * 0.25) / 9)
      );

      // 4. Sleep & Recovery Score
      const sleepHours = checkIn?.sleep_hours ?? dailyLogResult.data?.sleep_hours ?? null;
      const energyLevel = checkIn?.energy_level ?? null;
      const restingHR = dailyLogResult.data?.resting_heart_rate ?? null;

      setTodaySleep(sleepHours);
      setTodayEnergy(energyLevel);
      setTodayRestingHR(restingHR);

      if (sleepHours !== null && energyLevel !== null) {
        const sleepPts = Math.min(50, Math.max(10, Math.round((sleepHours / 8) * 50)));
        const energyPts = Math.min(50, Math.max(10, Math.round((energyLevel / 10) * 50)));
        const totalScore = sleepPts + energyPts;
        setRecoveryScore(totalScore);
        if (totalScore >= 80) setRecoveryStatus('Ready to Train');
        else if (totalScore >= 60) setRecoveryStatus('Steady Pace');
        else setRecoveryStatus('Take it Easy');
      } else if (sleepHours !== null) {
        const totalScore = Math.min(100, Math.max(20, Math.round((sleepHours / 8) * 100)));
        setRecoveryScore(totalScore);
        setRecoveryStatus(totalScore >= 75 ? 'Well Rested' : 'Low Sleep');
      } else if (energyLevel !== null) {
        const totalScore = energyLevel * 10;
        setRecoveryScore(totalScore);
        setRecoveryStatus(totalScore >= 70 ? 'High Energy' : 'Rest Advised');
      } else {
        setRecoveryScore(null);
        setRecoveryStatus('');
      }

      // 5. Silent Health Data Sync
      if (isSyncEnabled) {
        const syncResult = await syncAllHealthData(client.id);
        if (syncResult.steps !== null) {
          setTodaySteps(syncResult.steps);
        } else if (dailyLogResult.data?.steps) {
          setTodaySteps(dailyLogResult.data.steps);
        }
      } else if (dailyLogResult.data?.steps) {
        setTodaySteps(dailyLogResult.data.steps);
      } else {
        const currentSteps = await getTodaySteps();
        setTodaySteps(currentSteps);
      }
    } catch (e) {
      console.error('Dashboard load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Toggle Challenge Completion
  const toggleTodayChallenge = async () => {
    if (!todayChallenge || !client) return;
    const nextCompleted = !todayChallenge.completed;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    // Optimistic update
    setTodayChallenge((prev) => (prev ? { ...prev, completed: nextCompleted } : null));

    try {
      await supabase.rpc('mark_sub_challenge', {
        p_sub_challenge_id: todayChallenge.id,
        p_client_id: client.id,
        p_completed: nextCompleted,
      });
    } catch (err) {
      console.error('Failed to toggle challenge:', err);
      setTodayChallenge((prev) => (prev ? { ...prev, completed: !nextCompleted } : null));
    }
  };

  // Toggle Workout Completion
  const toggleWorkoutCompleted = async () => {
    if (!todayWorkout) return;
    const nextCompleted = !todayWorkout.completed;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    setTodayWorkout((prev) => (prev ? { ...prev, completed: nextCompleted } : null));

    try {
      await supabase
        .from('workouts')
        .update({ completed: nextCompleted })
        .eq('id', todayWorkout.id);
    } catch (err) {
      console.error('Error toggling workout:', err);
      setTodayWorkout((prev) => (prev ? { ...prev, completed: !nextCompleted } : null));
    }
  };

  // Mark Rest Day
  const handleMarkRestDay = async () => {
    if (!client) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const today = new Date().toISOString().split('T')[0];

    try {
      const { data, error } = await supabase
        .from('workouts')
        .insert({
          client_id: client.id,
          date: today,
          name: 'Rest & Recovery',
          duration_minutes: 0,
          completed: true,
          notes: 'Scheduled rest day',
        })
        .select()
        .single();

      if (error) throw error;
      setTodayWorkout(data);
    } catch (err) {
      console.error('Error marking rest day:', err);
    }
  };

  // Save New Workout from Quick Modal
  const handleSaveWorkout = async (name: string, duration: number) => {
    if (!client) return;
    setSavingWorkout(true);
    const today = new Date().toISOString().split('T')[0];

    try {
      const { data, error } = await supabase
        .from('workouts')
        .insert({
          client_id: client.id,
          date: today,
          name: name.trim() || 'Daily Workout',
          duration_minutes: duration || 45,
          completed: false,
        })
        .select()
        .single();

      if (error) throw error;
      setTodayWorkout(data);
      setShowWorkoutModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err) {
      console.error('Error creating workout:', err);
      Alert.alert('Error', 'Could not save workout. Try again.');
    } finally {
      setSavingWorkout(false);
    }
  };

  // Toggle Habit
  const toggleHabit = async (habit: Habit) => {
    if (!client) return;
    const today = new Date().toISOString().split('T')[0];
    const existingLog = todayHabitLogs.find((l) => l.habit_id === habit.id);
    const nextCompleted = existingLog ? !existingLog.completed : true;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    // Optimistic update
    if (existingLog) {
      setTodayHabitLogs((prev) =>
        prev.map((l) => (l.id === existingLog.id ? { ...l, completed: nextCompleted } : l))
      );
    } else {
      const tempLog: HabitLog = {
        id: `temp-${Date.now()}`,
        client_id: client.id,
        habit_id: habit.id,
        date: today,
        completed: true,
        created_at: new Date().toISOString(),
      };
      setTodayHabitLogs((prev) => [...prev, tempLog]);
    }

    try {
      if (existingLog) {
        await supabase
          .from('habit_logs')
          .update({ completed: nextCompleted })
          .eq('id', existingLog.id);
      } else {
        const { data } = await supabase
          .from('habit_logs')
          .insert({
            client_id: client.id,
            habit_id: habit.id,
            date: today,
            completed: true,
          })
          .select()
          .single();

        if (data) {
          setTodayHabitLogs((prev) =>
            prev.map((l) => (l.id.startsWith('temp-') && l.habit_id === habit.id ? data : l))
          );
        }
      }
    } catch (err) {
      console.error('Error toggling habit:', err);
      loadDashboardData();
    }
  };

  const handleStepsSyncPress = async () => {
    if (stepsSyncEnabled) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (client?.id) {
        const syncResult = await syncAllHealthData(client.id);
        if (syncResult.steps !== null) {
          setTodaySteps(syncResult.steps);
        }
      }
    } else {
      const granted = await requestHealthPermissions();
      if (granted) {
        setStepsSyncEnabled(true);
        if (client?.id) {
          const syncResult = await syncAllHealthData(client.id);
          if (syncResult.steps !== null) {
            setTodaySteps(syncResult.steps);
          }
        }
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    refreshBrand();
    loadDashboardData();
  };

  if (loading && !refreshing) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const isDark = isDarkColor(colors.background || '#010417');
  const textColor = colors.text || (isDark ? '#FFFFFF' : '#0F172A');
  const textSecondaryColor = colors.textSecondary || (isDark ? '#94A3B8' : '#64748B');
  const cardBg = colors.surface || (isDark ? '#0F172A' : '#FFFFFF');
  const cardBorder = colors.border || (isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0');

  const completedHabitsCount = todayHabitLogs.filter((log) => log.completed).length;
  const rawFirstName = profile?.full_name?.split(' ')[0] || '';
  const firstName = rawFirstName ? rawFirstName.charAt(0).toUpperCase() + rawFirstName.slice(1) : '';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent />
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: 140 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            progressViewOffset={insets.top + 10}
          />
        }
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* Top Brand Bar */}
        <MotiView
          from={{ opacity: 0, translateY: -8 }}
          animate={{ opacity: 1, translateY: 0 }}
          className="px-6 pb-4 flex-row items-center justify-between"
        >
          <View className="flex-row items-center gap-3.5 flex-1 mr-3">
            {brand?.logo_url ? (
              <Image
                source={{ uri: brand.logo_url }}
                style={{ width: 44, height: 44, borderRadius: 14, borderWidth: 1, borderColor: cardBorder }}
                contentFit="cover"
              />
            ) : (
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  backgroundColor: colors.primary + '25',
                  borderColor: colors.primary + '40',
                }}
                className="border items-center justify-center shadow-lg"
              >
                <Text style={{ color: colors.primary }} className="text-xl font-black">
                  {brand?.name ? brand.name.charAt(0).toUpperCase() : 'C'}
                </Text>
              </View>
            )}
            <Text style={{ color: textColor }} className="text-xl font-black tracking-tight" numberOfLines={1}>
              {brand?.name || ''}
            </Text>
          </View>

          <View className="flex-row items-center gap-2.5">
            <StreakBadge
              streak={streak}
              isCold={isCold}
              isDark={isDark}
              onPress={() => {
                router.push({
                  pathname: '/(client)/(tabs)/activity',
                  params: { highlightDailyTasks: 'true' },
                });
              }}
            />

            <TouchableOpacity
              onPress={() => router.push('/(client)/(tabs)/profile')}
              style={{ backgroundColor: cardBg, borderColor: cardBorder }}
              className="p-1 rounded-full border shadow-2xl relative"
            >
              <BrandedAvatar size={44} name={profile?.full_name || 'U'} imageUrl={profile?.avatar_url} />
              <View
                style={{ backgroundColor: colors.primary, borderColor: cardBg }}
                className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2"
              />
            </TouchableOpacity>
          </View>
        </MotiView>

        {/* Client Greeting */}
        <MotiView
          from={{ opacity: 0, translateY: -4 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ delay: 80 }}
          className="px-6 pb-5"
        >
          <Text
            style={{ color: textColor }}
            className="text-4xl font-black tracking-tight leading-[46px]"
          >
            {greeting} {emoji}
          </Text>
          {firstName ? (
            <Text
              style={{ color: colors.primary }}
              className="text-4xl font-black tracking-tight leading-[46px]"
            >
              {firstName}
            </Text>
          ) : null}
        </MotiView>

        <View className="px-3">
          {/* First Time Hero Cards */}
          <FirstTimeHeroCards clientName={firstName} />

          {/* ─── 1. Sleep & Recovery Score Card ──────────────────────── */}
          <RecoveryScoreCard
            score={recoveryScore}
            status={recoveryStatus}
            sleepHours={todaySleep}
            energyLevel={todayEnergy}
            restingHR={todayRestingHR}
            hasCheckedIn={!!todayCheckIn}
            onCheckIn={() => router.push('/(client)/check-in')}
          />

          {/* ─── 2. Metric Tiles Grid ─────────────────────────────────── */}
          <View className="flex-row flex-wrap justify-between gap-4 mb-4">
            <MetricCard
              label="Calories"
              value={targetCalories ? `${Math.round(todayCalories)} / ${targetCalories} kcal` : `${Math.round(todayCalories)} kcal`}
              icon={<Utensils size={20} color={colors.primary} />}
              active={todayCalories > 0}
              onPress={() => router.push('/(client)/activity' as any)}
            />
            <MetricCard
              label="Protein"
              value={targetProtein ? `${Math.round(todayProtein)} / ${targetProtein} g` : `${Math.round(todayProtein)} g`}
              icon={<Target size={20} color="#818CF8" />}
              active={todayProtein > 0}
              onPress={() => router.push('/(client)/activity' as any)}
            />
            <MetricCard
              label="Daily Tasks"
              value={`${completedHabitsCount}/${habits.length || 0}`}
              icon={<Award size={20} color="#10B981" />}
              active={completedHabitsCount === habits.length && habits.length > 0}
              onPress={() => router.push('/(client)/activity' as any)}
            />
            <MetricCard
              label={stepsSyncEnabled ? 'Steps' : 'Sync Steps'}
              value={todaySteps !== null ? `${todaySteps.toLocaleString()}` : (stepsSyncEnabled ? '0' : 'Sync Steps')}
              icon={<Footprints size={20} color={stepsSyncEnabled ? colors.primary : '#64748B'} />}
              active={stepsSyncEnabled && (todaySteps ?? 0) > 0}
              onPress={handleStepsSyncPress}
              showGlow={!stepsSyncEnabled}
            />
          </View>

          {/* ─── 3. Today's Challenge Task ────────────────────────────── */}
          <TodaysChallengeCard
            challenge={todayChallenge}
            onToggle={toggleTodayChallenge}
            onViewAll={() => router.push('/(client)/challenges')}
          />

          {/* ─── 4. Today's Workout Card ──────────────────────────────── */}
          <TodaysWorkoutCard
            workout={todayWorkout}
            onToggle={toggleWorkoutCompleted}
            onLogWorkout={() => setShowWorkoutModal(true)}
            onMarkRestDay={handleMarkRestDay}
          />

          {/* ─── 5. Quick Habit Checklist ─────────────────────────────── */}
          <QuickHabitList
            habits={habits}
            logs={todayHabitLogs}
            onToggleHabit={toggleHabit}
            onViewAll={() =>
              router.push({
                pathname: '/(client)/(tabs)/activity',
                params: { highlightDailyTasks: 'true' },
              })
            }
          />

          {/* ─── 6. Today's Meals & Macro Bars ───────────────────────── */}
          <NutritionMacroCard
            calories={todayCalories}
            targetCalories={targetCalories}
            protein={todayProtein}
            targetProtein={targetProtein}
            carbs={todayCarbs}
            targetCarbs={targetCarbs}
            fat={todayFat}
            targetFat={targetFat}
            meals={todayMeals}
            onLogMeal={() => router.push('/(client)/log-meal')}
          />

          {/* ─── 7. Daily Check-In / Coach Insights ───────────────────── */}
          {!todayCheckIn ? (
            <CheckInCTACard onPress={() => router.push('/(client)/check-in')} />
          ) : !todayCheckIn.ai_analysis ? (
            <MotiView
              key="checkin-done"
              from={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ backgroundColor: cardBg, borderColor: cardBorder }}
              className="mt-6 overflow-hidden rounded-[40px] border shadow-2xl relative"
            >
              <View style={{ backgroundColor: `${colors.primary}1A` }} className="absolute -top-24 -right-24 w-48 h-48 rounded-full" />
              <View className="p-8">
                <View className="flex-row items-center gap-2 mb-3">
                  <View
                    style={{ backgroundColor: `${colors.primary}20`, borderColor: `${colors.primary}40` }}
                    className="w-6 h-6 rounded-full items-center justify-center border"
                  >
                    <CheckCircle2 size={12} color={colors.primary} />
                  </View>
                  <Text style={{ color: colors.primary }} className="text-[10px] font-black uppercase tracking-[3px]">Plan Synced</Text>
                </View>

                <Text style={{ color: textColor }} className="text-3xl font-black tracking-tight leading-8 mb-2">Metrics Logged</Text>
                <Text style={{ color: textSecondaryColor }} className="font-medium text-sm leading-6">Your data is securely stored. The AI and your coach are analyzing your progress.</Text>

                <View className="mt-8 flex-row items-center justify-between">
                  <MotiView
                    from={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 400 }}
                    style={{ backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}33` }}
                    className="flex-row items-center gap-2 px-4 py-2 rounded-full border"
                  >
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={{ color: colors.primary }} className="font-black text-[10px] uppercase tracking-widest">AI Processing</Text>
                  </MotiView>

                  <View className="flex-row items-center">
                    <View
                      style={{ backgroundColor: colors.background, borderColor: cardBorder }}
                      className="w-8 h-8 rounded-full border-2 items-center justify-center z-20"
                    >
                      <Brain size={14} color={colors.primary} />
                    </View>
                    <View
                      style={{ backgroundColor: colors.background, borderColor: cardBorder }}
                      className="w-8 h-8 rounded-full border-2 items-center justify-center z-10 -ml-2"
                    >
                      <Zap size={14} color="#F59E0B" />
                    </View>
                  </View>
                </View>
              </View>
            </MotiView>
          ) : null}

          {/* Coach's Insights */}
          {todayCheckIn?.ai_analysis && (
            <MotiView
              from={{ opacity: 0, translateY: 10 }}
              animate={{ opacity: 1, translateY: 0 }}
              style={{ backgroundColor: cardBg, borderColor: cardBorder }}
              className="mt-6 p-8 rounded-[48px] border shadow-xl"
            >
              <View className="flex-row items-center gap-4 mb-6">
                <View className="w-12 h-12 bg-blue-600/10 border border-blue-600/20 rounded-2xl items-center justify-center">
                  <Brain size={24} color={colors.primary} />
                </View>
                <View>
                  <Text style={{ color: textColor }} className="font-black text-lg tracking-tight">Today's Strategy</Text>
                  <Text style={{ color: textSecondaryColor }} className="text-[9px] font-black uppercase tracking-widest">Feedback Loop</Text>
                </View>
              </View>
              <Text style={{ color: textColor }} className="leading-7 font-medium text-lg">
                {(() => {
                  const aiAnalysis = todayCheckIn.ai_analysis;
                  if (!aiAnalysis) return '';
                  const trimmed = aiAnalysis.trim();
                  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
                    try {
                      const parsed = JSON.parse(trimmed);
                      return parsed.coaching_advice || parsed.analysis || parsed.advice || parsed.insight || trimmed;
                    } catch (e) {
                      return trimmed;
                    }
                  }
                  return trimmed;
                })()}
              </Text>
              <View style={{ borderTopColor: cardBorder }} className="mt-8 pt-8 border-t flex-row items-center gap-2">
                <Sparkles size={16} color="#818CF8" />
                <Text style={{ color: textSecondaryColor }} className="text-[10px] font-black uppercase tracking-[3px]">AI-Assisted Guidance</Text>
              </View>
            </MotiView>
          )}

          {/* Upcoming Session Card — today only */}
          {upcomingSession && (
            <View className="mt-6">
              <UpcomingSessionCard
                session={upcomingSession}
                nowMs={nowMs}
                onJoin={() => router.push('/(client)/messages')}
              />
            </View>
          )}

          {/* Quick Actions Grid */}
          <View className="mt-8">
            <Text style={{ color: textColor }} className="text-2xl font-black tracking-tighter mb-4 px-1">Quick Access</Text>
            <View className="flex-row gap-4">
              <ActionCard
                label="Log Meal"
                sub="Photo Analysis"
                icon={<Camera size={28} color={colors.primary} />}
                onPress={() => router.push('/(client)/log-meal')}
              />
              <ActionCard
                label="Challenges"
                sub="Active Goals"
                icon={<Award size={28} color="#10B981" />}
                onPress={() => router.push('/(client)/challenges')}
              />
            </View>
          </View>

          {/* Powered by Brand Footer */}
          <View className="items-center pt-8 pb-4">
            <View
              style={{ backgroundColor: cardBg, borderColor: cardBorder }}
              className="flex-row items-center gap-2 px-4 py-2 rounded-full border shadow-sm"
            >
              {brand?.logo_url ? (
                <Image
                  source={{ uri: brand.logo_url }}
                  style={{ width: 18, height: 18, borderRadius: 4 }}
                  contentFit="cover"
                />
              ) : (
                <View
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 4,
                    backgroundColor: colors.primary + '30',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: colors.primary, fontSize: 10, fontWeight: '900' }}>
                    {brand?.name ? brand.name.charAt(0).toUpperCase() : 'C'}
                  </Text>
                </View>
              )}
              <Text style={{ color: textSecondaryColor }} className="text-xs font-semibold">
                Powered by <Text style={{ color: textColor }} className="font-bold">{brand?.name || 'Your Coach'}</Text>
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Quick Workout Modal */}
      <QuickLogWorkoutModal
        visible={showWorkoutModal}
        loading={savingWorkout}
        onClose={() => setShowWorkoutModal(false)}
        onSave={handleSaveWorkout}
      />
    </View>
  );
}

// ─── 1. Sleep & Recovery Score Card Component ────────────────────────────────
const RecoveryScoreCard = ({
  score,
  status,
  sleepHours,
  energyLevel,
  restingHR,
  hasCheckedIn,
  onCheckIn,
}: {
  score: number | null;
  status: string;
  sleepHours: number | null;
  energyLevel: number | null;
  restingHR: number | null;
  hasCheckedIn: boolean;
  onCheckIn: () => void;
}) => {
  const colors = useBrandColors();
  const isDark = isDarkColor(colors.background || '#010417');
  const textColor = colors.text || (isDark ? '#FFFFFF' : '#0F172A');
  const textSecondaryColor = colors.textSecondary || (isDark ? '#94A3B8' : '#64748B');
  const cardBg = colors.surface || (isDark ? '#0F172A' : '#FFFFFF');
  const cardBorder = colors.border || (isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0');

  const scoreColor =
    score && score >= 80 ? '#10B981' : score && score >= 60 ? '#F59E0B' : '#6366F1';

  return (
    <MotiView
      from={{ opacity: 0, translateY: 6 }}
      animate={{ opacity: 1, translateY: 0 }}
      style={{ backgroundColor: cardBg, borderColor: cardBorder }}
      className="p-6 rounded-[36px] border shadow-lg mb-4 relative overflow-hidden"
    >
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-row items-center gap-2.5">
          <View
            style={{ backgroundColor: `${scoreColor}20`, borderColor: `${scoreColor}40` }}
            className="w-9 h-9 rounded-xl items-center justify-center border"
          >
            <Moon size={18} color={scoreColor} />
          </View>
          <View>
            <Text style={{ color: textColor }} className="text-base font-black tracking-tight">
              Recovery Score
            </Text>
            <Text style={{ color: textSecondaryColor }} className="text-[10px] font-bold uppercase tracking-wider">
              {hasCheckedIn ? status || 'Daily Readiness' : 'Needs Check-in'}
            </Text>
          </View>
        </View>

        {score !== null ? (
          <View
            style={{ backgroundColor: `${scoreColor}18`, borderColor: `${scoreColor}40` }}
            className="px-3.5 py-1.5 rounded-full border flex-row items-center gap-1.5"
          >
            <Zap size={14} color={scoreColor} />
            <Text style={{ color: scoreColor }} className="text-sm font-black">
              {score}%
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            onPress={onCheckIn}
            style={{ backgroundColor: colors.primary }}
            className="px-3.5 py-1.5 rounded-full"
          >
            <Text className="text-white text-xs font-black">Check In</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Metrics Row */}
      <View className="flex-row items-center gap-2.5 pt-2">
        <View
          style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F1F5F9' }}
          className="flex-1 p-3 rounded-2xl items-center"
        >
          <View className="flex-row items-center gap-1 mb-0.5">
            <Moon size={12} color="#818CF8" />
            <Text style={{ color: textSecondaryColor }} className="text-[9px] font-black uppercase">
              Sleep
            </Text>
          </View>
          <Text style={{ color: textColor }} className="text-sm font-black">
            {sleepHours !== null ? `${sleepHours} hrs` : '—'}
          </Text>
        </View>

        <View
          style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F1F5F9' }}
          className="flex-1 p-3 rounded-2xl items-center"
        >
          <View className="flex-row items-center gap-1 mb-0.5">
            <Zap size={12} color="#F59E0B" />
            <Text style={{ color: textSecondaryColor }} className="text-[9px] font-black uppercase">
              Energy
            </Text>
          </View>
          <Text style={{ color: textColor }} className="text-sm font-black">
            {energyLevel !== null ? `${energyLevel}/10` : '—'}
          </Text>
        </View>

        <View
          style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F1F5F9' }}
          className="flex-1 p-3 rounded-2xl items-center"
        >
          <View className="flex-row items-center gap-1 mb-0.5">
            <Heart size={12} color="#EF4444" />
            <Text style={{ color: textSecondaryColor }} className="text-[9px] font-black uppercase">
              Heart Rate
            </Text>
          </View>
          <Text style={{ color: textColor }} className="text-sm font-black">
            {restingHR !== null ? `${restingHR} bpm` : 'Sync'}
          </Text>
        </View>
      </View>
    </MotiView>
  );
};

// ─── 3. Today's Challenge Task Component ─────────────────────────────────────
const TodaysChallengeCard = ({
  challenge,
  onToggle,
  onViewAll,
}: {
  challenge: TodaysChallenge | null;
  onToggle: () => void;
  onViewAll: () => void;
}) => {
  const colors = useBrandColors();
  const isDark = isDarkColor(colors.background || '#010417');
  const textColor = colors.text || (isDark ? '#FFFFFF' : '#0F172A');
  const textSecondaryColor = colors.textSecondary || (isDark ? '#94A3B8' : '#64748B');
  const cardBg = colors.surface || (isDark ? '#0F172A' : '#FFFFFF');
  const cardBorder = colors.border || (isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0');

  if (!challenge) {
    return (
      <View
        style={{ backgroundColor: cardBg, borderColor: cardBorder }}
        className="p-6 rounded-[36px] border shadow-md mb-4 flex-row items-center justify-between"
      >
        <View className="flex-row items-center gap-3">
          <View
            style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)' }}
            className="w-10 h-10 rounded-2xl items-center justify-center"
          >
            <Award size={20} color="#10B981" />
          </View>
          <View>
            <Text style={{ color: textColor }} className="text-base font-black">
              Today's Challenge
            </Text>
            <Text style={{ color: textSecondaryColor }} className="text-xs font-medium">
              No challenge active today
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={onViewAll}
          style={{ borderColor: cardBorder }}
          className="px-3.5 py-1.5 rounded-full border"
        >
          <Text style={{ color: colors.primary }} className="text-xs font-black">
            View All
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isCompleted = challenge.completed;

  return (
    <MotiView
      from={{ opacity: 0, translateY: 6 }}
      animate={{ opacity: 1, translateY: 0 }}
      style={{
        backgroundColor: cardBg,
        borderColor: isCompleted ? '#10B981' : cardBorder,
      }}
      className="p-6 rounded-[36px] border shadow-lg mb-4"
    >
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center gap-2">
          <View
            style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)' }}
            className="px-2.5 py-1 rounded-full"
          >
            <Text className="text-[9px] font-black uppercase text-emerald-500 tracking-wider">
              {challenge.focus_type || 'Challenge'}
            </Text>
          </View>
          <Text style={{ color: textSecondaryColor }} className="text-xs font-bold" numberOfLines={1}>
            {challenge.mother_name}
          </Text>
        </View>

        <TouchableOpacity onPress={onViewAll}>
          <ChevronRight size={16} color={textSecondaryColor} />
        </TouchableOpacity>
      </View>

      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1 mr-2">
          <Text
            style={{
              color: textColor,
              textDecorationLine: isCompleted ? 'line-through' : 'none',
              opacity: isCompleted ? 0.7 : 1,
            }}
            className="text-lg font-black tracking-tight"
          >
            {challenge.name}
          </Text>
          {challenge.description ? (
            <Text style={{ color: textSecondaryColor }} className="text-xs font-medium mt-0.5" numberOfLines={2}>
              {challenge.description}
            </Text>
          ) : null}
        </View>

        <TouchableOpacity
          onPress={onToggle}
          activeOpacity={0.8}
          style={{
            backgroundColor: isCompleted ? '#10B981' : colors.primary,
          }}
          className="flex-row items-center gap-1.5 px-4 py-2.5 rounded-full shadow-md"
        >
          {isCompleted ? <Check size={14} color="#FFFFFF" /> : <Circle size={14} color="#FFFFFF" />}
          <Text className="text-white text-xs font-black">
            {isCompleted ? 'Done' : 'Mark Done'}
          </Text>
        </TouchableOpacity>
      </View>
    </MotiView>
  );
};

// ─── 4. Today's Workout Card Component ───────────────────────────────────────
const TodaysWorkoutCard = ({
  workout,
  onToggle,
  onLogWorkout,
  onMarkRestDay,
}: {
  workout: Workout | null;
  onToggle: () => void;
  onLogWorkout: () => void;
  onMarkRestDay: () => void;
}) => {
  const colors = useBrandColors();
  const isDark = isDarkColor(colors.background || '#010417');
  const textColor = colors.text || (isDark ? '#FFFFFF' : '#0F172A');
  const textSecondaryColor = colors.textSecondary || (isDark ? '#94A3B8' : '#64748B');
  const cardBg = colors.surface || (isDark ? '#0F172A' : '#FFFFFF');
  const cardBorder = colors.border || (isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0');

  if (!workout) {
    return (
      <View
        style={{ backgroundColor: cardBg, borderColor: cardBorder }}
        className="p-6 rounded-[36px] border shadow-lg mb-4"
      >
        <View className="flex-row items-center gap-3 mb-3">
          <View
            style={{ backgroundColor: `${colors.primary}20`, borderColor: `${colors.primary}40` }}
            className="w-10 h-10 rounded-2xl items-center justify-center border"
          >
            <Dumbbell size={20} color={colors.primary} />
          </View>
          <View>
            <Text style={{ color: textColor }} className="text-base font-black">
              Today's Workout
            </Text>
            <Text style={{ color: textSecondaryColor }} className="text-xs font-medium">
              Take a rest day or log today's session
            </Text>
          </View>
        </View>

        <View className="flex-row gap-2.5 mt-2">
          <TouchableOpacity
            onPress={onMarkRestDay}
            style={{ borderColor: cardBorder }}
            className="flex-1 py-3 rounded-2xl border items-center justify-center"
          >
            <Text style={{ color: textColor }} className="text-xs font-black">
              Rest Day
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onLogWorkout}
            style={{ backgroundColor: colors.primary }}
            className="flex-1 py-3 rounded-2xl items-center justify-center flex-row gap-1.5 shadow-md"
          >
            <Plus size={14} color="#FFFFFF" />
            <Text className="text-white text-xs font-black">
              Log Workout
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const isCompleted = workout.completed;
  const exercisesCount = Array.isArray(workout.exercises) ? workout.exercises.length : 0;

  return (
    <MotiView
      from={{ opacity: 0, translateY: 6 }}
      animate={{ opacity: 1, translateY: 0 }}
      style={{
        backgroundColor: cardBg,
        borderColor: isCompleted ? '#10B981' : cardBorder,
      }}
      className="p-6 rounded-[36px] border shadow-lg mb-4"
    >
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center gap-2.5">
          <View
            style={{ backgroundColor: `${colors.primary}20`, borderColor: `${colors.primary}40` }}
            className="w-10 h-10 rounded-2xl items-center justify-center border"
          >
            <Dumbbell size={20} color={colors.primary} />
          </View>
          <View>
            <Text style={{ color: textColor }} className="text-base font-black">
              Today's Workout
            </Text>
            <Text style={{ color: textSecondaryColor }} className="text-[10px] font-bold uppercase tracking-wider">
              {workout.duration_minutes ? `${workout.duration_minutes} min` : 'Workout Logged'}
              {exercisesCount > 0 ? ` • ${exercisesCount} exercises` : ''}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={onToggle}
          activeOpacity={0.8}
          style={{
            backgroundColor: isCompleted ? '#10B981' : colors.primary,
          }}
          className="flex-row items-center gap-1.5 px-4 py-2 rounded-full shadow-md"
        >
          {isCompleted ? <Check size={14} color="#FFFFFF" /> : <Circle size={14} color="#FFFFFF" />}
          <Text className="text-white text-xs font-black">
            {isCompleted ? 'Done' : 'Mark Done'}
          </Text>
        </TouchableOpacity>
      </View>

      <Text
        style={{
          color: textColor,
          textDecorationLine: isCompleted ? 'line-through' : 'none',
          opacity: isCompleted ? 0.7 : 1,
        }}
        className="text-lg font-black tracking-tight mt-1"
      >
        {workout.name}
      </Text>
    </MotiView>
  );
};

// ─── 5. Quick Habit Checklist Component ──────────────────────────────────────
const QuickHabitList = ({
  habits,
  logs,
  onToggleHabit,
  onViewAll,
}: {
  habits: Habit[];
  logs: HabitLog[];
  onToggleHabit: (habit: Habit) => void;
  onViewAll: () => void;
}) => {
  const colors = useBrandColors();
  const isDark = isDarkColor(colors.background || '#010417');
  const textColor = colors.text || (isDark ? '#FFFFFF' : '#0F172A');
  const textSecondaryColor = colors.textSecondary || (isDark ? '#94A3B8' : '#64748B');
  const cardBg = colors.surface || (isDark ? '#0F172A' : '#FFFFFF');
  const cardBorder = colors.border || (isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0');

  const completedCount = logs.filter((l) => l.completed).length;
  const previewHabits = habits.slice(0, 4);

  return (
    <View
      style={{ backgroundColor: cardBg, borderColor: cardBorder }}
      className="p-6 rounded-[36px] border shadow-lg mb-4"
    >
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-row items-center gap-2">
          <Text style={{ color: textColor }} className="text-base font-black">
            Daily Habits
          </Text>
          <View
            style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)' }}
            className="px-2.5 py-0.5 rounded-full"
          >
            <Text className="text-[10px] font-black text-emerald-500">
              {completedCount}/{habits.length} Done
            </Text>
          </View>
        </View>

        <TouchableOpacity onPress={onViewAll}>
          <Text style={{ color: colors.primary }} className="text-xs font-black">
            See All
          </Text>
        </TouchableOpacity>
      </View>

      {previewHabits.length === 0 ? (
        <Text style={{ color: textSecondaryColor }} className="text-xs font-medium py-2">
          No active daily habits. Tap See All to add habits.
        </Text>
      ) : (
        <View className="gap-2.5">
          {previewHabits.map((habit) => {
            const isDone = logs.some((l) => l.habit_id === habit.id && l.completed);
            return (
              <TouchableOpacity
                key={habit.id}
                onPress={() => onToggleHabit(habit)}
                activeOpacity={0.7}
                style={{
                  backgroundColor: isDone
                    ? isDark
                      ? 'rgba(16, 185, 129, 0.08)'
                      : '#ECFDF5'
                    : isDark
                    ? 'rgba(255, 255, 255, 0.03)'
                    : '#F8FAFC',
                  borderColor: isDone ? 'rgba(16, 185, 129, 0.3)' : cardBorder,
                }}
                className="flex-row items-center justify-between p-3.5 rounded-2xl border"
              >
                <View className="flex-row items-center gap-3 flex-1 mr-2">
                  <View
                    style={{
                      backgroundColor: isDone ? '#10B981' : 'transparent',
                      borderColor: isDone ? '#10B981' : textSecondaryColor,
                    }}
                    className="w-5 h-5 rounded-full border items-center justify-center"
                  >
                    {isDone && <Check size={12} color="#FFFFFF" />}
                  </View>
                  <Text
                    style={{
                      color: textColor,
                      textDecorationLine: isDone ? 'line-through' : 'none',
                      opacity: isDone ? 0.6 : 1,
                    }}
                    className="text-sm font-bold flex-1"
                    numberOfLines={1}
                  >
                    {habit.name}
                  </Text>
                </View>

                {habit.target_value ? (
                  <Text style={{ color: textSecondaryColor }} className="text-[10px] font-bold">
                    {habit.target_value} {habit.unit || ''}
                  </Text>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
};

// ─── 6. Today's Meals & Macro Bars Component ─────────────────────────────────
const NutritionMacroCard = ({
  calories,
  targetCalories,
  protein,
  targetProtein,
  carbs,
  targetCarbs,
  fat,
  targetFat,
  meals,
  onLogMeal,
}: {
  calories: number;
  targetCalories: number | null;
  protein: number;
  targetProtein: number | null;
  carbs: number;
  targetCarbs: number | null;
  fat: number;
  targetFat: number | null;
  meals: Meal[];
  onLogMeal: () => void;
}) => {
  const colors = useBrandColors();
  const isDark = isDarkColor(colors.background || '#010417');
  const textColor = colors.text || (isDark ? '#FFFFFF' : '#0F172A');
  const textSecondaryColor = colors.textSecondary || (isDark ? '#94A3B8' : '#64748B');
  const cardBg = colors.surface || (isDark ? '#0F172A' : '#FFFFFF');
  const cardBorder = colors.border || (isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0');

  const calGoal = targetCalories || 2000;
  const calPercent = Math.min(100, Math.round((calories / calGoal) * 100));

  const protGoal = targetProtein || 150;
  const protPercent = Math.min(100, Math.round((protein / protGoal) * 100));

  const carbGoal = targetCarbs || 200;
  const carbPercent = Math.min(100, Math.round((carbs / carbGoal) * 100));

  const fatGoal = targetFat || 65;
  const fatPercent = Math.min(100, Math.round((fat / fatGoal) * 100));

  return (
    <View
      style={{ backgroundColor: cardBg, borderColor: cardBorder }}
      className="p-6 rounded-[36px] border shadow-lg mb-4"
    >
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-row items-center gap-2">
          <Text style={{ color: textColor }} className="text-base font-black">
            Today's Food
          </Text>
          <View
            style={{ backgroundColor: `${colors.primary}18` }}
            className="px-2.5 py-0.5 rounded-full"
          >
            <Text style={{ color: colors.primary }} className="text-[10px] font-black">
              {Math.round(calories)} / {calGoal} kcal
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={onLogMeal}
          style={{ backgroundColor: colors.primary }}
          className="flex-row items-center gap-1 px-3 py-1.5 rounded-full shadow-sm"
        >
          <Camera size={13} color="#FFFFFF" />
          <Text className="text-white text-xs font-black">Log Meal</Text>
        </TouchableOpacity>
      </View>

      {/* Main Calorie Bar */}
      <View className="mb-4">
        <View
          style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#E2E8F0' }}
          className="h-2.5 w-full rounded-full overflow-hidden"
        >
          <View
            style={{
              width: `${calPercent}%`,
              backgroundColor: colors.primary,
            }}
            className="h-full rounded-full"
          />
        </View>
      </View>

      {/* 3 Macro Bars */}
      <View className="flex-row gap-2.5 mb-4">
        {/* Protein */}
        <View
          style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC' }}
          className="flex-1 p-3 rounded-2xl"
        >
          <Text style={{ color: textSecondaryColor }} className="text-[9px] font-black uppercase">
            Protein
          </Text>
          <Text style={{ color: textColor }} className="text-sm font-black my-1">
            {Math.round(protein)}/{protGoal}g
          </Text>
          <View
            style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0' }}
            className="h-1.5 rounded-full overflow-hidden"
          >
            <View
              style={{ width: `${protPercent}%`, backgroundColor: '#818CF8' }}
              className="h-full rounded-full"
            />
          </View>
        </View>

        {/* Carbs */}
        <View
          style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC' }}
          className="flex-1 p-3 rounded-2xl"
        >
          <Text style={{ color: textSecondaryColor }} className="text-[9px] font-black uppercase">
            Carbs
          </Text>
          <Text style={{ color: textColor }} className="text-sm font-black my-1">
            {Math.round(carbs)}/{carbGoal}g
          </Text>
          <View
            style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0' }}
            className="h-1.5 rounded-full overflow-hidden"
          >
            <View
              style={{ width: `${carbPercent}%`, backgroundColor: '#F59E0B' }}
              className="h-full rounded-full"
            />
          </View>
        </View>

        {/* Fat */}
        <View
          style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC' }}
          className="flex-1 p-3 rounded-2xl"
        >
          <Text style={{ color: textSecondaryColor }} className="text-[9px] font-black uppercase">
            Fats
          </Text>
          <Text style={{ color: textColor }} className="text-sm font-black my-1">
            {Math.round(fat)}/{fatGoal}g
          </Text>
          <View
            style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0' }}
            className="h-1.5 rounded-full overflow-hidden"
          >
            <View
              style={{ width: `${fatPercent}%`, backgroundColor: '#10B981' }}
              className="h-full rounded-full"
            />
          </View>
        </View>
      </View>

      {/* Logged Meals Mini Carousel */}
      {meals.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-1 pt-1">
          {meals.map((meal) => (
            <View
              key={meal.id}
              style={{
                backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F1F5F9',
                borderColor: cardBorder,
              }}
              className="mr-2.5 p-2.5 rounded-2xl border flex-row items-center gap-2.5 min-w-[150px]"
            >
              {meal.photo_url ? (
                <Image
                  source={{ uri: meal.photo_url }}
                  style={{ width: 36, height: 36, borderRadius: 10 }}
                  contentFit="cover"
                />
              ) : (
                <View
                  style={{ backgroundColor: `${colors.primary}20` }}
                  className="w-9 h-9 rounded-xl items-center justify-center"
                >
                  <Apple size={16} color={colors.primary} />
                </View>
              )}
              <View className="flex-1 pr-1">
                <Text style={{ color: textColor }} className="text-xs font-black" numberOfLines={1}>
                  {meal.name}
                </Text>
                <Text style={{ color: textSecondaryColor }} className="text-[10px] font-medium">
                  {meal.calories ? `${meal.calories} kcal` : meal.meal_type}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
      ) : (
        <TouchableOpacity
          onPress={onLogMeal}
          style={{ borderColor: cardBorder }}
          className="p-3 rounded-2xl border border-dashed items-center justify-center"
        >
          <Text style={{ color: textSecondaryColor }} className="text-xs font-bold">
            + Log your first meal today
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// ─── Quick Log Workout Modal ─────────────────────────────────────────────────
const QuickLogWorkoutModal = ({
  visible,
  loading,
  onClose,
  onSave,
}: {
  visible: boolean;
  loading: boolean;
  onClose: () => void;
  onSave: (name: string, duration: number) => void;
}) => {
  const colors = useBrandColors();
  const isDark = isDarkColor(colors.background || '#010417');
  const textColor = colors.text || (isDark ? '#FFFFFF' : '#0F172A');
  const textSecondaryColor = colors.textSecondary || (isDark ? '#94A3B8' : '#64748B');
  const cardBg = colors.surface || (isDark ? '#0F172A' : '#FFFFFF');
  const cardBorder = colors.border || (isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0');

  const [name, setName] = useState('');
  const [duration, setDuration] = useState('45');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 }}>
        <View
          style={{ backgroundColor: cardBg, borderColor: cardBorder }}
          className="p-6 rounded-[36px] border shadow-2xl"
        >
          <View className="flex-row items-center justify-between mb-4">
            <Text style={{ color: textColor }} className="text-xl font-black">
              Log Workout
            </Text>
            <TouchableOpacity onPress={onClose} className="p-1">
              <X size={20} color={textSecondaryColor} />
            </TouchableOpacity>
          </View>

          <View className="mb-4">
            <Text style={{ color: textSecondaryColor }} className="text-xs font-bold mb-1.5 uppercase tracking-wider">
              Workout Name
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Upper Body, 5km Run"
              placeholderTextColor={textSecondaryColor}
              style={{
                backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9',
                borderColor: cardBorder,
                color: textColor,
              }}
              className="px-4 py-3 rounded-2xl border text-sm font-medium"
            />
          </View>

          <View className="mb-6">
            <Text style={{ color: textSecondaryColor }} className="text-xs font-bold mb-1.5 uppercase tracking-wider">
              Duration (minutes)
            </Text>
            <TextInput
              value={duration}
              onChangeText={setDuration}
              keyboardType="numeric"
              placeholder="45"
              placeholderTextColor={textSecondaryColor}
              style={{
                backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9',
                borderColor: cardBorder,
                color: textColor,
              }}
              className="px-4 py-3 rounded-2xl border text-sm font-medium"
            />
          </View>

          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={onClose}
              style={{ borderColor: cardBorder }}
              className="flex-1 py-3 rounded-2xl border items-center justify-center"
            >
              <Text style={{ color: textColor }} className="text-sm font-black">
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onSave(name, parseInt(duration, 10) || 45)}
              disabled={loading}
              style={{ backgroundColor: colors.primary }}
              className="flex-1 py-3 rounded-2xl items-center justify-center shadow-md"
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text className="text-white text-sm font-black">Save Workout</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ─── Check-In CTA Card ───────────────────────────────────────────────────────
const CheckInCTACard = ({ onPress }: { onPress: () => void }) => {
  const colors = useBrandColors();
  const primaryIsDark = isDarkColor(colors.primary);
  const primaryTextColor = primaryIsDark ? '#FFFFFF' : '#0F172A';
  const primaryTextMuted = primaryIsDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(15, 23, 42, 0.8)';
  const btnBg = primaryIsDark ? '#FFFFFF' : '#0F172A';
  const btnText = primaryIsDark ? colors.primary : '#FFFFFF';

  return (
    <MotiView
      key="checkin-cta"
      from={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{ marginTop: 8, borderRadius: 40, overflow: 'hidden', backgroundColor: colors.primary }}
      className="shadow-2xl border border-white/10 relative mb-4"
    >
      <View className="absolute -top-24 -right-12 w-64 h-64 bg-white/10 rounded-full" />
      <View className="absolute -bottom-24 -left-12 w-48 h-48 bg-black/10 rounded-full" />

      <TouchableOpacity className="p-8 relative z-10" onPress={onPress}>
        <View className="flex-row items-center gap-2 mb-3">
          <Zap size={14} color={primaryTextColor} />
          <Text style={{ color: primaryTextMuted }} className="text-[10px] font-black uppercase tracking-[3px]">
            Daily Goal
          </Text>
        </View>
        <Text style={{ color: primaryTextColor }} className="text-3xl font-black tracking-tight leading-8">
          Complete Your Check-in
        </Text>
        <Text style={{ color: primaryTextMuted }} className="mt-3 font-medium text-sm leading-6">
          Update your coach on your energy, weight, and meal progress today.
        </Text>
        <View className="mt-8 flex-row items-center justify-between">
          <View style={{ backgroundColor: btnBg }} className="px-5 py-2.5 rounded-full">
            <Text style={{ color: btnText }} className="font-black text-xs uppercase tracking-widest">
              Start Now
            </Text>
          </View>
          <ChevronRight size={24} color={primaryTextColor} opacity={0.6} />
        </View>
      </TouchableOpacity>
    </MotiView>
  );
};

const MetricCard = ({ label, value, icon, active, onPress, showGlow = false }: any) => {
  const colors = useBrandColors();
  const isDark = isDarkColor(colors.background || '#010417');
  const textColor = colors.text || (isDark ? '#FFFFFF' : '#0F172A');
  const textSecondaryColor = colors.textSecondary || (isDark ? '#94A3B8' : '#64748B');
  const cardBg = colors.surface || (isDark ? '#0F172A' : '#FFFFFF');
  const cardBorder = colors.border || (isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0');
  const displayValue = typeof value === 'number' ? formatCompactNumber(value) : value;

  const glowAnim = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    if (!showGlow) {
      glowAnim.setValue(0);
      return;
    }
    const pulse = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(glowAnim, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        RNAnimated.timing(glowAnim, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [showGlow]);

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.08, 0.55],
  });

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      className={`w-[47%] p-6 rounded-[36px] border-2 transition-all shadow-lg overflow-hidden ${!active ? 'border-dashed' : ''}`}
      style={{
        position: 'relative',
        backgroundColor: active ? cardBg : isDark ? 'rgba(15, 23, 42, 0.4)' : 'rgba(255, 255, 255, 0.7)',
        borderColor: active ? cardBorder : isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
      }}
    >
      {showGlow && (
        <RNAnimated.View
          style={{
            position: 'absolute',
            inset: 0,
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderRadius: 36,
            opacity: glowOpacity,
            backgroundColor: colors.primary,
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 1,
            shadowRadius: 32,
            elevation: 12,
          }}
          pointerEvents="none"
        />
      )}
      <View
        style={{ backgroundColor: colors.background, borderColor: cardBorder }}
        className="w-12 h-12 rounded-2xl items-center justify-center border mb-6 shadow-sm"
      >
        {icon}
      </View>
      <Text style={{ color: textColor }} className="text-xl font-black tracking-tight">
        {displayValue}
      </Text>
      <Text style={{ color: textSecondaryColor }} className="text-[9px] font-black uppercase tracking-widest mt-1.5">
        {label}
      </Text>
    </TouchableOpacity>
  );
};

// ─── Upcoming Session Card ───────────────────────────────────────────────────
const UpcomingSessionCard = ({
  session,
  nowMs,
  onJoin,
}: {
  session: any;
  nowMs: number;
  onJoin: () => void;
}) => {
  const colors = useBrandColors();
  const isDark = isDarkColor(colors.background || '#010417');
  const textColor = colors.text || (isDark ? '#FFFFFF' : '#0F172A');
  const textSecondaryColor = colors.textSecondary || (isDark ? '#94A3B8' : '#64748B');
  const cardBg = colors.surface || (isDark ? '#0F172A' : '#FFFFFF');
  const cardBorder = colors.border || (isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0');

  const sessionTime = new Date(session.scheduled_at).getTime();
  const minutesUntil = (sessionTime - nowMs) / 60_000;
  const canJoin = minutesUntil <= 5;
  const coachName = session.coaches?.profiles?.full_name || 'Your Coach';

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

  const countdownLabel = () => {
    if (canJoin) return 'Ready to join';
    if (minutesUntil < 60) return `In ${Math.ceil(minutesUntil)} min`;
    const hrs = Math.floor(minutesUntil / 60);
    const mins = Math.round(minutesUntil % 60);
    return mins > 0 ? `In ${hrs}h ${mins}m` : `In ${hrs}h`;
  };

  return (
    <MotiView
      from={{ opacity: 0, translateY: 8 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 400 }}
      className="mb-4 overflow-hidden rounded-[40px]"
      style={{
        backgroundColor: canJoin ? '#1D4ED8' : cardBg,
        borderWidth: 1,
        borderColor: canJoin ? 'rgba(59,130,246,0.5)' : cardBorder,
        shadowColor: canJoin ? colors.primary : '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: canJoin ? 0.35 : 0.2,
        shadowRadius: 20,
        elevation: 8,
      }}
    >
      {canJoin && (
        <View
          style={{
            position: 'absolute',
            top: -40,
            right: -40,
            width: 120,
            height: 120,
            borderRadius: 60,
            backgroundColor: 'rgba(99,179,255,0.15)',
          }}
        />
      )}

      <View style={{ padding: 24 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                backgroundColor: canJoin ? 'rgba(255,255,255,0.15)' : `${colors.primary}20`,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Video size={13} color={canJoin ? '#fff' : colors.primary} />
            </View>
            <Text
              style={{
                color: canJoin ? 'rgba(255,255,255,0.75)' : textSecondaryColor,
                fontSize: 9,
                fontWeight: '900',
                textTransform: 'uppercase',
                letterSpacing: 2,
              }}
            >
              Live Session
            </Text>
          </View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              backgroundColor: canJoin ? 'rgba(255,255,255,0.12)' : 'rgba(16,185,129,0.08)',
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: canJoin ? 'rgba(255,255,255,0.15)' : 'rgba(16,185,129,0.15)',
            }}
          >
            <Clock size={11} color={canJoin ? '#fff' : '#10B981'} />
            <Text style={{ color: canJoin ? '#fff' : '#10B981', fontSize: 11, fontWeight: '800' }}>
              {countdownLabel()}
            </Text>
          </View>
        </View>

        <Text style={{ color: canJoin ? '#fff' : textColor, fontSize: 22, fontWeight: '900', letterSpacing: -0.5, marginBottom: 4 }}>
          Session with {coachName.split(' ')[0]}
        </Text>
        <Text style={{ color: canJoin ? 'rgba(255,255,255,0.6)' : textSecondaryColor, fontSize: 13, fontWeight: '600', marginBottom: 20 }}>
          {formatTime(session.scheduled_at)} · {session.duration_minutes || 60} min
        </Text>

        <TouchableOpacity
          onPress={canJoin ? onJoin : undefined}
          activeOpacity={canJoin ? 0.7 : 1}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            paddingVertical: 14,
            borderRadius: 28,
            backgroundColor: canJoin ? '#fff' : colors.background,
            borderWidth: canJoin ? 0 : 1,
            borderColor: cardBorder,
          }}
        >
          <Video size={16} color={canJoin ? '#1D4ED8' : textSecondaryColor} />
          <Text
            style={{
              fontWeight: '900',
              fontSize: 13,
              textTransform: 'uppercase',
              letterSpacing: 1.5,
              color: canJoin ? '#1D4ED8' : textSecondaryColor,
            }}
          >
            {canJoin ? 'Join Now' : 'Join — Opens Soon'}
          </Text>
        </TouchableOpacity>
      </View>
    </MotiView>
  );
};

const ActionCard = ({ label, sub, icon, onPress }: any) => {
  const colors = useBrandColors();
  const isDark = isDarkColor(colors.background || '#010417');
  const textColor = colors.text || (isDark ? '#FFFFFF' : '#0F172A');
  const textSecondaryColor = colors.textSecondary || (isDark ? '#94A3B8' : '#64748B');
  const cardBg = colors.surface || (isDark ? '#0F172A' : '#FFFFFF');
  const cardBorder = colors.border || (isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0');

  return (
    <TouchableOpacity
      onPress={onPress}
      style={{ backgroundColor: cardBg, borderColor: cardBorder }}
      className="flex-1 p-7 rounded-[36px] border items-center justify-center gap-3.5 shadow-xl"
    >
      <View
        style={{ backgroundColor: colors.background, borderColor: cardBorder }}
        className="w-14 h-14 rounded-[22px] items-center justify-center border shadow-inner"
      >
        {icon}
      </View>
      <View className="items-center">
        <Text style={{ color: textColor }} className="font-black text-base tracking-tight">
          {label}
        </Text>
        <Text style={{ color: textSecondaryColor }} className="text-[9px] font-black uppercase tracking-widest mt-0.5">
          {sub}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

