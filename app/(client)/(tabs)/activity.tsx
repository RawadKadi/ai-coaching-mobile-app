import { useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Modal,
  StatusBar,
  RefreshControl,
  Image,
  Animated,
  Dimensions,
  PanResponder,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
  TouchableWithoutFeedback,
  Easing as RNEasing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { MotiView } from 'moti';
import BlurText from '@/components/ui/BlurText';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/BrandContext';
import { isDarkColor, getContrastColor } from '@/lib/theme-utils';
import { supabase } from '@/lib/supabase';
import { Meal, Workout, Habit, HabitLog } from '@/types/database';
import FeedbackModal from '@/components/FeedbackModal';
import StreakFire from '@/components/StreakFire';
import Svg, { Path } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import streakQuotes from '@/assets/streak_quotes.json';
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
  X,
  TrendingUp,
  Apple,
  Moon,
  Video,
  Flame,
  Droplets,
  Footprints,
} from 'lucide-react-native';

import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatCompactNumber } from '@/lib/format-utils';
import { useTabBarScroll } from '@/contexts/TabBarScrollContext';
import MagicRings from '@/components/ui/MagicRings';

/** Returns today's date as YYYY-MM-DD in the device's local timezone, not UTC. */
function getLocalDateString(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

/** Returns past date as YYYY-MM-DD in the device's local timezone. */
function getPastLocalDateString(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

/** Generates an SVG path with a rounded rectangle cutout using fillRule="evenodd". */
function getSpotlightPath(
  screenW: number,
  screenH: number,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): string {
  const safeW = Math.max(1, w);
  const safeH = Math.max(1, h);
  const maxR = Math.min(safeW / 2, safeH / 2);
  const radius = Math.max(0, Math.min(r, maxR));

  return (
    `M -20 -20 ` +
    `H ${screenW + 40} ` +
    `V ${screenH + 40} ` +
    `H -20 ` +
    `Z ` +
    `M ${x + radius} ${y} ` +
    `H ${x + safeW - radius} ` +
    `A ${radius} ${radius} 0 0 1 ${x + safeW} ${y + radius} ` +
    `V ${y + safeH - radius} ` +
    `A ${radius} ${radius} 0 0 1 ${x + safeW - radius} ${y + safeH} ` +
    `H ${x + radius} ` +
    `A ${radius} ${radius} 0 0 1 ${x} ${y + safeH - radius} ` +
    `V ${y + radius} ` +
    `A ${radius} ${radius} 0 0 1 ${x + radius} ${y} ` +
    `Z`
  );
}

export default function ActivityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { highlightDailyTasks } = useLocalSearchParams<{
    highlightDailyTasks?: string;
  }>();
  const [isHighlighting, setIsHighlighting] = useState(false);
  const [showTooltipCard, setShowTooltipCard] = useState(false);
  const tooltipTimerRef = useRef<any>(null);
  const [highlightLayout, setHighlightLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  const scrollViewRef = useRef<any>(null);
  const dailyTasksContainerRef = useRef<any>(null);
  const logsContainerYRef = useRef<number>(0);
  const dailyTasksLayoutRef = useRef<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const hasTriggeredHighlight = useRef(false);
  const { client, profile, refreshProfile } = useAuth();
  const { handleScroll } = useTabBarScroll();
  const theme = useTheme();
  const colors = theme.colors;
  const isDark = isDarkColor(colors.background || '#020617');
  const textColor = colors.text || (isDark ? '#FFFFFF' : '#0F172A');
  const textSecondaryColor =
    colors.textSecondary || (isDark ? '#94A3B8' : '#64748B');
  const cardBg = colors.surface || (isDark ? '#0F172A' : '#FFFFFF');
  const cardBorder =
    colors.border || (isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitLogs, setHabitLogs] = useState<HabitLog[]>([]);
  const [challenges, setChallenges] = useState<any[]>([]);
  const [sessionsTaken, setSessionsTaken] = useState(0);
  const [sessionsTotal, setSessionsTotal] = useState(0);
  const [selectedDate, setSelectedDate] = useState(getLocalDateString());
  const [selectedChallenge, setSelectedChallenge] = useState<any | null>(null);
  const [motherChallenges, setMotherChallenges] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'history'>(
    'all',
  );
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [streak, setStreak] = useState(0);
  const [isCold, setIsCold] = useState(false);
  const [showStreakGained, setShowStreakGained] = useState(false);
  const [showStreakLost, setShowStreakLost] = useState(false);
  const [showColdStreak, setShowColdStreak] = useState(false);
  const [showChallengeSuccessModal, setShowChallengeSuccessModal] =
    useState(false);
  const [completedChallengeName, setCompletedChallengeName] = useState('');
  const [allChallengesFinished, setAllChallengesFinished] = useState(false);
  const [highlightTooltipText, setHighlightTooltipText] = useState(
    'Finish your daily tasks here not to lose your streak',
  );
  const streakLostShownThisSession = useRef(false);
  const coldStreakShownThisSession = useRef(false);

  // Expanded categories state
  const [expandedCategories, setExpandedCategories] = useState<
    Record<string, boolean>
  >({
    challenges: true,
    dailyTasks: true,
    nutrition: true,
    performance: true,
  });

  const streakInfo = (() => {
    if (streak <= 0) return streakQuotes[0];
    const index = ((streak - 1) % 100) + 1;
    return streakQuotes[index] || streakQuotes[0];
  })();

  const toggleCategory = (key: string) => {
    setExpandedCategories((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const triggerDailyTasksHighlight = (customTooltipText?: string) => {
    if (customTooltipText) {
      setHighlightTooltipText(customTooltipText);
    }
    // 1. Ensure daily tasks is expanded
    setExpandedCategories((prev) => ({ ...prev, dailyTasks: true }));

    // Reset card visibility
    setShowTooltipCard(false);
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);

    // 2. Smoothly scroll down to Daily Tasks
    setTimeout(() => {
      const targetScrollY =
        (logsContainerYRef.current || 0) +
        (dailyTasksLayoutRef.current?.y || 0);
      scrollViewRef.current?.scrollTo({
        y: Math.max(0, targetScrollY - 24),
        animated: true,
      });

      // 3. Measure in window to place spotlight highlight & tooltip perfectly
      setTimeout(() => {
        dailyTasksContainerRef.current?.measureInWindow(
          (x: number, y: number, width: number, height: number) => {
            const screenW = Dimensions.get('window').width;
            if (width > 0 && height > 0) {
              setHighlightLayout({
                x: Math.max(8, x - 8),
                y: Math.max(insets.top + 10, y - 8),
                width: width + 16,
                height: height + 16,
              });
            } else {
              setHighlightLayout({
                x: 16,
                y: insets.top + 120,
                width: screenW - 32,
                height: (dailyTasksLayoutRef.current?.height || 220) + 16,
              });
            }
            setIsHighlighting(true);

            // Add delay to the tooltip card appearing below the highlight
            tooltipTimerRef.current = setTimeout(() => {
              setShowTooltipCard(true);
            }, 380);
          },
        );
      }, 450);
    }, 200);
  };

  useEffect(() => {
    if (highlightDailyTasks === 'true' && !loading) {
      if (hasTriggeredHighlight.current) return;
      hasTriggeredHighlight.current = true;
      triggerDailyTasksHighlight(
        'Finish your daily tasks here not to lose your streak',
      );
    } else if (highlightDailyTasks !== 'true') {
      hasTriggeredHighlight.current = false;
    }
  }, [highlightDailyTasks, loading, insets.top]);

  useFocusEffect(
    useCallback(() => {
      if (highlightDailyTasks === 'true' && !loading) {
        hasTriggeredHighlight.current = true;
        triggerDailyTasksHighlight(
          'Finish your daily tasks here not to lose your streak',
        );
      }
    }, [highlightDailyTasks, loading])
  );

  const handleDismissHighlight = () => {
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
    setShowTooltipCard(false);
    setIsHighlighting(false);
    hasTriggeredHighlight.current = false;
    router.setParams({ highlightDailyTasks: '' });
  };

  // Challenge subtab cross-fade: displayActiveTab lags behind activeTab during fade
  const [displayActiveTab, setDisplayActiveTab] = useState<
    'all' | 'active' | 'history'
  >('all');
  const tabFadeOpacity = useSharedValue(1);
  const tabFadeStyle = useAnimatedStyle(() => ({
    opacity: tabFadeOpacity.value,
  }));

  useEffect(() => {
    if (displayActiveTab === activeTab) return;
    tabFadeOpacity.value = withTiming(
      0,
      { duration: 130, easing: Easing.out(Easing.ease) },
      (done) => {
        if (done) {
          runOnJS(setDisplayActiveTab)(activeTab);
          tabFadeOpacity.value = withTiming(1, {
            duration: 220,
            easing: Easing.out(Easing.ease),
          });
        }
      },
    );
  }, [activeTab]);

  // Bottom Sheet Animation state
  const SCREEN_HEIGHT = Dimensions.get('window').height;
  const sheetAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const panY = useRef(new Animated.Value(0)).current;

  // Task Details Bottom Sheet Drawer Animation state
  const [selectedTask, setSelectedTask] = useState<Habit | null>(null);
  const [showTaskDetailsModal, setShowTaskDetailsModal] = useState(false);
  const taskSheetAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const taskFadeAnim = useRef(new Animated.Value(0)).current;

  const openTaskDrawer = (habit: Habit) => {
    setSelectedTask(habit);
    setShowTaskDetailsModal(true);
    taskSheetAnim.setValue(SCREEN_HEIGHT);
    taskFadeAnim.setValue(0);

    Animated.parallel([
      Animated.timing(taskFadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.spring(taskSheetAnim, {
        toValue: 0,
        damping: 24,
        stiffness: 180,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeTaskDrawer = () => {
    Animated.parallel([
      Animated.timing(taskFadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(taskSheetAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowTaskDetailsModal(false);
      setSelectedTask(null);
    });
  };

  const openSheet = () => {
    setShowDetailsModal(true);
    Animated.spring(sheetAnim, {
      toValue: 0,
      useNativeDriver: true,
      damping: 20,
      stiffness: 150,
    }).start();
  };

  const closeSheet = () => {
    Animated.timing(sheetAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setShowDetailsModal(false);
      panY.setValue(0);
    });
  };

  const getTaskVisuals = (habit: Habit) => {
    const name = (habit.name || '').toLowerCase();
    const cat = (habit.category || '').toLowerCase();

    if (
      name.includes('water') ||
      name.includes('hydrat') ||
      name.includes('drink') ||
      cat.includes('water') ||
      cat.includes('hydrat')
    ) {
      return {
        icon: <Droplets size={22} color="#0284C7" />,
        color: '#0284C7',
        category: 'Hydration',
      };
    }
    if (
      name.includes('step') ||
      name.includes('walk') ||
      name.includes('run') ||
      name.includes('jog') ||
      cat.includes('step') ||
      cat.includes('walk')
    ) {
      return {
        icon: <Footprints size={22} color="#8B5CF6" />,
        color: '#8B5CF6',
        category: 'Steps & Walking',
      };
    }
    if (
      name.includes('workout') ||
      name.includes('gym') ||
      name.includes('lift') ||
      name.includes('train') ||
      name.includes('exercise') ||
      cat.includes('fitness') ||
      cat.includes('workout')
    ) {
      return {
        icon: <Dumbbell size={22} color="#EC4899" />,
        color: '#EC4899',
        category: 'Workout',
      };
    }
    if (
      name.includes('meal') ||
      name.includes('food') ||
      name.includes('protein') ||
      name.includes('eat') ||
      cat.includes('nutrition')
    ) {
      return {
        icon: <Apple size={22} color="#10B981" />,
        color: '#10B981',
        category: 'Nutrition',
      };
    }
    if (
      name.includes('sleep') ||
      name.includes('rest') ||
      name.includes('bed') ||
      name.includes('nap') ||
      cat.includes('sleep')
    ) {
      return {
        icon: <Moon size={22} color="#6366F1" />,
        color: '#6366F1',
        category: 'Sleep & Recovery',
      };
    }
    if (habit.verification_type === 'camera') {
      return {
        icon: <Camera size={22} color="#F97316" />,
        color: '#F97316',
        category: 'Photo Task',
      };
    }

    return {
      icon: <Target size={22} color={theme.colors.primary} />,
      color: theme.colors.primary,
      category: habit.category
        ? habit.category.charAt(0).toUpperCase() + habit.category.slice(1)
        : 'Daily Task',
    };
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => gs.dy > 10,
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) {
          panY.setValue(gs.dy);
        }
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 150 || gs.vy > 0.5) {
          closeSheet();
        } else {
          Animated.spring(panY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    }),
  ).current;

  useEffect(() => {
    if (client) {
      loadActivityData();
    }
  }, [client, selectedDate]);

  // Ensure data is fresh when user navigates back to this tab
  useFocusEffect(
    useCallback(() => {
      if (client) loadActivityData();
    }, [client, selectedDate]),
  );

  // Real-time listener for all activity data updates
  useEffect(() => {
    if (!client) return;

    const channelId = `activity-realtime-${client.id}`;
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sub_challenges' },
        () => loadActivityData(),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'meals',
          filter: `client_id=eq.${client.id}`,
        },
        () => loadActivityData(),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workouts',
          filter: `client_id=eq.${client.id}`,
        },
        () => loadActivityData(),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'habit_logs',
          filter: `client_id=eq.${client.id}`,
        },
        () => loadActivityData(),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'habits',
          filter: `client_id=eq.${client.id}`,
        },
        () => loadActivityData(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [client]);

  const loadActivityData = async () => {
    try {
      if (!refreshing) setLoading(true);
      const [
        mealsResult,
        workoutsResult,
        habitsResult,
        logsResult,
        sessionsResult,
        activeResult,
        completedResult,
        failedResult,
      ] = await Promise.all([
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
        supabase
          .from('sessions')
          .select('id, status, scheduled_at')
          .eq('client_id', client?.id)
          .lte('scheduled_at', new Date().toISOString()),
        supabase.rpc('get_client_mother_challenges', {
          p_client_id: client?.id,
          p_status: 'active',
        }),
        supabase.rpc('get_client_mother_challenges', {
          p_client_id: client?.id,
          p_status: 'completed',
        }),
        supabase.rpc('get_client_mother_challenges', {
          p_client_id: client?.id,
          p_status: 'failed',
        }),
      ]);

      if (mealsResult.error) throw mealsResult.error;
      if (workoutsResult.error) throw workoutsResult.error;
      if (habitsResult.error) throw habitsResult.error;
      if (logsResult.error) throw logsResult.error;
      if (sessionsResult.error) throw sessionsResult.error;

      setMeals(mealsResult.data || []);
      setWorkouts(workoutsResult.data || []);
      setHabits(habitsResult.data || []);
      const logs = logsResult.data || [];
      setHabitLogs(logs);

      const allSessions = sessionsResult.data || [];
      const validSessions = allSessions.filter(
        (s: any) => s.status !== 'cancelled' && s.status !== 'postponed',
      );
      setSessionsTotal(validSessions.length);
      setSessionsTaken(
        validSessions.filter((s: any) => s.status === 'completed').length,
      );

      const combinedMotherChallenges = [
        ...(activeResult?.data || []),
        ...(completedResult?.data || []),
        ...(failedResult?.data || []),
      ].sort(
        (a, b) =>
          new Date(b.start_date).getTime() - new Date(a.start_date).getTime(),
      );

      setMotherChallenges(combinedMotherChallenges);

      // Get sub-challenges via RPC
      const { data: subsData, error: subsError } = await supabase.rpc(
        'get_todays_sub_challenges',
        {
          p_client_id: client?.id,
          p_date: selectedDate,
        },
      );

      if (subsError) {
        console.error('Error loading challenges:', subsError);
      }

      setChallenges(subsData || []);

      // ─── Streak & Cold Streak Calculation (2-Consecutive-Miss Rule) ───
      const todayStr = getLocalDateString();
      const yesterdayStr = getPastLocalDateString(1);
      const dayBeforeYesterdayStr = getPastLocalDateString(2);

      const activeHabitsList = habitsResult.data || [];

      // Query past completed habit logs
      const { data: pastHabitLogs } = await supabase
        .from('habit_logs')
        .select('date, habit_id, completed')
        .eq('client_id', client?.id)
        .gte('date', getPastLocalDateString(90))
        .eq('completed', true);

      // Helper: check if all active habits created on or before dateStr were completed
      const isDateCompleted = (dateStr: string) => {
        const habitsForDate = activeHabitsList.filter((h: any) => {
          const createdDate = h.created_at
            ? h.created_at.split('T')[0]
            : '2000-01-01';
          return createdDate <= dateStr;
        });
        if (habitsForDate.length === 0) return false;
        return habitsForDate.every((h: any) => {
          return pastHabitLogs?.some(
            (l) => l.habit_id === h.id && l.date === dateStr && l.completed,
          );
        });
      };

      const isTodayDone = isDateCompleted(todayStr);
      const isYesterdayDone = isDateCompleted(yesterdayStr);
      const isDayBeforeYesterdayDone = isDateCompleted(dayBeforeYesterdayStr);

      let computedStreak = 0;
      let coldStatus = false;
      let streakLostStatus = false;

      if (activeHabitsList.length > 0) {
        if (isYesterdayDone) {
          // Yesterday was completed -> normal active streak
          coldStatus = false;
          let count = isTodayDone ? 1 : 0;
          let daysAgo = 1;
          let consecutiveMiss = 0;
          while (daysAgo <= 90) {
            const dStr = getPastLocalDateString(daysAgo);
            if (isDateCompleted(dStr)) {
              count += 1;
              consecutiveMiss = 0;
            } else {
              consecutiveMiss += 1;
              if (consecutiveMiss >= 2) break; // 2 consecutive misses break streak
            }
            daysAgo += 1;
          }
          computedStreak = count;
        } else {
          // Yesterday was MISSED!
          if (!isDayBeforeYesterdayDone) {
            // Day before yesterday was ALSO missed -> 2 consecutive missed days!
            // Streak is lost!
            computedStreak = isTodayDone ? 1 : 0;
            coldStatus = false;
            if (pastHabitLogs && pastHabitLogs.length > 0) {
              streakLostStatus = true;
            }
          } else {
            // Day before yesterday was completed -> Only 1 missed day! Streak preserved in cold state
            let count = isTodayDone ? 1 : 0;
            let daysAgo = 2; // count starting from day before yesterday
            let consecutiveMiss = 0;
            while (daysAgo <= 90) {
              const dStr = getPastLocalDateString(daysAgo);
              if (isDateCompleted(dStr)) {
                count += 1;
                consecutiveMiss = 0;
              } else {
                consecutiveMiss += 1;
                if (consecutiveMiss >= 2) break;
              }
              daysAgo += 1;
            }
            computedStreak = count;

            if (!isTodayDone && computedStreak > 0) {
              coldStatus = true;
            } else {
              coldStatus = false;
            }
          }
        }
      }

      setStreak(computedStreak);
      setIsCold(coldStatus);

      // Show "Don't miss your streak" modal if 1 day was missed (cold streak)
      if (
        coldStatus &&
        computedStreak > 0 &&
        !coldStreakShownThisSession.current
      ) {
        const lastColdShown = await AsyncStorage.getItem(
          `cold_streak_popup_${client?.id}_${todayStr}`,
        );
        if (!lastColdShown) {
          setShowColdStreak(true);
          coldStreakShownThisSession.current = true;
        }
      }

      // Show "You lost your streaks" modal if 2 consecutive days were missed
      if (
        streakLostStatus &&
        computedStreak === 0 &&
        !streakLostShownThisSession.current
      ) {
        const lastShownDate = client?.streak_reset_acknowledged_date;
        if (lastShownDate !== todayStr) {
          setShowStreakLost(true);
          streakLostShownThisSession.current = true;
        } else {
          streakLostShownThisSession.current = true;
        }
      }

      // Initialize last reported status
      logs.forEach((log) => {
        lastReportedStatus.current[log.habit_id] = log.completed;
      });
    } catch (error) {
      console.error('Error loading activity:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const refreshStreak = async () => {
    try {
      if (!client?.id) return;
      const todayStr = getLocalDateString();
      const yesterdayStr = getPastLocalDateString(1);
      const dayBeforeYesterdayStr = getPastLocalDateString(2);

      const { data: pastHabitLogs } = await supabase
        .from('habit_logs')
        .select('date, habit_id, completed')
        .eq('client_id', client.id)
        .gte('date', getPastLocalDateString(90))
        .eq('completed', true);

      const activeHabitsList = habits;
      const isDateCompleted = (dateStr: string) => {
        const habitsForDate = activeHabitsList.filter((h: any) => {
          const createdDate = h.created_at
            ? h.created_at.split('T')[0]
            : '2000-01-01';
          return createdDate <= dateStr;
        });
        if (habitsForDate.length === 0) return false;
        return habitsForDate.every((h: any) => {
          return pastHabitLogs?.some(
            (l) => l.habit_id === h.id && l.date === dateStr && l.completed,
          );
        });
      };

      const isTodayDone = isDateCompleted(todayStr);
      const isYesterdayDone = isDateCompleted(yesterdayStr);
      const isDayBeforeYesterdayDone = isDateCompleted(dayBeforeYesterdayStr);

      let computedStreak = 0;
      let coldStatus = false;

      if (activeHabitsList.length > 0) {
        if (isYesterdayDone) {
          coldStatus = false;
          let count = isTodayDone ? 1 : 0;
          let daysAgo = 1;
          let consecutiveMiss = 0;
          while (daysAgo <= 90) {
            const dStr = getPastLocalDateString(daysAgo);
            if (isDateCompleted(dStr)) {
              count += 1;
              consecutiveMiss = 0;
            } else {
              consecutiveMiss += 1;
              if (consecutiveMiss >= 2) break;
            }
            daysAgo += 1;
          }
          computedStreak = count;
        } else if (isDayBeforeYesterdayDone) {
          let count = isTodayDone ? 1 : 0;
          let daysAgo = 2;
          let consecutiveMiss = 0;
          while (daysAgo <= 90) {
            const dStr = getPastLocalDateString(daysAgo);
            if (isDateCompleted(dStr)) {
              count += 1;
              consecutiveMiss = 0;
            } else {
              consecutiveMiss += 1;
              if (consecutiveMiss >= 2) break;
            }
            daysAgo += 1;
          }
          computedStreak = count;
          coldStatus = !isTodayDone && computedStreak > 0;
        } else {
          computedStreak = isTodayDone ? 1 : 0;
          coldStatus = false;
        }
      }

      setStreak(computedStreak);
      setIsCold(coldStatus);
    } catch (e) {
      console.error('Error in refreshStreak:', e);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadActivityData();
  };

  const handleDismissColdStreak = async () => {
    setShowColdStreak(false);
    coldStreakShownThisSession.current = true;
    try {
      if (client?.id) {
        const todayStr = getLocalDateString();
        await AsyncStorage.setItem(
          `cold_streak_popup_${client.id}_${todayStr}`,
          'true',
        );
      }
    } catch (e) {
      console.error('Error saving cold streak acknowledged:', e);
    }
    triggerDailyTasksHighlight(
      'Finish your daily tasks here not to lose your streak',
    );
  };

  const handleDismissStreakLost = async () => {
    setShowStreakLost(false);
    streakLostShownThisSession.current = true;
    try {
      if (client?.id) {
        const todayStr = getLocalDateString();
        const { error } = await supabase
          .from('clients')
          .update({ streak_reset_acknowledged_date: todayStr })
          .eq('id', client.id);

        if (error) throw error;
        await refreshProfile();
      }
    } catch (e) {
      console.error('Error saving streak lost modal shown date:', e);
    }
    triggerDailyTasksHighlight(
      'Finish your daily tasks here not to lose your streak',
    );
  };

  const handleOpenDetails = (challenge: any) => {
    setSelectedChallenge(challenge);
    openSheet();
  };

  const handleToggleChallenge = async (challenge: any) => {
    try {
      const newCompleted = !challenge.completed;

      // Optimistic update
      setChallenges((prev) =>
        prev.map((c) =>
          c.id === challenge.id ? { ...c, completed: newCompleted } : c,
        ),
      );

      // Update via RPC
      const { error } = await supabase.rpc('mark_sub_challenge', {
        p_sub_challenge_id: challenge.id,
        p_client_id: client?.id,
        p_completed: newCompleted,
      });

      if (error) throw error;

      // Update local state for immediate feedback
      const updatedChallenges = challenges.map((c) =>
        c.id === challenge.id ? { ...c, completed: newCompleted } : c,
      );
      setChallenges(updatedChallenges);

      // Close sheet if it's open (usually after toggle)
      if (showDetailsModal) closeSheet();

      // Check for total daily completion
      if (newCompleted) {
        const allHabitsDone =
          habits.length === 0 ||
          habits.every(
            (h) => habitLogs.find((l) => l.habit_id === h.id)?.completed,
          );
        const otherChallengesDone = updatedChallenges
          .filter((c) => c.id !== challenge.id)
          .every((c) => c.completed);
        const allChallengesNowDone = updatedChallenges.every(
          (c) => c.completed,
        );

        if (allHabitsDone && otherChallengesDone) {
          setShowStreakGained(true);
          setIsCold(false);
          setStreak((prev) => prev + 1); // Optimistic streak update
        } else {
          // If not all done, just show the challenge success modal
          setCompletedChallengeName(challenge.name);
          setAllChallengesFinished(allChallengesNowDone);
          setShowChallengeSuccessModal(true);
        }
        refreshStreak();
      } else {
        refreshStreak();
      }

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
                completedAt: new Date().toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true,
                }),
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
      Object.values(timeoutRefs.current).forEach((timeout) =>
        clearTimeout(timeout),
      );
    };
  }, []);

  const sendCompletionMessage = async (
    habitName: string,
    isCompletion: boolean,
    imageUrl?: string,
    description?: string,
  ) => {
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
          ai_generated: true,
          message_type: 'system',
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
      const permissionResult =
        await ImagePicker.requestCameraPermissionsAsync();

      if (permissionResult.granted === false) {
        Alert.alert(
          'Permission Required',
          'You need to allow camera access to verify this challenge.',
        );
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

        const {
          data: { publicUrl },
        } = supabase.storage.from('habit-verifications').getPublicUrl(filePath);

        const today = getLocalDateString();
        const { data, error } = await supabase
          .from('habit_logs')
          .upsert(
            {
              client_id: client?.id,
              habit_id: habit.id,
              date: today,
              completed: true,
              image_url: publicUrl,
            },
            {
              onConflict: 'habit_id,date',
            },
          )
          .select()
          .single();

        if (error) throw error;

        // Update local state: replace existing log for this habit/date if it exists, otherwise add new
        const updatedLogs = habitLogs.find(
          (l) => l.habit_id === habit.id && l.date === today,
        )
          ? habitLogs.map((l) =>
              l.habit_id === habit.id && l.date === today ? data : l,
            )
          : [...habitLogs, data];

        setHabitLogs(updatedLogs);

        // Check for total daily completion
        const allHabitsDone = habits.every(
          (h) => updatedLogs.find((l) => l.habit_id === h.id)?.completed,
        );
        const allChallengesDone = challenges.every((c) => c.completed);

        if (allHabitsDone && (challenges.length === 0 || allChallengesDone)) {
          setShowStreakGained(true);
          setIsCold(false);
          setStreak((prev) => prev + 1); // Optimistic streak update
        }
        refreshStreak();

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
          // Delete the log entry for camera tasks to allow fresh resubmission
          const { error: deleteError } = await supabase
            .from('habit_logs')
            .delete()
            .eq('id', existingLog.id);

          if (deleteError) throw deleteError;

          setHabitLogs((prev) => prev.filter((l) => l.id !== existingLog.id));
          sendCompletionMessage(
            habit.name,
            false,
            undefined,
            habit.description,
          );
          return;
        } else {
          await handleCameraVerification(habit);
          return;
        }
      }

      const today = getLocalDateString();
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

        const updatedLogs = habitLogs.map((log) =>
          log.id === existingLog.id ? data : log,
        );
        setHabitLogs(updatedLogs);

        // Check for total daily completion
        if (newCompleted) {
          const allHabitsDone = habits.every(
            (h) => updatedLogs.find((l) => l.habit_id === h.id)?.completed,
          );
          const allChallengesDone = challenges.every((c) => c.completed);

          if (allHabitsDone && (challenges.length === 0 || allChallengesDone)) {
            setShowStreakGained(true);
            setIsCold(false);
            setStreak((prev) => prev + 1); // Optimistic streak update
          }
        }
        refreshStreak();
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

        const updatedLogs = [...habitLogs, data];
        setHabitLogs(updatedLogs);

        // Check for total daily completion
        const allHabitsDone = habits.every(
          (h) => updatedLogs.find((l) => l.habit_id === h.id)?.completed,
        );
        const allChallengesDone = challenges.every((c) => c.completed);

        if (allHabitsDone && (challenges.length === 0 || allChallengesDone)) {
          setShowStreakGained(true);
          setIsCold(false);
          setStreak((prev) => prev + 1); // Optimistic streak update
        }
        refreshStreak();
      }

      // Schedule message check
      timeoutRefs.current[habit.id] = setTimeout(() => {
        const lastStatus = lastReportedStatus.current[habit.id] ?? false;

        if (newCompleted !== lastStatus) {
          sendCompletionMessage(
            habit.name,
            newCompleted,
            undefined,
            habit.description,
          );
        }

        delete timeoutRefs.current[habit.id];
      }, 5000);
    } catch (error) {
      console.error('Error toggling habit:', error);
    }
  };

  const totalCalories = meals.reduce(
    (sum, meal) => sum + (meal.calories || 0),
    0,
  );
  const totalProtein = meals.reduce(
    (sum, meal) => sum + (meal.protein_g || 0),
    0,
  );
  const totalWorkoutMinutes = workouts.reduce(
    (sum, workout) => sum + (workout.duration_minutes || 0),
    0,
  );
  const completedHabits = habitLogs.filter((log) => log.completed).length;
  const activeChallengesCount = motherChallenges.filter((c) => {
    const isEnded =
      c.status !== 'active' ||
      new Date(c.end_date) < new Date(new Date().setHours(0, 0, 0, 0));
    return !isEnded;
  }).length;

  const formattedDate = new Date(selectedDate).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  if (loading && !refreshing) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
      />

      <View style={{ flex: 1, paddingTop: insets.top }}>
        {/* Header Section */}
        <View
          style={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 16 }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 8,
            }}
          >
            <View>
              <Text
                style={{ color: textColor, fontSize: 24, fontWeight: '900' }}
              >
                Your Progress
              </Text>
              <Text
                style={{
                  color: theme.colors.primary,
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  letterSpacing: 2,
                  fontSize: 10,
                  marginTop: 4,
                }}
              >
                {formattedDate}
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                triggerDailyTasksHighlight(
                  'Finish your daily tasks here not to lose your streak',
                );
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 999,
                backgroundColor: isDark
                  ? 'rgba(249, 115, 22, 0.12)'
                  : 'rgba(249, 115, 22, 0.08)',
                borderWidth: 1,
                borderColor: isDark
                  ? 'rgba(249, 115, 22, 0.3)'
                  : 'rgba(249, 115, 22, 0.25)',
              }}
            >
              <StreakFire
                variant={isCold ? 'cold' : streak > 0 ? 'active' : 'zero'}
                size={20}
              />
              <Text
                style={{
                  color: '#F97316',
                  fontSize: 15,
                  fontWeight: '900',
                }}
              >
                {formatCompactNumber(streak)}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          ref={scrollViewRef}
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 140 }}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.primary}
            />
          }
        >
          <View className="px-3">
            {/* Access Calendar CTA Card */}
            <AccessCalendarCard
              onPress={() => router.push('/(client)/schedule-timeline' as any)}
            />

            {/* Active Challenges Card */}
            <ActiveChallengesCard
              count={activeChallengesCount}
              onPress={() => router.push('/(client)/challenges' as any)}
            />

            {/* Summary Metric Grid */}
            <View className="flex-row flex-wrap justify-between gap-4 mb-4">
              <MetricCard
                label="Calories"
                value={totalCalories > 0 ? `${formatCompactNumber(totalCalories)} kcal` : '--'}
                icon={<Utensils size={20} color="#F59E0B" />}
                active={totalCalories > 0}
              />
              <MetricCard
                label="Protein"
                value={totalProtein > 0 ? `${formatCompactNumber(totalProtein)} g` : '--'}
                icon={<Target size={20} color="#818CF8" />}
                active={totalProtein > 0}
              />
              <MetricCard
                label="Tasks Done"
                value={`${completedHabits}/${habits.length}`}
                icon={<CheckCircle size={20} color="#10B981" />}
                active={completedHabits === habits.length && habits.length > 0}
                onPress={() => {
                  triggerDailyTasksHighlight(
                    'Finish your daily tasks here not to lose your streak',
                  );
                }}
              />
              <MetricCard
                label="Active Time"
                value={totalWorkoutMinutes > 0 ? `${totalWorkoutMinutes} min` : '0 min'}
                icon={<Clock size={20} color="#38BDF8" />}
                active={totalWorkoutMinutes > 0}
              />
            </View>

            {/* Activity Logs Section */}
            <View
              onLayout={(e) => {
                logsContainerYRef.current = e.nativeEvent.layout.y;
              }}
              style={{ paddingBottom: 24 }}
            >
            {/* Daily Tasks (Habits) Section */}
            <View
              ref={dailyTasksContainerRef}
              collapsable={false}
              onLayout={(e) => {
                dailyTasksLayoutRef.current = e.nativeEvent.layout;
              }}
            >
              <View style={{ marginBottom: 16, marginTop: 8, paddingHorizontal: 4 }}>
                <TouchableOpacity
                  onPress={() => toggleCategory('dailyTasks')}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                  activeOpacity={0.7}
                >
                  <AnimatedChevron expanded={expandedCategories.dailyTasks} />
                  <Text
                    style={{
                      color: textColor,
                      fontSize: 18,
                      fontWeight: '900',
                    }}
                  >
                    Daily Tasks
                  </Text>
                </TouchableOpacity>
              </View>
              <CollapsibleContent expanded={expandedCategories.dailyTasks}>
                <View style={{ marginBottom: 24 }}>
                  {habits.length === 0 ? (
                    <EmptyState message="No daily tasks established." />
                  ) : (
                    <View>
                      {habits.map((habit, idx) => {
                        const log = habitLogs.find(
                          (l) => l.habit_id === habit.id,
                        );
                        const isCompleted = log?.completed || false;
                        const visuals = getTaskVisuals(habit);
                        return (
                          <ActivityCard
                            key={habit.id}
                            title={habit.name}
                            sub={
                              (habit.category
                                ? `${habit.category.toUpperCase()} • `
                                : '') +
                              (habit.verification_type === 'camera'
                                ? 'Camera Verification Required'
                                : 'Manual Toggle')
                            }
                            completed={isCompleted}
                            icon={visuals.icon}
                            iconColor={visuals.color}
                            onPress={() => openTaskDrawer(habit)}
                            onToggle={() => toggleHabit(habit)}
                            delay={idx * 60}
                          />
                        );
                      })}
                    </View>
                  )}
                </View>
              </CollapsibleContent>
            </View>

            {/* Meals Section */}
            <View style={{ marginBottom: 16, marginTop: 8, paddingHorizontal: 4 }}>
              <TouchableOpacity
                onPress={() => toggleCategory('nutrition')}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                activeOpacity={0.7}
              >
                <AnimatedChevron expanded={expandedCategories.nutrition} />
                <Text
                  style={{ color: textColor, fontSize: 18, fontWeight: '900' }}
                >
                  Nutrition
                </Text>
              </TouchableOpacity>
            </View>
            <CollapsibleContent expanded={expandedCategories.nutrition}>
              <View style={{ marginBottom: 24 }}>
                {meals.length === 0 ? (
                  <EmptyState message="No meals tracked for today." />
                ) : (
                  <View style={{ gap: 12 }}>
                    {meals.map((meal, idx) => (
                      <ActivityCard
                        key={meal.id}
                        title={meal.name}
                        sub={`${meal.meal_type.toUpperCase()} • ${formatCompactNumber(meal.calories || 0)} kcal`}
                        completed={true}
                        icon={<Utensils size={20} color="#F59E0B" />}
                        readOnly
                        delay={idx * 60}
                      />
                    ))}
                  </View>
                )}
              </View>
            </CollapsibleContent>

            {/* Workouts Section */}
            <View style={{ marginBottom: 16, marginTop: 8, paddingHorizontal: 4 }}>
              <TouchableOpacity
                onPress={() => toggleCategory('performance')}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                activeOpacity={0.7}
              >
                <AnimatedChevron expanded={expandedCategories.performance} />
                <Text
                  style={{ color: textColor, fontSize: 18, fontWeight: '900' }}
                >
                  Performance
                </Text>
              </TouchableOpacity>
            </View>
            <CollapsibleContent expanded={expandedCategories.performance}>
              <View style={{ marginBottom: 24 }}>
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
                        icon={<Dumbbell size={20} color="#8B5CF6" />}
                        readOnly
                        delay={idx * 60}
                      />
                    ))}
                  </View>
                )}
              </View>
            </CollapsibleContent>
          </View>
        </View>
      </ScrollView>
      </View>

      {/* Streak Gained — Congratulations popup when finishing daily tasks */}
      <FeedbackModal
        visible={showStreakGained}
        onClose={() => setShowStreakGained(false)}
        variant="warning"
        accentColor="#F97316"
        accentBg="rgba(249, 115, 22, 0.12)"
        accentBorder="rgba(249, 115, 22, 0.28)"
        icon={<StreakFire variant="active" size={72} />}
        title="Streak gained!"
        body="You finished today's tasks. Keep your streak alive!"
        statLabel="Current Streak"
        statIcon={<StreakFire variant="active" size={32} />}
        stat={`${formatCompactNumber(streak)}`}
        ctaLabel="Keep going"
        ctaBg={theme.colors.primary}
      />

      {/* Don't miss your streak — Cold Streak (1 missed day) */}
      <FeedbackModal
        visible={showColdStreak}
        onClose={handleDismissColdStreak}
        variant="cold"
        accentColor="#38BDF8"
        accentBg="rgba(56, 189, 248, 0.12)"
        accentBorder="rgba(56, 189, 248, 0.28)"
        icon={<StreakFire variant="cold" size={72} />}
        title="Don't miss your streak"
        body="You missed yesterday. Finish today's tasks to keep your streak."
        statLabel="Current Streak"
        statIcon={<StreakFire variant="cold" size={32} />}
        stat={`${formatCompactNumber(streak)}`}
        ctaLabel="Start your task"
        ctaBg={theme.colors.primary}
      />

      {/* Streak lost — 2 consecutive missed days */}
      <FeedbackModal
        visible={showStreakLost}
        onClose={handleDismissStreakLost}
        variant="warning"
        accentColor={theme.colors.primary}
        accentBg={theme.colors.primary + '18'}
        accentBorder={theme.colors.primary + '33'}
        icon={<StreakFire variant="zero" size={72} />}
        title="You lost your streaks"
        body="You missed 2 days in a row. Finish today's tasks to start again."
        statLabel="Current Streak"
        statIcon={<StreakFire variant="zero" size={32} />}
        stat="0"
        ctaLabel="Start fresh today"
        ctaBg={theme.colors.primary}
      />

      {/* Individual Challenge Secured */}
      <FeedbackModal
        visible={showChallengeSuccessModal}
        onClose={() => setShowChallengeSuccessModal(false)}
        variant="success"
        icon={<Target size={52} color="#10B981" />}
        title="Objective Secured"
        body={
          allChallengesFinished
            ? `All challenges secured. Stay ready for ${(() => {
                const d = new Date();
                d.setDate(d.getDate() + 1);
                return d.toLocaleDateString('en-US', { weekday: 'long' });
              })()} — keep that energy up.`
            : `"${completedChallengeName}" has been successfully synchronized.`
        }
        ctaLabel="Continue Mission"
      />

      {/* Modern Details Overlay */}
      <Modal
        visible={showDetailsModal}
        transparent
        statusBarTranslucent
        animationType="none"
      >
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          {/* Backdrop */}
          <Animated.View
            style={{
              ...(StyleSheet.absoluteFill as any),
              backgroundColor: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.4)',
              opacity: sheetAnim.interpolate({
                inputRange: [0, SCREEN_HEIGHT],
                outputRange: [1, 0],
              }),
            }}
          >
            <TouchableOpacity
              activeOpacity={1}
              style={{ flex: 1 }}
              onPress={closeSheet}
            />
          </Animated.View>

          <Animated.View
            {...panResponder.panHandlers}
            style={{
              backgroundColor: cardBg,
              borderTopLeftRadius: 48,
              borderTopRightRadius: 48,
              padding: 32,
              borderTopWidth: 1,
              borderTopColor: cardBorder,
              maxHeight: '85%',
              paddingBottom: insets.bottom + 32,
              transform: [{ translateY: sheetAnim }, { translateY: panY }],
            }}
          >
            <View
              style={{
                width: 48,
                height: 6,
                backgroundColor: cardBorder,
                borderRadius: 3,
                alignSelf: 'center',
                marginBottom: 32,
              }}
            />

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 32,
              }}
            >
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
              >
                <View
                  style={{
                    width: 48,
                    height: 48,
                    backgroundColor: `${theme.colors.primary}1a`,
                    borderRadius: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: `${theme.colors.primary}33`,
                  }}
                >
                  <Sparkles size={24} color={theme.colors.primary} />
                </View>
                <View>
                  <Text
                    style={{
                      color: textColor,
                      fontSize: 24,
                      fontWeight: '900',
                    }}
                  >
                    {selectedChallenge?.name}
                  </Text>
                  <Text
                    style={{
                      color: textSecondaryColor,
                      fontSize: 10,
                      fontWeight: '900',
                      textTransform: 'uppercase',
                      letterSpacing: 1.5,
                    }}
                  >
                    Daily Goal
                  </Text>
                </View>
              </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {selectedChallenge && (
                <>
                  <View
                    style={{
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      gap: 8,
                      marginBottom: 32,
                    }}
                  >
                    <Badge label={selectedChallenge.focus_type} />
                    {selectedChallenge.intensity && (
                      <Badge
                        label={selectedChallenge.intensity}
                        color="border-orange-500/20 text-orange-500 bg-orange-500/5"
                      />
                    )}
                    <Badge
                      label="Daily Objective"
                      color="border-green-500/20 text-green-500 bg-green-500/5"
                    />
                  </View>

                  <Text
                    style={{
                      color: textSecondaryColor,
                      fontSize: 16,
                      lineHeight: 28,
                      fontWeight: '500',
                      marginBottom: 40,
                    }}
                  >
                    {selectedChallenge.description ||
                      'No detailed instructions provided for this challenge. Ensure you maintain proper form and stay hydrated.'}
                  </Text>

                  <TouchableOpacity
                    style={{
                      padding: 24,
                      borderRadius: 32,
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexDirection: 'row',
                      gap: 12,
                      backgroundColor: selectedChallenge.completed
                        ? isDark
                          ? '#1e293b'
                          : '#E2E8F0'
                        : theme.colors.primary,
                    }}
                    onPress={() => {
                      handleToggleChallenge(selectedChallenge);
                    }}
                  >
                    {selectedChallenge.completed ? (
                      <>
                        <X size={20} color={textSecondaryColor} />
                        <Text
                          style={{
                            color: textSecondaryColor,
                            fontWeight: '900',
                            textTransform: 'uppercase',
                            letterSpacing: 2,
                            fontSize: 14,
                          }}
                        >
                          Remove Completion
                        </Text>
                      </>
                    ) : (
                      <>
                        <CheckCircle
                          size={20}
                          color={getContrastColor(theme.colors.primary)}
                        />
                        <Text
                          style={{
                            color: getContrastColor(theme.colors.primary),
                            fontWeight: '900',
                            textTransform: 'uppercase',
                            letterSpacing: 2,
                            fontSize: 14,
                          }}
                        >
                          Confirm Completion
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>

      {/* Modern Task Details Slider Drawer */}
      <Modal
        visible={showTaskDetailsModal}
        transparent
        statusBarTranslucent
        animationType="none"
        onRequestClose={closeTaskDrawer}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          {/* Dimmed backdrop fades in/out without sliding */}
          <Animated.View
            style={{
              ...(StyleSheet.absoluteFill as any),
              backgroundColor: isDark
                ? 'rgba(0,0,0,0.75)'
                : 'rgba(15, 23, 42, 0.6)',
              opacity: taskFadeAnim,
            }}
          >
            <TouchableWithoutFeedback onPress={closeTaskDrawer}>
              <View style={{ flex: 1 }} />
            </TouchableWithoutFeedback>
          </Animated.View>

          {/* Slider Drawer slides up from bottom to middle */}
          <Animated.View
            style={{
              backgroundColor: cardBg,
              borderTopLeftRadius: 40,
              borderTopRightRadius: 40,
              paddingTop: 16,
              paddingHorizontal: 24,
              paddingBottom: insets.bottom + 24,
              borderTopWidth: 1,
              borderTopColor: colors.primary + (isDark ? '33' : '20'),
              maxHeight: '75%',
              transform: [{ translateY: taskSheetAnim }],
              shadowColor: isDark ? '#000000' : colors.primary,
              shadowOffset: { width: 0, height: -10 },
              shadowOpacity: isDark ? 0.5 : 0.15,
              shadowRadius: 25,
              elevation: 25,
            }}
          >
            {/* Drag handle pill */}
            <View
              style={{
                width: 44,
                height: 5,
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.2)'
                  : 'rgba(0,0,0,0.15)',
                borderRadius: 3,
                alignSelf: 'center',
                marginBottom: 20,
              }}
            />

            {selectedTask && (() => {
              const visuals = getTaskVisuals(selectedTask);
              const log = habitLogs.find((l) => l.habit_id === selectedTask.id);
              const isDone = log?.completed || false;

              return (
                <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
                  {/* Header */}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 20,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 14,
                        flex: 1,
                      }}
                    >
                      <View
                        style={{
                          width: 54,
                          height: 54,
                          borderRadius: 20,
                          backgroundColor: `${visuals.color}18`,
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderWidth: 1,
                          borderColor: `${visuals.color}33`,
                        }}
                      >
                        {visuals.icon}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            color: visuals.color,
                            fontSize: 10,
                            fontWeight: '900',
                            textTransform: 'uppercase',
                            letterSpacing: 1.5,
                            marginBottom: 4,
                          }}
                        >
                          {visuals.category}
                        </Text>
                        <Text
                          style={{
                            color: textColor,
                            fontSize: 22,
                            fontWeight: '900',
                            letterSpacing: -0.4,
                          }}
                          numberOfLines={2}
                        >
                          {selectedTask.name}
                        </Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      onPress={closeTaskDrawer}
                      activeOpacity={0.7}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: isDark
                          ? 'rgba(255,255,255,0.08)'
                          : 'rgba(0,0,0,0.05)',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginLeft: 8,
                      }}
                    >
                      <X size={18} color={textSecondaryColor} />
                    </TouchableOpacity>
                  </View>

                  {/* Status Banner */}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      padding: 16,
                      borderRadius: 20,
                      backgroundColor: isDone
                        ? 'rgba(16, 185, 129, 0.10)'
                        : `${colors.primary}10`,
                      borderWidth: 1,
                      borderColor: isDone
                        ? 'rgba(16, 185, 129, 0.28)'
                        : `${colors.primary}25`,
                      marginBottom: 16,
                      gap: 12,
                    }}
                  >
                    <View
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        backgroundColor: isDone ? '#10B981' : colors.primary,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {isDone ? (
                        <CheckCircle size={18} color="#FFFFFF" />
                      ) : (
                        <Circle size={18} color="#FFFFFF" />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          color: isDone ? '#10B981' : colors.primary,
                          fontSize: 14,
                          fontWeight: '900',
                        }}
                      >
                        {isDone ? 'Finished for Today' : 'Ready to Complete'}
                      </Text>
                      <Text
                        style={{
                          color: textSecondaryColor,
                          fontSize: 12,
                          fontWeight: '500',
                          marginTop: 2,
                        }}
                      >
                        {isDone
                          ? 'This task is counted toward your active streak.'
                          : 'Complete this task today to keep your streak alive.'}
                      </Text>
                    </View>
                  </View>

                  {/* Visual Info Badges */}
                  <View
                    style={{
                      flexDirection: 'row',
                      gap: 10,
                      marginBottom: 16,
                    }}
                  >
                    <View
                      style={{
                        flex: 1,
                        backgroundColor: isDark
                          ? 'rgba(255,255,255,0.04)'
                          : 'rgba(0,0,0,0.02)',
                        borderRadius: 18,
                        padding: 14,
                        borderWidth: 1,
                        borderColor: cardBorder,
                      }}
                    >
                      <Text
                        style={{
                          color: textSecondaryColor,
                          fontSize: 9,
                          fontWeight: '800',
                          textTransform: 'uppercase',
                          letterSpacing: 1.2,
                          marginBottom: 4,
                        }}
                      >
                        Goal
                      </Text>
                      <Text
                        style={{
                          color: textColor,
                          fontSize: 14,
                          fontWeight: '800',
                        }}
                        numberOfLines={1}
                      >
                        {selectedTask.target_value
                          ? `${selectedTask.target_value} ${selectedTask.unit || ''}`
                          : 'Daily'}
                      </Text>
                    </View>

                    <View
                      style={{
                        flex: 1,
                        backgroundColor: isDark
                          ? 'rgba(255,255,255,0.04)'
                          : 'rgba(0,0,0,0.02)',
                        borderRadius: 18,
                        padding: 14,
                        borderWidth: 1,
                        borderColor: cardBorder,
                      }}
                    >
                      <Text
                        style={{
                          color: textSecondaryColor,
                          fontSize: 9,
                          fontWeight: '800',
                          textTransform: 'uppercase',
                          letterSpacing: 1.2,
                          marginBottom: 4,
                        }}
                      >
                        Frequency
                      </Text>
                      <Text
                        style={{
                          color: textColor,
                          fontSize: 14,
                          fontWeight: '800',
                        }}
                        numberOfLines={1}
                      >
                        {selectedTask.frequency
                          ? selectedTask.frequency.charAt(0).toUpperCase() +
                            selectedTask.frequency.slice(1)
                          : 'Everyday'}
                      </Text>
                    </View>

                    <View
                      style={{
                        flex: 1,
                        backgroundColor: isDark
                          ? 'rgba(255,255,255,0.04)'
                          : 'rgba(0,0,0,0.02)',
                        borderRadius: 18,
                        padding: 14,
                        borderWidth: 1,
                        borderColor: cardBorder,
                      }}
                    >
                      <Text
                        style={{
                          color: textSecondaryColor,
                          fontSize: 9,
                          fontWeight: '800',
                          textTransform: 'uppercase',
                          letterSpacing: 1.2,
                          marginBottom: 4,
                        }}
                      >
                        Method
                      </Text>
                      <Text
                        style={{
                          color: textColor,
                          fontSize: 14,
                          fontWeight: '800',
                        }}
                        numberOfLines={1}
                      >
                        {selectedTask.verification_type === 'camera'
                          ? 'Camera'
                          : 'One-Tap'}
                      </Text>
                    </View>
                  </View>

                  {/* Instructions */}
                  <View
                    style={{
                      backgroundColor: isDark
                        ? 'rgba(255,255,255,0.03)'
                        : 'rgba(0,0,0,0.02)',
                      borderRadius: 20,
                      padding: 16,
                      borderWidth: 1,
                      borderColor: cardBorder,
                      marginBottom: 20,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 8,
                      }}
                    >
                      <Sparkles size={14} color={colors.primary} />
                      <Text
                        style={{
                          color: colors.primary,
                          fontSize: 11,
                          fontWeight: '900',
                          textTransform: 'uppercase',
                          letterSpacing: 1,
                        }}
                      >
                        Instructions
                      </Text>
                    </View>
                    <Text
                      style={{
                        color: textSecondaryColor,
                        fontSize: 14,
                        lineHeight: 22,
                        fontWeight: '500',
                      }}
                    >
                      {selectedTask.description ||
                        (selectedTask.verification_type === 'camera'
                          ? 'Take a photo of your task to verify it and send a completion update to your coach.'
                          : 'Tap the button below once you have finished this task today.')}
                    </Text>

                    {log?.proof_url && (
                      <View style={{ marginTop: 14 }}>
                        <Text
                          style={{
                            color: textColor,
                            fontSize: 12,
                            fontWeight: '800',
                            marginBottom: 8,
                          }}
                        >
                          Verified Proof
                        </Text>
                        <Image
                          source={{ uri: log.proof_url }}
                          style={{
                            width: '100%',
                            height: 160,
                            borderRadius: 14,
                            backgroundColor: cardBorder,
                          }}
                          resizeMode="cover"
                        />
                      </View>
                    )}
                  </View>

                  {/* Complete Button */}
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => {
                      if (
                        selectedTask.verification_type === 'camera' &&
                        !isDone
                      ) {
                        closeTaskDrawer();
                        setTimeout(() => {
                          handleCameraVerification(selectedTask);
                        }, 300);
                      } else {
                        toggleHabit(selectedTask);
                        closeTaskDrawer();
                      }
                    }}
                    style={{
                      backgroundColor: isDone
                        ? isDark
                          ? '#1E293B'
                          : '#E2E8F0'
                        : colors.primary,
                      borderRadius: 20,
                      paddingVertical: 16,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 10,
                      shadowColor: isDone ? 'transparent' : colors.primary,
                      shadowOffset: { width: 0, height: 6 },
                      shadowOpacity: isDone ? 0 : 0.35,
                      shadowRadius: 12,
                      elevation: isDone ? 0 : 6,
                    }}
                  >
                    {isDone ? (
                      <>
                        <CheckCircle size={20} color={textColor} />
                        <Text
                          style={{
                            color: textColor,
                            fontSize: 15,
                            fontWeight: '800',
                            textTransform: 'uppercase',
                            letterSpacing: 0.8,
                          }}
                        >
                          Completed • Tap to Undo
                        </Text>
                      </>
                    ) : selectedTask.verification_type === 'camera' ? (
                      <>
                        <Camera
                          size={20}
                          color={getContrastColor(colors.primary)}
                        />
                        <Text
                          style={{
                            color: getContrastColor(colors.primary),
                            fontSize: 15,
                            fontWeight: '800',
                            textTransform: 'uppercase',
                            letterSpacing: 0.8,
                          }}
                        >
                          Verify with Camera
                        </Text>
                      </>
                    ) : (
                      <>
                        <CheckCircle
                          size={20}
                          color={getContrastColor(colors.primary)}
                        />
                        <Text
                          style={{
                            color: getContrastColor(colors.primary),
                            fontSize: 15,
                            fontWeight: '800',
                            textTransform: 'uppercase',
                            letterSpacing: 0.8,
                          }}
                        >
                          Mark as Done
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </ScrollView>
              );
            })()}
          </Animated.View>
        </View>
      </Modal>

      {/* Daily Tasks Spotlight Highlight Overlay */}
      {isHighlighting && highlightLayout && (
        <Modal
          visible={isHighlighting}
          transparent
          animationType="fade"
          statusBarTranslucent
          onRequestClose={handleDismissHighlight}
        >
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            {/* Dimmed Background Overlay with Rounded Cutout */}
            <TouchableWithoutFeedback onPress={handleDismissHighlight}>
              <View style={StyleSheet.absoluteFill}>
                <Svg
                  width={Dimensions.get('window').width}
                  height={Dimensions.get('window').height}
                  style={StyleSheet.absoluteFill}
                >
                  <Path
                    d={getSpotlightPath(
                      Dimensions.get('window').width,
                      Dimensions.get('window').height,
                      highlightLayout.x,
                      highlightLayout.y,
                      highlightLayout.width,
                      highlightLayout.height,
                      36,
                    )}
                    fill={
                      isDark
                        ? 'rgba(2, 6, 23, 0.85)'
                        : 'rgba(15, 23, 42, 0.72)'
                    }
                    fillRule="evenodd"
                  />
                </Svg>
              </View>
            </TouchableWithoutFeedback>

            {/* Glowing Border Box surrounding Daily Tasks */}
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: highlightLayout.y,
                left: highlightLayout.x,
                width: highlightLayout.width,
                height: highlightLayout.height,
                borderRadius: 36,
                borderWidth: 2.5,
                borderColor: theme.colors.primary,
                shadowColor: theme.colors.primary,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.9,
                shadowRadius: 18,
                elevation: 12,
              }}
            />

            {/* Floating Toolbar with Explanatory Text & "Got It" Button */}
            {showTooltipCard && (
              <MotiView
                from={{ opacity: 0, translateY: 16, scale: 0.95 }}
                animate={{ opacity: 1, translateY: 0, scale: 1 }}
                transition={
                  { type: 'spring', damping: 18, stiffness: 140 } as any
                }
                style={{
                  position: 'absolute',
                  left: 20,
                  right: 20,
                  top:
                    highlightLayout.y + highlightLayout.height + 180 >
                    Dimensions.get('window').height - insets.bottom
                      ? Math.max(insets.top + 16, highlightLayout.y - 170)
                      : highlightLayout.y + highlightLayout.height + 16,
                  backgroundColor: cardBg,
                  borderRadius: 28,
                  padding: 22,
                  borderWidth: 1.5,
                  borderColor: colors.primary + (isDark ? '40' : '25'),
                  shadowColor: isDark ? '#000000' : colors.primary,
                  shadowOffset: { width: 0, height: 12 },
                  shadowOpacity: isDark ? 0.6 : 0.16,
                  shadowRadius: 24,
                  elevation: 20,
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    marginBottom: 12,
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: colors.primary + (isDark ? '25' : '15'),
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Target size={18} color={colors.primary} />
                  </View>
                  <Text
                    style={{
                      color: textColor,
                      fontSize: 17,
                      fontWeight: '900',
                      letterSpacing: -0.3,
                    }}
                  >
                    Daily Tasks
                  </Text>
                </View>

                {/* Animated description using BlurText */}
                <BlurText
                  text={
                    highlightTooltipText ||
                    'Finish your daily tasks here not to lose your streak'
                  }
                  effect="blur"
                  animateBy="words"
                  direction="top"
                  staggerFrom="start"
                  delay={70}
                  stepDuration={0.35}
                  distance={16}
                  color={textSecondaryColor}
                  style={{
                    fontSize: 14,
                    lineHeight: 21,
                    fontWeight: '600',
                    marginBottom: 18,
                  }}
                />

                <TouchableOpacity
                  onPress={handleDismissHighlight}
                  activeOpacity={0.85}
                  style={{
                    backgroundColor: colors.primary,
                    borderRadius: 18,
                    paddingVertical: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: colors.primary,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.35,
                    shadowRadius: 10,
                    elevation: 6,
                  }}
                >
                  <Text
                    style={{
                      color: getContrastColor(colors.primary),
                      fontSize: 14,
                      fontWeight: '800',
                      textTransform: 'uppercase',
                      letterSpacing: 1,
                    }}
                  >
                    Got It
                  </Text>
                </TouchableOpacity>
              </MotiView>
            )}
          </View>
        </Modal>
      )}
    </View>
  );
}

// Support Components
const CategorySummaryCard = ({
  title,
  icon,
  totalCount,
  completedCount,
  isExpanded,
  onPress,
  showProgressBar = true,
}: any) => {
  const percentage = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  const theme = useTheme();
  const colors = theme.colors;
  const isDark = isDarkColor(colors.background || '#020617');
  const cardBg = colors.surface || (isDark ? '#0f172a' : '#ffffff');
  const cardBorder =
    colors.border || (isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0');
  const textColor = colors.text || (isDark ? '#ffffff' : '#0f172a');
  const textSecondaryColor =
    colors.textSecondary || (isDark ? '#94a3b8' : '#64748b');

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={{
        backgroundColor: cardBg,
        borderRadius: 32,
        borderWidth: 1,
        borderColor: isExpanded ? `${colors.primary}33` : cardBorder,
        padding: 20,
        marginBottom: isExpanded ? 16 : 12,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 16,
            borderWidth: 1,
            backgroundColor: colors.background,
            borderColor: cardBorder,
          }}
        >
          {icon}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '900', color: textColor }}>
            {title}
          </Text>
          <Text
            style={{
              color: textSecondaryColor,
              fontSize: 10,
              fontWeight: '900',
              textTransform: 'uppercase',
              letterSpacing: 1.5,
              marginTop: 4,
            }}
          >
            {showProgressBar
              ? `${completedCount} / ${totalCount} COMPLETED`
              : `${totalCount} LOGGED`}
          </Text>
        </View>
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.background,
            borderWidth: 1,
            borderColor: cardBorder,
          }}
        >
          {isExpanded ? (
            <ChevronDown size={16} color={textSecondaryColor} />
          ) : (
            <ChevronRight size={16} color={textSecondaryColor} />
          )}
        </View>
      </View>

      {showProgressBar && totalCount > 0 && (
        <View
          style={{
            marginTop: 24,
            marginBottom: 4,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <View
            style={{
              flex: 1,
              height: 8,
              backgroundColor: isDark ? '#1e293b' : '#e2e8f0',
              borderRadius: 4,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                height: '100%',
                width: `${percentage}%`,
                backgroundColor: colors.primary,
                borderRadius: 4,
              }}
            />
          </View>
          <Text
            style={{
              color: textColor,
              fontSize: 12,
              fontWeight: '900',
              minWidth: 36,
              textAlign: 'right',
            }}
          >
            {Math.round(percentage)}%
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

// ─── Access Calendar CTA Card ───────────────────────────────────────────────
const AccessCalendarCard = ({ onPress }: { onPress: () => void }) => {
  const theme = useTheme();
  const colors = theme.colors;
  const primaryIsDark = isDarkColor(colors.primary);
  const primaryTextColor = primaryIsDark ? '#FFFFFF' : '#0F172A';
  const primaryTextMuted = primaryIsDark
    ? 'rgba(255, 255, 255, 0.8)'
    : 'rgba(15, 23, 42, 0.8)';
  const btnBg = primaryIsDark ? '#FFFFFF' : '#0F172A';
  const btnText = primaryIsDark ? colors.primary : '#FFFFFF';

  return (
    <MotiView
      key="calendar-access-cta"
      from={{ opacity: 0, translateY: -6 }}
      animate={{ opacity: 1, translateY: 0 }}
      style={{
        marginBottom: 16,
        borderRadius: 28,
        overflow: 'hidden',
        backgroundColor: colors.primary,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
        position: 'relative',
      }}
    >
      {/* Decorative background shapes matching check-in card */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: -24,
          right: -16,
          width: 120,
          height: 120,
          backgroundColor: 'rgba(255, 255, 255, 0.12)',
          borderRadius: 60,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          bottom: -24,
          left: -16,
          width: 90,
          height: 90,
          backgroundColor: 'rgba(0, 0, 0, 0.08)',
          borderRadius: 45,
        }}
      />

      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPress}
        style={{
          paddingHorizontal: 20,
          paddingVertical: 18,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 10,
        }}
      >
        <View style={{ flex: 1, marginRight: 12 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              marginBottom: 4,
            }}
          >
            <CalendarIcon size={13} color={primaryTextColor} />
            <Text
              style={{
                color: primaryTextMuted,
                fontSize: 10,
                fontWeight: '900',
                textTransform: 'uppercase',
                letterSpacing: 1.5,
              }}
            >
              Schedule
            </Text>
          </View>
          <Text
            style={{
              color: primaryTextColor,
              fontSize: 18,
              fontWeight: '900',
              letterSpacing: -0.3,
            }}
          >
            Access your calendar
          </Text>
        </View>

        <View
          style={{
            backgroundColor: btnBg,
            paddingHorizontal: 14,
            paddingVertical: 9,
            borderRadius: 9999,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            flexShrink: 0,
          }}
        >
          <Text
            style={{
              color: btnText,
              fontWeight: '900',
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            Check Calendar
          </Text>
          <ChevronRight size={13} color={btnText} />
        </View>
      </TouchableOpacity>
    </MotiView>
  );
};

// ─── Active Challenges Card ────────────────────────────────────────────────
const ActiveChallengesCard = ({
  count,
  onPress,
}: {
  count: number;
  onPress: () => void;
}) => {
  const theme = useTheme();
  const colors = theme.colors;
  const isDark = isDarkColor(colors.background || '#020617');
  const textColor = colors.text || (isDark ? '#FFFFFF' : '#0F172A');
  const textSecondaryColor =
    colors.textSecondary || (isDark ? '#94A3B8' : '#64748B');

  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (count > 0) {
      const loop = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 3500,
          easing: RNEasing.linear,
          useNativeDriver: true,
        }),
      );
      loop.start();
      return () => loop.stop();
    }
  }, [count]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  if (count === 0) {
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onPress}
        style={{
          backgroundColor: isDark
            ? 'rgba(255, 255, 255, 0.025)'
            : 'rgba(0, 0, 0, 0.025)',
          borderRadius: 28,
          borderWidth: 1,
          borderColor: isDark
            ? 'rgba(255, 255, 255, 0.08)'
            : 'rgba(0, 0, 0, 0.06)',
          paddingHorizontal: 20,
          paddingVertical: 18,
          marginBottom: 16,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View style={{ flex: 1, marginRight: 12 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              marginBottom: 4,
            }}
          >
            <Target size={13} color={textSecondaryColor} />
            <Text
              style={{
                color: textSecondaryColor,
                fontSize: 10,
                fontWeight: '900',
                textTransform: 'uppercase',
                letterSpacing: 1.5,
              }}
            >
              Challenges
            </Text>
          </View>
          <Text
            style={{
              color: textColor,
              fontSize: 18,
              fontWeight: '900',
              letterSpacing: -0.3,
            }}
          >
            Active Challenges
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 12,
              backgroundColor: isDark
                ? 'rgba(255, 255, 255, 0.06)'
                : 'rgba(0, 0, 0, 0.05)',
              borderWidth: 1,
              borderColor: isDark
                ? 'rgba(255, 255, 255, 0.08)'
                : 'rgba(0, 0, 0, 0.06)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={{
                color: textSecondaryColor,
                fontSize: 15,
                fontWeight: '900',
              }}
            >
              0
            </Text>
          </View>
          <ChevronRight size={18} color={textSecondaryColor} />
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={{
        borderRadius: 28,
        overflow: 'hidden',
        position: 'relative',
        marginBottom: 16,
        padding: 1.5,
      }}
    >
      <View
        pointerEvents="none"
        style={{
          ...(StyleSheet.absoluteFill as any),
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <Animated.View
          style={{
            width: 500,
            height: 500,
            transform: [{ rotate: spin }],
          }}
        >
          <LinearGradient
            colors={['transparent', colors.primary, '#38BDF8', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ width: '100%', height: '100%' }}
          />
        </Animated.View>
      </View>

      <View
        style={{
          borderRadius: 26.5,
          backgroundColor: isDark
            ? 'rgba(15, 23, 42, 0.88)'
            : 'rgba(255, 255, 255, 0.88)',
          paddingHorizontal: 20,
          paddingVertical: 18,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View style={{ flex: 1, marginRight: 12 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              marginBottom: 4,
            }}
          >
            <Target size={13} color={colors.primary} />
            <Text
              style={{
                color: colors.primary,
                fontSize: 10,
                fontWeight: '900',
                textTransform: 'uppercase',
                letterSpacing: 1.5,
              }}
            >
              Challenges
            </Text>
          </View>
          <Text
            style={{
              color: textColor,
              fontSize: 18,
              fontWeight: '900',
              letterSpacing: -0.3,
            }}
          >
            Active Challenges
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View
            style={{
              minWidth: 36,
              height: 36,
              paddingHorizontal: 8,
              borderRadius: 14,
              backgroundColor: `${colors.primary}25`,
              borderWidth: 1,
              borderColor: `${colors.primary}60`,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={{
                color: colors.primary,
                fontSize: 16,
                fontWeight: '900',
              }}
            >
              {count}
            </Text>
          </View>
          <ChevronRight size={18} color={colors.primary} />
        </View>
      </View>
    </TouchableOpacity>
  );
};

const MetricCard = ({ label, value, icon, active, onPress }: any) => {
  const displayValue =
    typeof value === 'number' ? formatCompactNumber(value) : value;
  const theme = useTheme();
  const colors = theme.colors;
  const isDark = isDarkColor(colors.background || '#020617');
  const cardBg = colors.surface || (isDark ? '#0F172A' : '#FFFFFF');
  const cardBorder =
    colors.border || (isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0');
  const textColor = colors.text || (isDark ? '#FFFFFF' : '#0F172A');
  const textSecondaryColor =
    colors.textSecondary || (isDark ? '#94A3B8' : '#64748B');

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      disabled={!onPress}
      onPress={onPress}
      className={`w-[47%] p-6 rounded-[36px] border-2 transition-all shadow-lg overflow-hidden ${!active ? 'border-dashed' : ''}`}
      style={{
        position: 'relative',
        backgroundColor: active
          ? cardBg
          : isDark
            ? 'rgba(15, 23, 42, 0.4)'
            : 'rgba(255, 255, 255, 0.7)',
        borderColor: active
          ? cardBorder
          : isDark
            ? 'rgba(255, 255, 255, 0.08)'
            : 'rgba(0, 0, 0, 0.06)',
      }}
    >
      <View
        style={{
          backgroundColor: colors.background,
          borderColor: cardBorder,
        }}
        className="w-12 h-12 rounded-2xl items-center justify-center border mb-6 shadow-sm"
      >
        {icon}
      </View>
      <Text
        style={{ color: textColor }}
        className="text-xl font-black tracking-tight"
      >
        {displayValue}
      </Text>
      <Text
        style={{ color: textSecondaryColor }}
        className="text-[9px] font-black uppercase tracking-widest mt-1.5"
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
};

const SectionHeader = ({ title, count, marginTop = 0 }: any) => {
  const theme = useTheme();
  const colors = theme.colors;
  const isDark = isDarkColor(colors.background || '#020617');
  const textColor = colors.text || (isDark ? '#ffffff' : '#0f172a');
  const textSecondaryColor =
    colors.textSecondary || (isDark ? '#94a3b8' : '#64748b');
  const cardBg = colors.surface || (isDark ? '#0f172a' : '#ffffff');
  const cardBorder =
    colors.border || (isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0');

  return (
    <View
      style={{
        marginTop,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
        paddingHorizontal: 4,
      }}
    >
      <Text
        style={{
          color: textColor,
          fontSize: 20,
          fontWeight: '900',
          letterSpacing: -0.5,
        }}
      >
        {title}
      </Text>
      <View
        style={{
          backgroundColor: cardBg,
          paddingHorizontal: 12,
          paddingVertical: 4,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: cardBorder,
        }}
      >
        <Text
          style={{
            color: textSecondaryColor,
            fontSize: 10,
            fontWeight: 'bold',
          }}
        >
          {count}
        </Text>
      </View>
    </View>
  );
};

// Smooth collapsible wrapper:
//  - Open: Expands height via LayoutAnimation, then fades/scales content in
//  - Close: Fades/scales content out (190ms), THEN collapses height via LayoutAnimation
const CollapsibleContent = ({
  expanded,
  children,
}: {
  expanded: boolean;
  children: ReactNode;
}) => {
  const [shouldRender, setShouldRender] = useState(expanded);
  const opacity = useSharedValue(expanded ? 1 : 0);
  const scale = useSharedValue(expanded ? 1 : 0.96);
  const isFirstRender = useRef(true);
  const timeoutRef = useRef<any>(null);

  useEffect(() => {
    // Skip animation on initial mount — everything starts expanded
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    const easeCfg = { easing: Easing.out(Easing.ease) };

    if (expanded) {
      // Mount content, expand height via LayoutAnimation, fade in via Reanimated
      setShouldRender(true);
      LayoutAnimation.configureNext({
        duration: 320,
        create: {
          type: LayoutAnimation.Types.easeInEaseOut,
          property: LayoutAnimation.Properties.scaleXY,
        },
        update: { type: LayoutAnimation.Types.easeInEaseOut },
      });
      opacity.value = withTiming(1, { duration: 280, ...easeCfg });
      scale.value = withTiming(1, { duration: 280, ...easeCfg });
    } else {
      // Fade/scale out content first (190ms), then collapse height via LayoutAnimation
      opacity.value = withTiming(0, { duration: 190, ...easeCfg });
      scale.value = withTiming(0.96, { duration: 190, ...easeCfg });

      timeoutRef.current = setTimeout(() => {
        LayoutAnimation.configureNext({
          duration: 260,
          update: { type: LayoutAnimation.Types.easeInEaseOut },
        });
        setShouldRender(false);
      }, 190);
    }
  }, [expanded]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  if (!shouldRender) return null;
  return <Reanimated.View style={style}>{children}</Reanimated.View>;
};

// Mirrors the AnimatedList pattern: scale 0.7→1 + opacity 0→1, pure timing, no bounce
const ScaleFadeIn = ({
  children,
  delay = 0,
}: {
  children: ReactNode;
  delay?: number;
}) => {
  const scale = useSharedValue(0.7);
  const opacity = useSharedValue(0);

  useEffect(() => {
    const config = { duration: 220, easing: Easing.out(Easing.ease) };
    if (delay > 0) {
      const t = setTimeout(() => {
        scale.value = withTiming(1, config);
        opacity.value = withTiming(1, config);
      }, delay);
      return () => clearTimeout(t);
    } else {
      scale.value = withTiming(1, config);
      opacity.value = withTiming(1, config);
    }
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return <Reanimated.View style={style}>{children}</Reanimated.View>;
};

const ActivityCard = ({
  title,
  sub,
  completed,
  icon,
  iconColor,
  onToggle,
  onPress,
  readOnly,
  delay = 0,
}: any) => {
  const theme = useTheme();
  const colors = theme.colors;
  const isDark = isDarkColor(colors.background || '#020617');
  const cardBg = colors.surface || (isDark ? '#0f172a' : '#ffffff');
  const cardBorder =
    colors.border || (isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0');
  const textColor = colors.text || (isDark ? '#ffffff' : '#0f172a');
  const textSecondaryColor =
    colors.textSecondary || (isDark ? '#94a3b8' : '#64748b');

  return (
    <ScaleFadeIn delay={delay}>
      <View style={{ marginBottom: 12 }}>
        <TouchableOpacity
          activeOpacity={0.7}
          disabled={!onPress}
          onPress={onPress}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            padding: 20,
            backgroundColor: cardBg,
            borderRadius: 32,
            borderWidth: 1,
            borderColor: completed ? `${colors.primary}33` : cardBorder,
          }}
        >
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 16,
              borderWidth: 1,
              backgroundColor: completed
                ? `${colors.primary}1a`
                : iconColor
                  ? `${iconColor}14`
                  : colors.background,
              borderColor: completed
                ? `${colors.primary}33`
                : iconColor
                  ? `${iconColor}25`
                  : cardBorder,
            }}
          >
            <View
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {icon}
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 16,
                fontWeight: 'bold',
                color: completed ? textColor : textSecondaryColor,
              }}
            >
              {title}
            </Text>
            <Text
              style={{
                color: textSecondaryColor,
                fontSize: 10,
                fontWeight: '900',
                textTransform: 'uppercase',
                letterSpacing: 1.5,
                marginTop: 4,
              }}
            >
              {sub}
            </Text>
          </View>
          {!readOnly && (
            <TouchableOpacity
              onPress={(e: any) => {
                e?.stopPropagation?.();
                onToggle && onToggle();
              }}
              activeOpacity={0.7}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                backgroundColor: completed ? colors.primary : colors.background,
                borderColor: completed ? colors.primary : cardBorder,
              }}
            >
              {completed ? (
                <CheckCircle
                  size={20}
                  color={getContrastColor(colors.primary)}
                />
              ) : (
                <Circle size={20} color={textSecondaryColor} />
              )}
            </TouchableOpacity>
          )}
          {readOnly && <ArrowUpRight size={18} color={textSecondaryColor} />}
        </TouchableOpacity>
      </View>
    </ScaleFadeIn>
  );
};

const EmptyState = ({ message }: { message: string }) => {
  const theme = useTheme();
  const colors = theme.colors;
  const isDark = isDarkColor(colors.background || '#020617');
  const textSecondaryColor =
    colors.textSecondary || (isDark ? '#94a3b8' : '#64748b');
  const cardBorder =
    colors.border || (isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0');

  return (
    <View
      style={{
        padding: 32,
        backgroundColor: 'transparent',
        borderRadius: 32,
        borderWidth: 1,
        borderColor: cardBorder,
        borderStyle: 'dashed',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          color: textSecondaryColor,
          fontSize: 11,
          fontWeight: '900',
          textTransform: 'uppercase',
          letterSpacing: 1.5,
          textAlign: 'center',
        }}
      >
        {message}
      </Text>
    </View>
  );
};

const Badge = ({ label, color }: any) => {
  const theme = useTheme();
  const badgeColor = color || theme.colors.primary;
  return (
    <View
      style={{
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: `${badgeColor}33`,
        backgroundColor: `${badgeColor}15`,
      }}
    >
      <Text
        style={{
          color: badgeColor,
          fontSize: 9,
          fontWeight: '900',
          textTransform: 'uppercase',
          letterSpacing: 1.5,
        }}
      >
        {label}
      </Text>
    </View>
  );
};

// Chevron that rotates smoothly when a section collapses/expands
const AnimatedChevron = ({ expanded }: { expanded: boolean }) => {
  const theme = useTheme();
  const colors = theme.colors;
  const isDark = isDarkColor(colors.background || '#020617');
  const iconColor = colors.text || (isDark ? '#ffffff' : '#0f172a');
  const rotation = useSharedValue(expanded ? 0 : -90);

  useEffect(() => {
    rotation.value = withTiming(expanded ? 0 : -90, {
      duration: 280,
      easing: Easing.out(Easing.cubic),
    });
  }, [expanded]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Reanimated.View style={animatedStyle}>
      <ChevronDown size={18} color={iconColor} />
    </Reanimated.View>
  );
};
