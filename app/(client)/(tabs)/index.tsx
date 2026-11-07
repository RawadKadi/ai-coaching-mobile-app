import { useBrand, useBrandColors } from '@/contexts/BrandContext';
import { isDarkColor, hexToRGB } from '@/lib/theme-utils';
import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  RefreshControl,
  Animated as RNAnimated,
  Easing,
  AccessibilityInfo,
  Platform,
  StyleSheet,
  Modal,
  PanResponder,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useReducedMotion } from 'react-native-reanimated';
import { Image } from 'expo-image';

import { useRouter, useFocusEffect } from 'expo-router';
import { MotiView } from 'moti';
import {
  Target,
  Heart,
  Camera,
  ChevronRight,
  Zap,
  Brain,
  Sparkles,
  Award,
  CheckCircle2,
  Utensils,
  Video,
  Clock,
  Footprints,
  Moon,
  Circle,
  Check,
  Apple,
  Flame,
  Plus,
  TrendingUp,
  Dumbbell,
  Calendar,
  CheckCircle,
  X,
} from 'lucide-react-native';
import { NestedTaskCard } from '@/components/NestedTaskCard';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { CheckIn, Habit, HabitLog, Meal } from '@/types/database';
import { formatCompactNumber } from '@/lib/format-utils';
import { BrandedAvatar } from '@/components/BrandedAvatar';
import LightRays from '@/components/ui/LightRays';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
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
import { getUnifiedDailyTasks, UnifiedDailyTask } from '@/lib/daily-tasks';
import { parseChallengeDescription } from '@/lib/challenge-description';
import { ClientDashboardSkeleton } from '@/components/ClientDashboardSkeleton';

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
  const reduceMotion = useReducedMotion();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const topBarHeight = insets.top + 68;
  const headerAnim = useRef(new RNAnimated.Value(0)).current;
  const lastScrollY = useRef(0);
  const isHeaderHidden = useRef(false);

  const handleDashboardScroll = (event: any) => {
    handleScroll(event);

    if (reduceMotion) return;

    const currentScrollY = event.nativeEvent.contentOffset.y;

    if (currentScrollY <= 15) {
      if (isHeaderHidden.current) {
        isHeaderHidden.current = false;
        RNAnimated.spring(headerAnim, {
          toValue: 0,
          useNativeDriver: true,
          friction: 8,
          tension: 50,
        }).start();
      }
      lastScrollY.current = currentScrollY;
      return;
    }

    const diff = currentScrollY - lastScrollY.current;

    if (Math.abs(diff) > 8) {
      if (diff > 0 && currentScrollY > 60) {
        // Scrolling DOWN -> Hide bar
        if (!isHeaderHidden.current) {
          isHeaderHidden.current = true;
          RNAnimated.timing(headerAnim, {
            toValue: -topBarHeight,
            duration: 200,
            useNativeDriver: true,
          }).start();
        }
      } else if (diff < 0) {
        // Scrolling UP -> Show bar
        if (isHeaderHidden.current) {
          isHeaderHidden.current = false;
          RNAnimated.spring(headerAnim, {
            toValue: 0,
            useNativeDriver: true,
            friction: 8,
            tension: 50,
          }).start();
        }
      }
      lastScrollY.current = currentScrollY;
    }
  };

  // Core Data States
  const [todayCheckIn, setTodayCheckIn] = useState<CheckIn | null>(null);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [todayHabitLogs, setTodayHabitLogs] = useState<HabitLog[]>([]);

  // Challenge State
  const [todayChallenge, setTodayChallenge] = useState<TodaysChallenge | null>(
    null,
  );
  const [todaysChallenges, setTodaysChallenges] = useState<TodaysChallenge[]>([]);
  const [isDayDrawerOpen, setIsDayDrawerOpen] = useState(false);
  const daySheetAnim = useRef(new RNAnimated.Value(800)).current;
  const dayBackdropAnim = useRef(new RNAnimated.Value(0)).current;

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
  const [stepsHistory, setStepsHistory] = useState<number[]>([
    0, 0, 0, 0, 0, 0, 0,
  ]);

  // Upcoming Session
  const [upcomingSession, setUpcomingSession] = useState<any>(null);
  const [nowMs, setNowMs] = useState<number>(Date.now());

  // Tick nowMs every 30s so the Join button re-evaluates without a full reload
  useEffect(() => {
    const ticker = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(ticker);
  }, []);

  const nowTimeStr = useMemo(() => {
    return new Date().toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }, [nowMs]);

  const computedStepsChart = useMemo(() => {
    const chart = [...stepsHistory];
    if (chart.length >= 7) {
      chart[6] = todaySteps || chart[6] || 0;
    }
    return chart;
  }, [stepsHistory, todaySteps]);

  const dailyTasks = useMemo(() => {
    return getUnifiedDailyTasks({
      habits,
      habitLogs: todayHabitLogs,
      isCheckedIn: !!todayCheckIn,
      mealsCount: todayMeals.length,
    });
  }, [habits, todayHabitLogs, todayCheckIn, todayMeals]);

  const isGeneratingAnalysisRef = useRef(false);

  // Auto-resolve check-in AI analysis if client checked in but analysis is pending/missing
  useEffect(() => {
    if (
      todayCheckIn &&
      !todayCheckIn.ai_analysis &&
      !isGeneratingAnalysisRef.current
    ) {
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
          setTodayCheckIn((prev) =>
            prev ? { ...prev, ai_analysis: analysis } : prev,
          );
        })
        .catch((err) => {
          console.error(
            '[Dashboard] Error auto-generating check-in AI analysis:',
            err,
          );
        })
        .finally(() => {
          isGeneratingAnalysisRef.current = false;
        });
    }
  }, [todayCheckIn?.id, todayCheckIn?.ai_analysis]);

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      refreshBrand();
      refreshGreeting();
      if (client) loadDashboardData();
      else if (!authLoading) setLoading(false);
    }, [client, authLoading, refreshBrand, refreshGreeting]),
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
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'habit_logs',
          filter: `client_id=eq.${client.id}`,
        },
        () => loadDashboardData(),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'habits',
          filter: `client_id=eq.${client.id}`,
        },
        () => loadDashboardData(),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'meals',
          filter: `client_id=eq.${client.id}`,
        },
        () => loadDashboardData(),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sub_challenges',
        },
        () => loadDashboardData(),
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
          .gte(
            'date',
            (() => {
              const d = new Date();
              d.setDate(d.getDate() - 6);
              return d.toISOString().split('T')[0];
            })(),
          )
          .order('date', { ascending: true }),
        supabase.rpc('get_todays_sub_challenges', {
          p_client_id: client.id,
          p_date: today,
        }),
      ]);

      const checkIn = checkInResult.data;
      setTodayCheckIn(checkIn);
      setHabits(habitsResult.data || []);
      setTodayHabitLogs(habitLogsResult.data || []);

      const logsList = Array.isArray(dailyLogResult.data)
        ? dailyLogResult.data
        : [];
      const todayLog = logsList.find((l: any) => l.date === today) || null;

      // Build 7-day steps array for the steps card
      const past7Dates = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return d.toISOString().split('T')[0];
      });
      const chartPoints = past7Dates.map((dStr, idx) => {
        if (idx === 6) return todayLog?.steps || 0;
        const match = logsList.find((l: any) => l.date === dStr);
        return match?.steps || 0;
      });
      setStepsHistory(chartPoints);

      // 1. Challenges
      const rawChallenges = challengeResult.data || [];
      setTodaysChallenges(rawChallenges as TodaysChallenge[]);
      setTodayChallenge(
        rawChallenges.length > 0 ? (rawChallenges[0] as TodaysChallenge) : null,
      );

      // 2. Meals & Macros
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
        mealPlanResult.data?.meals_data?.target_protein ||
          Math.round((targetCal * 0.3) / 4),
      );
      setTargetCarbs(
        mealPlanResult.data?.meals_data?.target_carbs ||
          Math.round((targetCal * 0.45) / 4),
      );
      setTargetFat(
        mealPlanResult.data?.meals_data?.target_fat ||
          Math.round((targetCal * 0.25) / 9),
      );

      // 3. Sleep & Recovery Score
      const sleepHours = checkIn?.sleep_hours ?? todayLog?.sleep_hours ?? null;
      const energyLevel = checkIn?.energy_level ?? null;
      const restingHR = todayLog?.resting_heart_rate ?? null;

      setTodaySleep(sleepHours);
      setTodayEnergy(energyLevel);
      setTodayRestingHR(restingHR);

      if (sleepHours !== null && energyLevel !== null) {
        const sleepPts = Math.min(
          50,
          Math.max(10, Math.round((sleepHours / 8) * 50)),
        );
        const energyPts = Math.min(
          50,
          Math.max(10, Math.round((energyLevel / 10) * 50)),
        );
        const totalScore = sleepPts + energyPts;
        setRecoveryScore(totalScore);
        if (totalScore >= 80) setRecoveryStatus('Ready to Train');
        else if (totalScore >= 60) setRecoveryStatus('Steady Pace');
        else setRecoveryStatus('Take it Easy');
      } else if (sleepHours !== null) {
        const totalScore = Math.min(
          100,
          Math.max(20, Math.round((sleepHours / 8) * 100)),
        );
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

      // 4. Silent Health Data Sync
      if (isSyncEnabled) {
        const syncResult = await syncAllHealthData(client.id);
        if (syncResult.steps !== null) {
          setTodaySteps(syncResult.steps);
        } else if (todayLog?.steps) {
          setTodaySteps(todayLog.steps);
        }
      } else if (todayLog?.steps) {
        setTodaySteps(todayLog.steps);
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

  // Day Tasks Drawer Animations & Gestures
  const openDayDrawer = () => {
    setIsDayDrawerOpen(true);
    daySheetAnim.setValue(800);
    dayBackdropAnim.setValue(0);
    RNAnimated.parallel([
      RNAnimated.spring(daySheetAnim, {
        toValue: 0,
        damping: 24,
        mass: 0.9,
        stiffness: 180,
        useNativeDriver: true,
      }),
      RNAnimated.timing(dayBackdropAnim, {
        toValue: 0.6,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeDayDrawer = () => {
    RNAnimated.parallel([
      RNAnimated.timing(daySheetAnim, {
        toValue: 800,
        duration: 250,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      RNAnimated.timing(dayBackdropAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsDayDrawerOpen(false);
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        gestureState.dy > 5 || gestureState.dy < -5,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          daySheetAnim.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 120 || gestureState.vy > 0.6) {
          closeDayDrawer();
        } else {
          RNAnimated.spring(daySheetAnim, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
          }).start();
        }
      },
    }),
  ).current;

  // Toggle Sub-Challenge Completion (Called by Drawer / Sets / Parent toggle)
  const handleToggleSubChallenge = async (subTask: any) => {
    if (!client) return;
    const targetId = subTask.id;
    const currentCompleted = !!subTask.completed;
    const nextCompleted = !currentCompleted;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    // Optimistic update
    setTodayChallenge((prev) =>
      prev && prev.id === targetId ? { ...prev, completed: nextCompleted } : prev,
    );
    setTodaysChallenges((prev) =>
      prev.map((t) =>
        t.id === targetId ? { ...t, completed: nextCompleted } : t,
      ),
    );

    try {
      await supabase.rpc('mark_sub_challenge', {
        p_sub_challenge_id: targetId,
        p_client_id: client.id,
        p_completed: nextCompleted,
      });
    } catch (err) {
      console.error('Failed to toggle challenge:', err);
      // revert
      setTodayChallenge((prev) =>
        prev && prev.id === targetId ? { ...prev, completed: currentCompleted } : prev,
      );
      setTodaysChallenges((prev) =>
        prev.map((t) =>
          t.id === targetId ? { ...t, completed: currentCompleted } : t,
        ),
      );
    }
  };

  const toggleTodayChallenge = () => {
    if (todayChallenge) {
      handleToggleSubChallenge(todayChallenge);
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
        prev.map((l) =>
          l.id === existingLog.id ? { ...l, completed: nextCompleted } : l,
        ),
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
            prev.map((l) =>
              l.id.startsWith('temp-') && l.habit_id === habit.id ? data : l,
            ),
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
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );
      }
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    refreshBrand();
    loadDashboardData();
  };

  if (loading && !refreshing) {
    return <ClientDashboardSkeleton />;
  }

  const isDark = isDarkColor(colors.background || '#010417');
  const textColor = colors.text || (isDark ? '#FFFFFF' : '#0F172A');
  const textSecondaryColor =
    colors.textSecondary || (isDark ? '#94A3B8' : '#64748B');
  const cardBg = colors.surface || (isDark ? '#0F172A' : '#FFFFFF');
  const cardBorder =
    colors.border || (isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0');

  const brandBgHex = isDark
    ? (brand?.dark_background_color || colors.background || '#0F172A')
    : (brand?.background_color || colors.background || '#FFFFFF');
  const bgRgb = hexToRGB(brandBgHex);
  const topBarBg = `rgba(${bgRgb.r}, ${bgRgb.g}, ${bgRgb.b}, ${isDark ? 0.72 : 0.82})`;

  const borderHex = colors.border || (isDark ? '#334155' : '#E2E8F0');
  const borderRgb = hexToRGB(borderHex);
  const topBarBorder = `rgba(${borderRgb.r}, ${borderRgb.g}, ${borderRgb.b}, ${isDark ? 0.35 : 0.55})`;

  const completedHabitsCount = todayHabitLogs.filter(
    (log) => log.completed,
  ).length;
  const rawFirstName = profile?.full_name?.split(' ')[0] || '';
  const firstName = rawFirstName
    ? rawFirstName.charAt(0).toUpperCase() + rawFirstName.slice(1)
    : '';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
      />

      {/* Brand-adaptive Light Rays Background */}
      <LightRays
        raysOrigin="top-center"
        raysColor={colors.primary}
        raysSpeed={0.8}
        lightSpread={0.6}
        rayLength={2.8}
        glow={0.5}
        haze={0.2}
        atmosphere={0.7}
        intensity={isDark ? 0.8 : 0.55}
        lightMode={!isDark}
        pulsating={false}
        followMouse={true}
        mouseInfluence={0.08}
      />

      {/* Fixed Blur Top Bar */}
      <RNAnimated.View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          transform: [{ translateY: headerAnim }],
        }}
      >
        <View
          style={{
            borderBottomWidth: 1,
            borderColor: topBarBorder,
            overflow: 'hidden',
          }}
        >
          <BlurView
            intensity={Platform.OS === 'ios' ? 70 : 100}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: topBarBg,
              },
            ]}
          />

          <View
            style={{
              paddingTop: insets.top + 8,
              paddingBottom: 12,
              paddingHorizontal: 24,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <View className="flex-row items-center gap-3.5 flex-1 mr-3">
              {brand?.logo_url ? (
                <Image
                  source={{ uri: brand.logo_url }}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: cardBorder,
                  }}
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
                  <Text
                    style={{ color: colors.primary }}
                    className="text-xl font-black"
                  >
                    {brand?.name ? brand.name.charAt(0).toUpperCase() : 'C'}
                  </Text>
                </View>
              )}
              <Text
                style={{ color: textColor }}
                className="text-xl font-black tracking-tight"
                numberOfLines={1}
              >
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
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                  router.push({
                    pathname: '/(client)/(tabs)/profile',
                    params: { scrollToTop: Date.now().toString() },
                  });
                }}
                style={{ backgroundColor: cardBg, borderColor: cardBorder }}
                className="p-1 rounded-full border shadow-2xl relative"
                activeOpacity={0.7}
              >
                <BrandedAvatar
                  size={44}
                  name={profile?.full_name || 'U'}
                  imageUrl={profile?.avatar_url}
                />
                <View
                  style={{ backgroundColor: colors.primary, borderColor: cardBg }}
                  className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2"
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </RNAnimated.View>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 76,
          paddingBottom: 140,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            progressViewOffset={insets.top + 70}
          />
        }
        onScroll={handleDashboardScroll}
        scrollEventThrottle={16}
      >

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

          {/* ─── 1. Check-In Card (NOW AT THE VERY TOP) ────────────────── */}
          {!todayCheckIn ? (
            <CheckInCTACard onPress={() => router.push('/(client)/check-in')} />
          ) : !todayCheckIn.ai_analysis ? (
            <MotiView
              key="checkin-done"
              from={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ backgroundColor: cardBg, borderColor: cardBorder }}
              className="mb-4 overflow-hidden rounded-[40px] border shadow-2xl relative"
            >
              <View
                style={{ backgroundColor: `${colors.primary}1A` }}
                className="absolute -top-24 -right-24 w-48 h-48 rounded-full"
              />
              <View className="p-8">
                <View className="flex-row items-center gap-2 mb-3">
                  <View
                    style={{
                      backgroundColor: `${colors.primary}20`,
                      borderColor: `${colors.primary}40`,
                    }}
                    className="w-6 h-6 rounded-full items-center justify-center border"
                  >
                    <CheckCircle2 size={12} color={colors.primary} />
                  </View>
                  <Text
                    style={{ color: colors.primary }}
                    className="text-[10px] font-black uppercase tracking-[3px]"
                  >
                    Plan Synced
                  </Text>
                </View>

                <Text
                  style={{ color: textColor }}
                  className="text-3xl font-black tracking-tight leading-8 mb-2"
                >
                  Metrics Logged
                </Text>
                <Text
                  style={{ color: textSecondaryColor }}
                  className="font-medium text-sm leading-6"
                >
                  Your data is securely stored. The AI and your coach are
                  analyzing your progress.
                </Text>

                <View className="mt-8 flex-row items-center justify-between">
                  <MotiView
                    from={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 400 }}
                    style={{
                      backgroundColor: `${colors.primary}18`,
                      borderColor: `${colors.primary}33`,
                    }}
                    className="flex-row items-center gap-2 px-4 py-2 rounded-full border"
                  >
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text
                      style={{ color: colors.primary }}
                      className="font-black text-[10px] uppercase tracking-widest"
                    >
                      AI Processing
                    </Text>
                  </MotiView>

                  <View className="flex-row items-center">
                    <View
                      style={{
                        backgroundColor: colors.background,
                        borderColor: cardBorder,
                      }}
                      className="w-8 h-8 rounded-full border-2 items-center justify-center z-20"
                    >
                      <Brain size={14} color={colors.primary} />
                    </View>
                    <View
                      style={{
                        backgroundColor: colors.background,
                        borderColor: cardBorder,
                      }}
                      className="w-8 h-8 rounded-full border-2 items-center justify-center z-10 -ml-2"
                    >
                      <Zap
                        size={14}
                        color={colors.secondary || colors.primary}
                      />
                    </View>
                  </View>
                </View>
              </View>
            </MotiView>
          ) : (
            <MotiView
              from={{ opacity: 0, translateY: 10 }}
              animate={{ opacity: 1, translateY: 0 }}
              style={{ backgroundColor: cardBg, borderColor: cardBorder }}
              className="mb-4 p-8 rounded-[48px] border shadow-xl"
            >
              <View className="flex-row items-center gap-4 mb-6">
                <View
                  style={{
                    backgroundColor: `${colors.primary}15`,
                    borderColor: `${colors.primary}30`,
                  }}
                  className="w-12 h-12 border rounded-2xl items-center justify-center"
                >
                  <Brain size={24} color={colors.primary} />
                </View>
                <View>
                  <Text
                    style={{ color: textColor }}
                    className="font-black text-lg tracking-tight"
                  >
                    Today's Strategy
                  </Text>
                  <Text
                    style={{ color: textSecondaryColor }}
                    className="text-[9px] font-black uppercase tracking-widest"
                  >
                    Feedback Loop
                  </Text>
                </View>
              </View>
              <Text
                style={{ color: textColor }}
                className="leading-7 font-medium text-lg"
              >
                {(() => {
                  const aiAnalysis = todayCheckIn.ai_analysis;
                  if (!aiAnalysis) return '';
                  const trimmed = aiAnalysis.trim();
                  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
                    try {
                      const parsed = JSON.parse(trimmed);
                      return (
                        parsed.coaching_advice ||
                        parsed.analysis ||
                        parsed.advice ||
                        parsed.insight ||
                        trimmed
                      );
                    } catch (e) {
                      return trimmed;
                    }
                  }
                  return trimmed;
                })()}
              </Text>
              <View
                style={{ borderTopColor: cardBorder }}
                className="mt-8 pt-8 border-t flex-row items-center gap-2"
              >
                <Sparkles size={16} color={colors.primary} />
                <Text
                  style={{ color: textSecondaryColor }}
                  className="text-[10px] font-black uppercase tracking-[3px]"
                >
                  AI-Assisted Guidance
                </Text>
              </View>
            </MotiView>
          )}

          {/* ─── 1. Steps Card (Directly Below Check-In Card) ──────────── */}
          <DashboardStepsCard
            steps={todaySteps}
            chartData={computedStepsChart}
            timeStr={nowTimeStr}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/(client)/analytics-detail?metric=steps' as any);
            }}
          />

          {/* ─── 2. Sleep & Recovery Score Card (BIG) ──────────────────── */}
          <RecoveryScoreCard
            score={recoveryScore}
            status={recoveryStatus}
            sleepHours={todaySleep}
            energyLevel={todayEnergy}
            restingHR={todayRestingHR}
            hasCheckedIn={!!todayCheckIn}
            onCheckIn={() => router.push('/(client)/check-in')}
          />

          {/* ─── 3. Today's Food & Macro Card (Directly Below Recovery Score) ── */}
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

          {/* ─── 4. Today's Challenge Task (CHUNKY ACTIONABLE CARD) ───── */}
          <TodaysChallengeCard
            challenge={todayChallenge}
            allChallenges={todaysChallenges}
            onPressCard={openDayDrawer}
            onViewAll={() => router.push('/(client)/challenges')}
          />

          {/* ─── 5. Quick Habit Checklist (BIG sub-cards) ─────────────── */}
          <QuickHabitList
            tasks={dailyTasks}
            onToggleHabit={toggleHabit}
            onCheckIn={() => router.push('/(client)/check-in')}
            onLogMeal={() => router.push('/(client)/log-meal')}
            onViewAll={() => router.push('/(client)/(tabs)/activity')}
          />

          {/* ─── 6. Upcoming Session Card — today only ─────────────────── */}
          {upcomingSession && (
            <View className="mt-4 mb-2">
              <UpcomingSessionCard
                session={upcomingSession}
                nowMs={nowMs}
                onJoin={() => router.push('/(client)/messages')}
              />
            </View>
          )}

          {/* ─── 7. Quick Actions Grid ─────────────────────────────────── */}
          <View className="mt-6">
            <Text
              style={{ color: textColor }}
              className="text-2xl font-black tracking-tighter mb-4 px-1"
            >
              Quick Access
            </Text>
            <View className="flex-row gap-4">
              <ActionCard
                label="Log Meal"
                sub="Photo Analysis"
                icon={<Camera size={28} color={colors.primary} />}
                onPress={() => router.push('/(client)/log-meal')}
              />
              <ActionCard
                label="Analytics"
                sub="Stats & Trends"
                icon={<TrendingUp size={28} color={colors.primary} />}
                onPress={() => router.push('/(client)/analytics')}
              />
            </View>
          </View>

          {/* ─── 9. Powered by Brand Footer ────────────────────────────── */}
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
                  <Text
                    style={{
                      color: colors.primary,
                      fontSize: 10,
                      fontWeight: '900',
                    }}
                  >
                    {brand?.name ? brand.name.charAt(0).toUpperCase() : 'C'}
                  </Text>
                </View>
              )}
              <Text
                style={{ color: textSecondaryColor }}
                className="text-xs font-semibold"
              >
                Powered by{' '}
                <Text style={{ color: textColor }} className="font-bold">
                  {brand?.name || 'Your Coach'}
                </Text>
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* ─── Day Tasks Drawer Modal ────────────────────────────────────── */}
      <Modal
        visible={isDayDrawerOpen}
        transparent
        animationType="none"
        onRequestClose={closeDayDrawer}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          {/* Backdrop */}
          <RNAnimated.View
            style={{
              ...StyleSheet.absoluteFill,
              backgroundColor: '#000000',
              opacity: dayBackdropAnim,
            }}
          >
            <TouchableOpacity
              activeOpacity={1}
              style={{ flex: 1 }}
              onPress={closeDayDrawer}
            />
          </RNAnimated.View>

          {/* Drawer Container */}
          <RNAnimated.View
            style={{
              backgroundColor: isDark ? '#0D1117' : '#FFFFFF',
              borderTopLeftRadius: 32,
              borderTopRightRadius: 32,
              paddingTop: 8,
              paddingHorizontal: 20,
              paddingBottom: insets.bottom + 24,
              maxHeight: '85%',
              borderTopWidth: 1,
              borderTopColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
              transform: [{ translateY: daySheetAnim }],
            }}
          >
            {/* Top Handle & Close Row with PanResponder attached to handle */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 10,
              }}
            >
              <View style={{ width: 36 }} />

              {/* Draggable center handle with generous touch zone */}
              <View
                {...panResponder.panHandlers}
                style={{
                  paddingVertical: 12,
                  paddingHorizontal: 32,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 5,
                    borderRadius: 3,
                    backgroundColor: isDark
                      ? 'rgba(255, 255, 255, 0.25)'
                      : '#CBD5E1',
                  }}
                />
              </View>

              <TouchableOpacity
                onPress={closeDayDrawer}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: isDark
                    ? 'rgba(255, 255, 255, 0.08)'
                    : '#F1F5F9',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={18} color={textColor} />
              </TouchableOpacity>
            </View>

            {/* Top Day Summary Card - Matches Chunky DayCard */}
            {todayChallenge && (() => {
              const tasksList =
                todaysChallenges.length > 0
                  ? todaysChallenges
                  : [todayChallenge];
              const drawerTotal = tasksList.length;
              const drawerDone = tasksList.filter((t) => t.completed).length;
              const drawerAllDone =
                drawerTotal > 0 && drawerDone === drawerTotal;
              const drawerPercent =
                drawerTotal > 0 ? (drawerDone / drawerTotal) * 100 : 0;
              const innerBg =
                colors.background || (isDark ? '#020617' : '#F8FAFC');
              const cardBorderColor =
                colors.border ||
                (isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0');

              return (
                <View
                  style={{
                    backgroundColor: drawerAllDone ? colors.primary : innerBg,
                    borderColor: drawerAllDone
                      ? colors.primary
                      : cardBorderColor,
                    borderWidth: 1,
                    borderRadius: 24,
                    padding: 18,
                    marginBottom: 16,
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {/* Decorative ambient circle */}
                  <View
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      top: -20,
                      right: -20,
                      width: 100,
                      height: 100,
                      borderRadius: 50,
                      backgroundColor: drawerAllDone
                        ? 'rgba(255, 255, 255, 0.14)'
                        : `${colors.primary}12`,
                    }}
                  />

                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 10,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <View
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: 10,
                          backgroundColor: drawerAllDone
                            ? '#FFFFFF'
                            : `${colors.primary}20`,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {drawerAllDone ? (
                          <CheckCircle size={16} color={colors.primary} />
                        ) : (
                          <Calendar size={16} color={colors.primary} />
                        )}
                      </View>
                      <Text
                        style={{
                          color: drawerAllDone
                            ? 'rgba(255, 255, 255, 0.8)'
                            : colors.primary,
                          fontSize: 11,
                          fontWeight: '900',
                          textTransform: 'uppercase',
                          letterSpacing: 1.2,
                        }}
                      >
                        TODAY •{' '}
                        {todayChallenge.focus_type
                          ? todayChallenge.focus_type.toUpperCase()
                          : 'CHALLENGE'}
                      </Text>
                    </View>

                    <View
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 999,
                        backgroundColor: drawerAllDone
                          ? '#FFFFFF'
                          : isDark
                            ? 'rgba(255, 255, 255, 0.08)'
                            : '#F1F5F9',
                      }}
                    >
                      <Text
                        style={{
                          color: drawerAllDone
                            ? colors.primary
                            : textSecondaryColor,
                          fontSize: 11,
                          fontWeight: '800',
                        }}
                      >
                        {drawerAllDone
                          ? 'All Done 🎉'
                          : drawerTotal > 1
                            ? `${drawerDone}/${drawerTotal} Done`
                            : 'In Progress'}
                      </Text>
                    </View>
                  </View>

                  <Text
                    style={{
                      color: drawerAllDone ? '#FFFFFF' : textColor,
                      fontSize: 20,
                      fontWeight: '900',
                      letterSpacing: -0.3,
                      marginBottom: 3,
                    }}
                  >
                    {todayChallenge.name}
                  </Text>

                  <Text
                    style={{
                      color: drawerAllDone
                        ? 'rgba(255, 255, 255, 0.75)'
                        : textSecondaryColor,
                      fontSize: 13,
                      fontWeight: '600',
                      marginBottom: 12,
                    }}
                  >
                    {drawerAllDone
                      ? 'All tasks completed!'
                      : todayChallenge.mother_name || "Today's workout"}
                  </Text>

                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <View
                      style={{
                        flex: 1,
                        height: 7,
                        backgroundColor: drawerAllDone
                          ? 'rgba(255, 255, 255, 0.28)'
                          : isDark
                            ? 'rgba(255, 255, 255, 0.08)'
                            : '#E2E8F0',
                        borderRadius: 4,
                        overflow: 'hidden',
                      }}
                    >
                      <View
                        style={{
                          height: '100%',
                          width: `${Math.min(100, Math.max(0, drawerAllDone ? 100 : drawerPercent))}%`,
                          backgroundColor: drawerAllDone
                            ? '#FFFFFF'
                            : colors.primary,
                          borderRadius: 4,
                        }}
                      />
                    </View>
                    <Text
                      style={{
                        color: drawerAllDone ? '#FFFFFF' : textColor,
                        fontSize: 12,
                        fontWeight: '900',
                        minWidth: 34,
                        textAlign: 'right',
                      }}
                    >
                      {Math.round(drawerAllDone ? 100 : drawerPercent)}%
                    </Text>
                  </View>
                </View>
              );
            })()}

            {/* Scrollable list of interactive tasks */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 24 }}
            >
              {(todaysChallenges.length > 0
                ? todaysChallenges
                : todayChallenge
                  ? [todayChallenge]
                  : []
              ).map((task, idx) => (
                <NestedTaskCard
                  key={task.id}
                  task={task}
                  index={idx}
                  isFailed={false}
                  isCompleted={task.completed}
                  onToggleParent={handleToggleSubChallenge}
                  layoutType="detail"
                  showGlobalRule={true}
                />
              ))}
            </ScrollView>
          </RNAnimated.View>
        </View>
      </Modal>
    </View>
  );
}

// ─── 1. Sleep & Recovery Score Card Component (BIG HERO CARD) ────────────────
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
  const textSecondaryColor =
    colors.textSecondary || (isDark ? '#94A3B8' : '#64748B');
  const cardBg = colors.surface || (isDark ? '#0F172A' : '#FFFFFF');
  const cardBorder =
    colors.border || (isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0');

  return (
    <MotiView
      from={{ opacity: 0, translateY: 6 }}
      animate={{ opacity: 1, translateY: 0 }}
      style={{ backgroundColor: cardBg, borderColor: cardBorder }}
      className="p-7 rounded-[40px] border shadow-xl mb-4 relative overflow-hidden"
    >
      {/* Background ambient glow using brand primary */}
      <View
        style={{ backgroundColor: `${colors.primary}12` }}
        className="absolute -top-16 -right-16 w-56 h-56 rounded-full"
      />

      <View className="flex-row items-center justify-between mb-5">
        <View className="flex-row items-center gap-3.5">
          <View
            style={{
              backgroundColor: `${colors.primary}20`,
              borderColor: `${colors.primary}40`,
            }}
            className="w-12 h-12 rounded-2xl items-center justify-center border"
          >
            <Moon size={22} color={colors.primary} />
          </View>
          <View>
            <Text
              style={{ color: textColor }}
              className="text-xl font-black tracking-tight"
            >
              Recovery Score
            </Text>
            <Text
              style={{ color: colors.primary }}
              className="text-xs font-black uppercase tracking-wider mt-0.5"
            >
              {hasCheckedIn ? status || 'Daily Readiness' : 'Check-in Needed'}
            </Text>
          </View>
        </View>

        {score !== null ? (
          <View
            style={{
              backgroundColor: `${colors.primary}18`,
              borderColor: `${colors.primary}40`,
            }}
            className="px-4 py-2 rounded-2xl border flex-row items-center gap-1.5"
          >
            <Zap size={16} color={colors.primary} />
            <Text
              style={{ color: colors.primary }}
              className="text-xl font-black"
            >
              {score}%
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            onPress={onCheckIn}
            style={{ backgroundColor: colors.primary }}
            className="px-4 py-2.5 rounded-full shadow-md"
          >
            <Text className="text-white text-xs font-black">Check In</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Big Score Progress Bar */}
      {score !== null && (
        <View className="mb-5">
          <View
            style={{
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#E2E8F0',
            }}
            className="h-3 w-full rounded-full overflow-hidden"
          >
            <View
              style={{
                width: `${score}%`,
                backgroundColor: colors.primary,
              }}
              className="h-full rounded-full"
            />
          </View>
        </View>
      )}

      {/* Big Stat Tiles */}
      <View className="flex-row items-center gap-3">
        <View
          style={{
            backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC',
            borderColor: cardBorder,
          }}
          className="flex-1 p-4 rounded-3xl border items-center"
        >
          <View className="flex-row items-center gap-1.5 mb-1.5">
            <Moon size={14} color={colors.primary} />
            <Text
              style={{ color: textSecondaryColor }}
              className="text-[10px] font-black uppercase tracking-wider"
            >
              Sleep
            </Text>
          </View>
          <Text
            style={{ color: textColor }}
            className="text-xl font-black tracking-tight"
          >
            {sleepHours !== null ? `${sleepHours} hrs` : '—'}
          </Text>
        </View>

        <View
          style={{
            backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC',
            borderColor: cardBorder,
          }}
          className="flex-1 p-4 rounded-3xl border items-center"
        >
          <View className="flex-row items-center gap-1.5 mb-1.5">
            <Zap size={14} color={colors.secondary || colors.primary} />
            <Text
              style={{ color: textSecondaryColor }}
              className="text-[10px] font-black uppercase tracking-wider"
            >
              Energy
            </Text>
          </View>
          <Text
            style={{ color: textColor }}
            className="text-xl font-black tracking-tight"
          >
            {energyLevel !== null ? `${energyLevel}/10` : '—'}
          </Text>
        </View>

        <View
          style={{
            backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC',
            borderColor: cardBorder,
          }}
          className="flex-1 p-4 rounded-3xl border items-center"
        >
          <View className="flex-row items-center gap-1.5 mb-1.5">
            <Heart size={14} color={colors.accent || colors.primary} />
            <Text
              style={{ color: textSecondaryColor }}
              className="text-[10px] font-black uppercase tracking-wider"
            >
              Heart Rate
            </Text>
          </View>
          <Text
            style={{ color: textColor }}
            className="text-xl font-black tracking-tight"
          >
            {restingHR !== null ? `${restingHR} bpm` : 'Sync'}
          </Text>
        </View>
      </View>
    </MotiView>
  );
};

// ─── 2. Today's Challenge Task Component (CHUNKY ACTIONABLE DAY CARD) ─────────
const TodaysChallengeCard = ({
  challenge,
  allChallenges = [],
  onPressCard,
  onViewAll,
}: {
  challenge: TodaysChallenge | null;
  allChallenges?: TodaysChallenge[];
  onPressCard: () => void;
  onViewAll: () => void;
}) => {
  const colors = useBrandColors();
  const isDark = isDarkColor(colors.background || '#010417');
  const textColor = colors.text || (isDark ? '#FFFFFF' : '#0F172A');
  const textSecondaryColor =
    colors.textSecondary || (isDark ? '#94A3B8' : '#64748B');
  const cardBg = colors.surface || (isDark ? '#0F172A' : '#FFFFFF');
  const cardBorder =
    colors.border || (isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0');

  if (!challenge) {
    return (
      <View
        style={{
          backgroundColor: cardBg,
          borderColor: cardBorder,
          borderWidth: 1,
          borderRadius: 24,
          padding: 20,
          marginBottom: 16,
        }}
        className="flex-row items-center justify-between"
      >
        <View className="flex-row items-center gap-3">
          <View
            style={{
              backgroundColor: `${colors.primary}20`,
              borderColor: `${colors.primary}40`,
            }}
            className="w-10 h-10 rounded-xl items-center justify-center border"
          >
            <Award size={20} color={colors.primary} />
          </View>
          <View>
            <Text style={{ color: textColor }} className="text-base font-black">
              Today's Challenge
            </Text>
            <Text
              style={{ color: textSecondaryColor }}
              className="text-xs font-medium"
            >
              No challenge active today
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={onViewAll}
          style={{ borderColor: cardBorder }}
          className="px-3.5 py-1.5 rounded-full border"
        >
          <Text
            style={{ color: colors.primary }}
            className="text-xs font-black"
          >
            View All
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const tasksList = allChallenges.length > 0 ? allChallenges : [challenge];
  const totalCount = tasksList.length;
  const completedCount = tasksList.filter((t) => t.completed).length;
  const isAllDone = totalCount > 0 && completedCount === totalCount;
  const progressPercent =
    totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const primaryIsDark = isDarkColor(colors.primary);
  const completedText = primaryIsDark ? '#FFFFFF' : '#0F172A';
  const completedMuted = primaryIsDark
    ? 'rgba(255, 255, 255, 0.75)'
    : 'rgba(15, 23, 42, 0.75)';
  const completedBadgeBg = primaryIsDark ? '#FFFFFF' : '#0F172A';
  const completedBadgeContent = colors.primary;

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPressCard}
      style={{
        backgroundColor: isAllDone ? colors.primary : cardBg,
        borderColor: isAllDone ? colors.primary : cardBorder,
        borderWidth: 1,
        borderRadius: 24,
        padding: 20,
        marginBottom: 16,
        shadowColor: isAllDone ? colors.primary : '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: isAllDone ? 0.3 : isDark ? 0.2 : 0.04,
        shadowRadius: 10,
        elevation: 3,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Decorative ambient circle */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: -24,
          right: -24,
          width: 120,
          height: 120,
          borderRadius: 60,
          backgroundColor: isAllDone
            ? 'rgba(255, 255, 255, 0.14)'
            : `${colors.primary}12`,
        }}
      />

      {/* Top Row: Icon Box, Label, Status Pill, Chevron */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              backgroundColor: isAllDone
                ? completedBadgeBg
                : `${colors.primary}20`,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isAllDone ? (
              <CheckCircle size={16} color={completedBadgeContent} />
            ) : (
              <Calendar size={16} color={colors.primary} />
            )}
          </View>
          <Text
            style={{
              color: isAllDone ? completedMuted : colors.primary,
              fontSize: 11,
              fontWeight: '900',
              textTransform: 'uppercase',
              letterSpacing: 1.2,
            }}
          >
            TODAY •{' '}
            {challenge.focus_type
              ? challenge.focus_type.toUpperCase()
              : 'CHALLENGE'}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 999,
              backgroundColor: isAllDone
                ? completedBadgeBg
                : isDark
                  ? 'rgba(255, 255, 255, 0.08)'
                  : '#F1F5F9',
            }}
          >
            <Text
              style={{
                color: isAllDone ? completedBadgeContent : textSecondaryColor,
                fontSize: 12,
                fontWeight: '800',
              }}
            >
              {isAllDone
                ? 'All Done 🎉'
                : totalCount > 1
                  ? `${completedCount}/${totalCount} Done`
                  : 'In Progress'}
            </Text>
          </View>
          <ChevronRight
            size={18}
            color={isAllDone ? completedMuted : textSecondaryColor}
          />
        </View>
      </View>

      {/* Main Headline: Challenge Name */}
      <Text
        style={{
          color: isAllDone ? completedText : textColor,
          fontSize: 22,
          fontWeight: '900',
          letterSpacing: -0.4,
          marginBottom: 4,
        }}
      >
        {challenge.name}
      </Text>

      {/* Subtitle */}
      <Text
        style={{
          color: isAllDone ? completedMuted : textSecondaryColor,
          fontSize: 13,
          fontWeight: '600',
          marginBottom: 14,
        }}
      >
        {isAllDone
          ? 'All tasks completed!'
          : challenge.mother_name || "Tap to view today's workout"}
      </Text>

      {/* Progress Bar + Percentage */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <View
          style={{
            flex: 1,
            height: 7,
            backgroundColor: isAllDone
              ? 'rgba(255, 255, 255, 0.28)'
              : isDark
                ? 'rgba(255, 255, 255, 0.08)'
                : '#E2E8F0',
            borderRadius: 4,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              height: '100%',
              width: `${Math.min(100, Math.max(0, isAllDone ? 100 : progressPercent))}%`,
              backgroundColor: isAllDone ? completedBadgeBg : colors.primary,
              borderRadius: 4,
            }}
          />
        </View>
        <Text
          style={{
            color: isAllDone ? completedText : textColor,
            fontSize: 12,
            fontWeight: '900',
            minWidth: 34,
            textAlign: 'right',
          }}
        >
          {Math.round(isAllDone ? 100 : progressPercent)}%
        </Text>
      </View>
    </TouchableOpacity>
  );
};

// ─── 3. Quick Habit Checklist Component (BIG SUB-CARDS) ──────────────────────
const QuickHabitList = ({
  tasks,
  onToggleHabit,
  onCheckIn,
  onLogMeal,
  onViewAll,
}: {
  tasks: UnifiedDailyTask[];
  onToggleHabit: (habit: Habit) => void;
  onCheckIn: () => void;
  onLogMeal: () => void;
  onViewAll: () => void;
}) => {
  const colors = useBrandColors();
  const isDark = isDarkColor(colors.background || '#010417');
  const textColor = colors.text || (isDark ? '#FFFFFF' : '#0F172A');
  const textSecondaryColor =
    colors.textSecondary || (isDark ? '#94A3B8' : '#64748B');
  const cardBg = colors.surface || (isDark ? '#0F172A' : '#FFFFFF');
  const cardBorder =
    colors.border || (isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0');

  const completedCount = tasks.filter((t) => t.completed).length;
  const previewTasks = tasks.slice(0, 4);

  return (
    <View
      style={{ backgroundColor: cardBg, borderColor: cardBorder }}
      className="p-7 rounded-[40px] border shadow-xl mb-4"
    >
      <View className="flex-row items-center justify-between mb-5">
        <View className="flex-row items-center gap-2.5">
          <Text
            style={{ color: textColor }}
            className="text-xl font-black tracking-tight"
          >
            Daily Tasks
          </Text>
          <View
            style={{ backgroundColor: `${colors.primary}20` }}
            className="px-3 py-1 rounded-full"
          >
            <Text
              style={{ color: colors.primary }}
              className="text-xs font-black"
            >
              {completedCount}/{tasks.length} Done
            </Text>
          </View>
        </View>

        <TouchableOpacity onPress={onViewAll}>
          <Text
            style={{ color: colors.primary }}
            className="text-sm font-black"
          >
            See All
          </Text>
        </TouchableOpacity>
      </View>

      {previewTasks.length === 0 ? (
        <Text
          style={{ color: textSecondaryColor }}
          className="text-sm font-medium py-3"
        >
          No daily tasks established. Tap See All to add tasks.
        </Text>
      ) : (
        <View className="gap-3">
          {previewTasks.map((task) => {
            const isDone = task.completed;
            const handlePress = () => {
              if (task.type === 'check_in') {
                onCheckIn();
              } else if (task.type === 'meal_log') {
                onLogMeal();
              } else if (task.habit) {
                onToggleHabit(task.habit);
              }
            };

            return (
              <TouchableOpacity
                key={task.id}
                onPress={handlePress}
                activeOpacity={0.7}
                style={{
                  backgroundColor: isDone
                    ? `${colors.primary}12`
                    : isDark
                      ? 'rgba(255, 255, 255, 0.03)'
                      : '#F8FAFC',
                  borderColor: isDone ? colors.primary : cardBorder,
                }}
                className="flex-row items-center justify-between p-5 rounded-[28px] border-2"
              >
                <View className="flex-1 mr-3">
                  <Text
                    style={{
                      color: textColor,
                      textDecorationLine: isDone ? 'line-through' : 'none',
                      opacity: isDone ? 0.6 : 1,
                    }}
                    className="text-lg font-black tracking-tight mb-0.5"
                    numberOfLines={1}
                  >
                    {task.name}
                  </Text>
                  <Text
                    style={{ color: textSecondaryColor }}
                    className="text-xs font-bold uppercase tracking-wider"
                  >
                    {task.subtitle}
                  </Text>
                </View>

                {/* Big Checkbox Circle */}
                <View
                  style={{
                    backgroundColor: isDone ? colors.primary : 'transparent',
                    borderColor: isDone
                      ? colors.primary
                      : `${colors.primary}50`,
                  }}
                  className="w-9 h-9 rounded-full border-2 items-center justify-center shadow-sm"
                >
                  {isDone && <Check size={18} color="#FFFFFF" />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
};

// ─── 4. Today's Meals & Macro Bars Component (BRAND COLORS) ──────────────────
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
  const router = useRouter();
  const colors = useBrandColors();
  const isDark = isDarkColor(colors.background || '#010417');
  const textColor = colors.text || (isDark ? '#FFFFFF' : '#0F172A');
  const textSecondaryColor =
    colors.textSecondary || (isDark ? '#94A3B8' : '#64748B');
  const cardBg = colors.surface || (isDark ? '#0F172A' : '#FFFFFF');
  const cardBorder =
    colors.border || (isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0');

  const calGoal = targetCalories || 2000;
  const calPercent = Math.min(
    100,
    Math.max(0, Math.round((calories / calGoal) * 100)),
  );
  const roundedCalories = Math.round(calories);

  const [isFocused, setIsFocused] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [displayedCalories, setDisplayedCalories] = useState(0);

  const progressAnim = useRef(new RNAnimated.Value(0)).current;
  const glowAnim = useRef(new RNAnimated.Value(0)).current;
  const calCounterAnim = useRef(new RNAnimated.Value(0)).current;
  const committedPercentRef = useRef(0);
  const committedCalRef = useRef(0);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const listenerId = calCounterAnim.addListener(({ value }) => {
      setDisplayedCalories(Math.round(value));
    });
    return () => calCounterAnim.removeListener(listenerId);
  }, [calCounterAnim]);

  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => setIsFocused(false);
    }, []),
  );

  useEffect(() => {
    // Hold animation while user is away on the Log Meal screen so they see it animate when returning
    if (!isFocused) return;

    const prevPercent = committedPercentRef.current;
    const prevCal = committedCalRef.current;
    if (calPercent === prevPercent && roundedCalories === prevCal) return;

    const isIncreasing =
      calPercent > prevPercent || roundedCalories > prevCal;

    if (reduceMotion) {
      progressAnim.setValue(calPercent);
      calCounterAnim.setValue(roundedCalories);
      setDisplayedCalories(roundedCalories);
      committedPercentRef.current = calPercent;
      committedCalRef.current = roundedCalories;
      return;
    }

    const timer = setTimeout(() => {
      committedPercentRef.current = calPercent;
      committedCalRef.current = roundedCalories;

      if (isIncreasing && prevPercent > 0) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      RNAnimated.parallel([
        RNAnimated.timing(progressAnim, {
          toValue: calPercent,
          duration: 950,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
        RNAnimated.timing(calCounterAnim, {
          toValue: roundedCalories,
          duration: 950,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
        ...(isIncreasing
          ? [
              RNAnimated.sequence([
                RNAnimated.timing(glowAnim, {
                  toValue: 1,
                  duration: 350,
                  easing: Easing.out(Easing.quad),
                  useNativeDriver: false,
                }),
                RNAnimated.timing(glowAnim, {
                  toValue: 0,
                  duration: 600,
                  easing: Easing.inOut(Easing.quad),
                  useNativeDriver: false,
                }),
              ]),
            ]
          : []),
      ]).start();
    }, 220);

    return () => clearTimeout(timer);
  }, [
    calPercent,
    roundedCalories,
    isFocused,
    reduceMotion,
    progressAnim,
    calCounterAnim,
    glowAnim,
  ]);

  const animatedBarWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  const animatedGlowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.55],
  });

  const protGoal = targetProtein || 150;
  const carbGoal = targetCarbs || 200;
  const fatGoal = targetFat || 65;

  // Strict Brand-based colors (NO green anywhere):
  const proteinColor = colors.primary;
  const carbsColor = colors.secondary || colors.primary;
  const fatColor = colors.accent || colors.primary;

  return (
    <MotiView
      from={{ opacity: 0, translateY: 6 }}
      animate={{ opacity: 1, translateY: 0 }}
      style={{ backgroundColor: cardBg, borderColor: cardBorder }}
      className="p-7 rounded-[40px] border shadow-xl mb-4 relative overflow-hidden"
    >
      {/* Background ambient glow using brand primary */}
      <View
        style={{ backgroundColor: `${colors.primary}12` }}
        className="absolute -top-16 -right-16 w-56 h-56 rounded-full"
      />

      {/* Header matching RecoveryScoreCard */}
      <View className="flex-row items-center justify-between mb-5">
        <View className="flex-row items-center gap-3.5">
          <View
            style={{
              backgroundColor: `${colors.primary}20`,
              borderColor: `${colors.primary}40`,
            }}
            className="w-12 h-12 rounded-2xl items-center justify-center border"
          >
            <Utensils size={22} color={colors.primary} />
          </View>
          <View>
            <Text
              style={{ color: textColor }}
              className="text-xl font-black tracking-tight"
            >
              Today's Food
            </Text>
            <Text
              style={{ color: colors.primary }}
              className="text-xs font-black uppercase tracking-wider mt-0.5"
            >
              {displayedCalories} / {calGoal} kcal
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={onLogMeal}
          activeOpacity={0.8}
          style={{ backgroundColor: colors.primary }}
          className="flex-row items-center gap-1.5 px-4 py-2.5 rounded-full shadow-md"
        >
          <Camera size={14} color="#FFFFFF" strokeWidth={2.5} />
          <Text className="text-white text-xs font-black">Log Meal</Text>
        </TouchableOpacity>
      </View>

      {/* Big Calorie Progress Bar (Smoothly Animated) */}
      <View className="mb-5">
        <View
          style={{
            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#E2E8F0',
          }}
          className="h-3.5 w-full rounded-full overflow-hidden relative"
        >
          <RNAnimated.View
            style={{
              width: animatedBarWidth,
              backgroundColor: colors.primary,
            }}
            className="h-full rounded-full relative overflow-hidden"
          >
            <RNAnimated.View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: '#FFFFFF',
                opacity: animatedGlowOpacity,
              }}
            />
          </RNAnimated.View>
        </View>
      </View>

      {/* Big Stat Tiles matching RecoveryScoreCard sub cards */}
      <View className="flex-row items-center gap-3">
        {/* Protein */}
        <View
          style={{
            backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC',
            borderColor: cardBorder,
          }}
          className="flex-1 p-4 rounded-3xl border items-center"
        >
          <View className="flex-row items-center gap-1.5 mb-1.5">
            <Zap size={14} color={proteinColor} />
            <Text
              style={{ color: textSecondaryColor }}
              className="text-[10px] font-black uppercase tracking-wider"
            >
              Protein
            </Text>
          </View>
          <Text
            style={{ color: textColor }}
            className="text-xl font-black tracking-tight"
          >
            {Math.round(protein)}/{protGoal}g
          </Text>
        </View>

        {/* Carbs */}
        <View
          style={{
            backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC',
            borderColor: cardBorder,
          }}
          className="flex-1 p-4 rounded-3xl border items-center"
        >
          <View className="flex-row items-center gap-1.5 mb-1.5">
            <Apple size={14} color={carbsColor} />
            <Text
              style={{ color: textSecondaryColor }}
              className="text-[10px] font-black uppercase tracking-wider"
            >
              Carbs
            </Text>
          </View>
          <Text
            style={{ color: textColor }}
            className="text-xl font-black tracking-tight"
          >
            {Math.round(carbs)}/{carbGoal}g
          </Text>
        </View>

        {/* Fats */}
        <View
          style={{
            backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC',
            borderColor: cardBorder,
          }}
          className="flex-1 p-4 rounded-3xl border items-center"
        >
          <View className="flex-row items-center gap-1.5 mb-1.5">
            <Flame size={14} color={fatColor} />
            <Text
              style={{ color: textSecondaryColor }}
              className="text-[10px] font-black uppercase tracking-wider"
            >
              Fats
            </Text>
          </View>
          <Text
            style={{ color: textColor }}
            className="text-xl font-black tracking-tight"
          >
            {Math.round(fat)}/{fatGoal}g
          </Text>
        </View>
      </View>

      {/* Logged Meals Carousel if meals exist */}
      {meals.length > 0 && (
        <View
          className="mt-5 pt-4"
          style={{ borderTopWidth: 1, borderTopColor: cardBorder }}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="-mx-1 pt-0.5"
          >
            {meals.map((meal) => (
              <TouchableOpacity
                key={meal.id}
                activeOpacity={0.7}
                onPress={() => router.push(`/meal-details/${meal.id}` as any)}
                style={{
                  backgroundColor: isDark
                    ? 'rgba(255,255,255,0.04)'
                    : '#F8FAFC',
                  borderColor: cardBorder,
                }}
                className="mr-3 p-3 rounded-2xl border flex-row items-center gap-2.5 min-w-[150px]"
              >
                {meal.photo_url ? (
                  <Image
                    source={{ uri: meal.photo_url }}
                    style={{ width: 36, height: 36, borderRadius: 10 }}
                    contentFit="cover"
                  />
                ) : (
                  <View
                    style={{
                      backgroundColor: `${colors.primary}18`,
                      borderColor: `${colors.primary}30`,
                    }}
                    className="w-9 h-9 rounded-xl items-center justify-center border"
                  >
                    <Apple size={16} color={colors.primary} />
                  </View>
                )}
                <View className="flex-1 pr-1">
                  <Text
                    style={{ color: textColor }}
                    className="text-xs font-black"
                    numberOfLines={1}
                  >
                    {(meal as any).meal_name || meal.name || 'Meal'}
                  </Text>
                  <Text
                    style={{ color: textSecondaryColor }}
                    className="text-[10px] font-bold mt-0.5"
                  >
                    {meal.calories
                      ? `${meal.calories} kcal`
                      : meal.meal_type || 'Meal'}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </MotiView>
  );
};

// ─── Check-In CTA Card ───────────────────────────────────────────────────────
const CheckInCTACard = ({ onPress }: { onPress: () => void }) => {
  const colors = useBrandColors();
  const primaryIsDark = isDarkColor(colors.primary);
  const primaryTextColor = primaryIsDark ? '#FFFFFF' : '#0F172A';
  const primaryTextMuted = primaryIsDark
    ? 'rgba(255, 255, 255, 0.8)'
    : 'rgba(15, 23, 42, 0.8)';
  const btnBg = primaryIsDark ? '#FFFFFF' : '#0F172A';
  const btnText = primaryIsDark ? colors.primary : '#FFFFFF';

  return (
    <MotiView
      key="checkin-cta"
      from={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        borderRadius: 40,
        overflow: 'hidden',
        backgroundColor: colors.primary,
      }}
      className="shadow-2xl border border-white/10 relative mb-4"
    >
      <View className="absolute -top-24 -right-12 w-64 h-64 bg-white/10 rounded-full" />
      <View className="absolute -bottom-24 -left-12 w-48 h-48 bg-black/10 rounded-full" />

      <TouchableOpacity className="p-8 relative z-10" onPress={onPress}>
        <View className="flex-row items-center gap-2 mb-3">
          <Zap size={14} color={primaryTextColor} />
          <Text
            style={{ color: primaryTextMuted }}
            className="text-[10px] font-black uppercase tracking-[3px]"
          >
            Daily Goal
          </Text>
        </View>
        <Text
          style={{ color: primaryTextColor }}
          className="text-3xl font-black tracking-tight leading-8"
        >
          Complete Your Check-in
        </Text>
        <Text
          style={{ color: primaryTextMuted }}
          className="mt-3 font-medium text-sm leading-6"
        >
          Update your coach on your energy, weight, and meal progress today.
        </Text>
        <View className="mt-8 flex-row items-center justify-between">
          <View
            style={{ backgroundColor: btnBg }}
            className="px-5 py-2.5 rounded-full"
          >
            <Text
              style={{ color: btnText }}
              className="font-black text-xs uppercase tracking-widest"
            >
              Start Now
            </Text>
          </View>
          <ChevronRight size={24} color={primaryTextColor} opacity={0.6} />
        </View>
      </TouchableOpacity>
    </MotiView>
  );
};

// ─── Mini Bar Chart for Steps Card (7-day trend) ────────────────────────────
function MiniBarChart({
  data,
  color,
  isDark,
}: {
  data: number[];
  color: string;
  isDark: boolean;
}) {
  const points =
    data.length >= 7
      ? data.slice(-7)
      : [...Array(7 - data.length).fill(0), ...data];
  const max = Math.max(...points, 1);
  const inactiveColor = isDark ? 'rgba(255, 255, 255, 0.14)' : '#E2E8F0';

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        height: 40,
        gap: 4,
      }}
    >
      {points.map((val, idx) => {
        const isLast = idx === points.length - 1;
        const barHeight = val > 0 ? Math.max(8, (val / max) * 36) : 6;
        return (
          <View
            key={idx}
            style={{
              width: 6,
              borderRadius: 3,
              height: barHeight,
              backgroundColor: isLast ? color : inactiveColor,
            }}
          />
        );
      })}
    </View>
  );
}

// ─── Dashboard Steps Card (Matching Analytics Overview) ─────────────────────
const DashboardStepsCard = ({
  steps,
  chartData,
  timeStr,
  onPress,
}: {
  steps: number | null;
  chartData: number[];
  timeStr: string;
  onPress: () => void;
}) => {
  const colors = useBrandColors();
  const isDark = isDarkColor(colors.background || '#010417');
  const textColor = colors.text || (isDark ? '#FFFFFF' : '#0F172A');
  const textSecondaryColor =
    colors.textSecondary || (isDark ? '#94A3B8' : '#64748B');
  const cardBg = colors.surface || (isDark ? '#0F172A' : '#FFFFFF');
  const cardBorder =
    colors.border || (isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0');

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={{
        backgroundColor: cardBg,
        borderColor: cardBorder,
      }}
      className="p-6 rounded-[36px] border shadow-sm mb-4"
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2.5">
          <View
            style={{ backgroundColor: `${colors.primary}16` }}
            className="w-9 h-9 rounded-xl items-center justify-center"
          >
            <Flame size={18} color={colors.primary} />
          </View>
          <Text
            style={{ color: textColor }}
            className="text-lg font-black tracking-tight"
          >
            Steps
          </Text>
        </View>

        <View className="flex-row items-center gap-1">
          <Text
            style={{ color: textSecondaryColor }}
            className="text-xs font-semibold"
          >
            {timeStr}
          </Text>
          <ChevronRight size={18} color={textSecondaryColor} />
        </View>
      </View>

      <View className="flex-row items-end justify-between mt-4">
        <View className="flex-row items-baseline gap-2">
          <Text
            style={{ color: textColor }}
            className="text-3xl font-black tracking-tight"
          >
            {(steps || 0).toLocaleString()}
          </Text>
          <Text
            style={{ color: textSecondaryColor }}
            className="text-base font-bold"
          >
            steps
          </Text>
        </View>

        <MiniBarChart data={chartData} color={colors.primary} isDark={isDark} />
      </View>
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
  const textSecondaryColor =
    colors.textSecondary || (isDark ? '#94A3B8' : '#64748B');
  const cardBg = colors.surface || (isDark ? '#0F172A' : '#FFFFFF');
  const cardBorder =
    colors.border || (isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0');

  const sessionTime = new Date(session.scheduled_at).getTime();
  const minutesUntil = (sessionTime - nowMs) / 60_000;
  const canJoin = minutesUntil <= 5;
  const coachName = session.coaches?.profiles?.full_name || 'Your Coach';

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

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
      transition={{ type: 'timing', duration: 400 } as any}
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
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                backgroundColor: canJoin
                  ? 'rgba(255,255,255,0.15)'
                  : `${colors.primary}20`,
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
              backgroundColor: canJoin
                ? 'rgba(255,255,255,0.12)'
                : `${colors.primary}15`,
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: canJoin
                ? 'rgba(255,255,255,0.15)'
                : `${colors.primary}30`,
            }}
          >
            <Clock size={11} color={canJoin ? '#fff' : colors.primary} />
            <Text
              style={{
                color: canJoin ? '#fff' : colors.primary,
                fontSize: 11,
                fontWeight: '800',
              }}
            >
              {countdownLabel()}
            </Text>
          </View>
        </View>

        <Text
          style={{
            color: canJoin ? '#fff' : textColor,
            fontSize: 22,
            fontWeight: '900',
            letterSpacing: -0.5,
            marginBottom: 4,
          }}
        >
          Session with {coachName.split(' ')[0]}
        </Text>
        <Text
          style={{
            color: canJoin ? 'rgba(255,255,255,0.6)' : textSecondaryColor,
            fontSize: 13,
            fontWeight: '600',
            marginBottom: 20,
          }}
        >
          {formatTime(session.scheduled_at)} · {session.duration_minutes || 60}{' '}
          min
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
  const textSecondaryColor =
    colors.textSecondary || (isDark ? '#94A3B8' : '#64748B');
  const cardBg = colors.surface || (isDark ? '#0F172A' : '#FFFFFF');
  const cardBorder =
    colors.border || (isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0');

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
        <Text
          style={{ color: textColor }}
          className="font-black text-base tracking-tight"
        >
          {label}
        </Text>
        <Text
          style={{ color: textSecondaryColor }}
          className="text-[9px] font-black uppercase tracking-widest mt-0.5"
        >
          {sub}
        </Text>
      </View>
    </TouchableOpacity>
  );
};
