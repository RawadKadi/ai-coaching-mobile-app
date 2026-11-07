import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ActivityIndicator,
  TextInput,
  Modal,
  Alert,
  SafeAreaView,
  RefreshControl,
  LayoutAnimation,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Habit } from '@/types/database';
import { 
  ArrowLeft, 
  Plus, 
  Calendar as CalendarIcon, 
  Target, 
  Scale, 
  Award, 
  Info, 
  User, 
  Sparkles,
  ChevronRight,
  MoreVertical,
  Zap,
  Clock,
  Trash2,
  Edit2,
  TrendingUp,
  Mail,
  Check,
  X,
  Flame,
  Activity,
  MessageSquare,
  BarChart2,
  Utensils,
  Moon,
} from 'lucide-react-native';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useTheme } from '@/contexts/BrandContext';
import { isDarkColor } from '@/lib/theme-utils';
import { BrandedAvatar } from '@/components/BrandedAvatar';
import SchedulerModal from '@/components/SchedulerModal';
import GoogleMeetGateModal from '@/components/GoogleMeetGateModal';
import { googleMeetService } from '@/lib/google-meet-service';
import { CoachClientDetailsSkeleton } from '@/components/CoachClientDetailsSkeleton';
import PendingResolutionsModal from '@/components/PendingResolutionsModal';
import ConflictResolutionModal from '@/components/ConflictResolutionModal';
import { ProposedSession } from '@/lib/ai-scheduling-service';
import { MotiView, AnimatePresence } from 'moti';
import Animated, { useReducedMotion, useAnimatedStyle, interpolate } from 'react-native-reanimated';
import StreakFire from '@/components/StreakFire';
import { formatCompactNumber } from '@/lib/format-utils';

function HabitSwipeActions({
  progress,
  cardBg,
  cardBorder,
  textColor,
  onEdit,
  onDelete,
}: {
  progress: any;
  cardBg: string;
  cardBorder: string;
  textColor: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const p = progress?.value ?? 0;
    return {
      opacity: interpolate(p, [0, 0.2, 1], [0, 1, 1]),
      transform: [
        {
          translateX: interpolate(p, [0, 1], [30, 0]),
        },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          paddingLeft: 12,
          height: '100%',
        },
        animatedStyle,
      ]}
    >
      <TouchableOpacity 
        accessibilityRole="button"
        accessibilityLabel="Edit task"
        onPress={onEdit}
        className="w-14 h-full rounded-2xl items-center justify-center border mr-2"
        style={{ backgroundColor: cardBg, borderColor: cardBorder }}
      >
        <Edit2 size={18} color={textColor} />
      </TouchableOpacity>
      <TouchableOpacity 
        accessibilityRole="button"
        accessibilityLabel="Delete task"
        onPress={onDelete}
        className="w-14 h-full bg-red-500 rounded-2xl items-center justify-center"
      >
        <Trash2 size={18} color="white" />
      </TouchableOpacity>
    </Animated.View>
  );
}

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
  const points = data.length >= 7 ? data.slice(-7) : [...Array(7 - data.length).fill(0), ...data];
  const max = Math.max(...points, 1);
  const inactiveColor = isDark ? 'rgba(255, 255, 255, 0.14)' : '#E2E8F0';

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 40, gap: 4 }}>
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

export default function ClientDetailsScreen() {
  const { id, tab } = useLocalSearchParams();
  const router = useRouter();
  const { coach, user } = useAuth();
  const theme = useTheme();
  const colors = theme.colors;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [client, setClient] = useState<any>(null);
  const [challenges, setChallenges] = useState<any[]>([]);
  const [schedulerVisible, setSchedulerVisible] = useState(false);
  const [showGoogleMeetGate, setShowGoogleMeetGate] = useState(false);
  const [isMeetConnected, setIsMeetConnected] = useState(() => googleMeetService.isConnectedSync(coach));
  const [allCoachSessions, setAllCoachSessions] = useState<any[]>([]);
  const [pendingResolutions, setPendingResolutions] = useState<any[]>([]);
  const [pendingModalVisible, setPendingModalVisible] = useState(false);
  type SubView = 'daily_tasks' | 'weight_history' | null;
  const [activeSubView, setActiveSubView] = useState<SubView>(
    (tab as string) === 'daily_tasks' ? 'daily_tasks' : null
  );
  const scrollRef = useRef<ScrollView>(null);
  const hasLoadedOnce = useRef(false);

  const [messageFabPressed, setMessageFabPressed] = useState(false);

  // Challenges, Check-ins and Sessions are their own pages now
  const openClientPage = (page: 'challenges' | 'checkins' | 'sessions') => {
    router.push({
      pathname: `/(coach)/clients/${page}` as any,
      params: { 
        clientId: id as string, 
        name: client?.profiles?.full_name || '',
        avatar: client?.profiles?.avatar_url || '',
      },
    });
  };

  useEffect(() => {
    if (tab === 'checkins') {
      openClientPage('checkins');
    } else if (tab === 'challenges') {
      openClientPage('challenges');
    } else if (tab === 'sessions') {
      openClientPage('sessions');
    }
  }, [tab, id, client?.profiles?.full_name, client?.profiles?.avatar_url]);
  const [checkins, setCheckins] = useState<any[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [streak, setStreak] = useState(0);
  const [isColdStreak, setIsColdStreak] = useState(false);
  const [sessionLog, setSessionLog] = useState<any[]>([]);
  const [stepsLog, setStepsLog] = useState<any[]>([]);
  
  // Conflict Resolution State
  const [conflictModalVisible, setConflictModalVisible] = useState(false);
  const [currentConflict, setCurrentConflict] = useState<any>(null);
  // Habit Editing State
  const [isEditingHabits, setIsEditingHabits] = useState(false);
  const [editHabitModalVisible, setEditHabitModalVisible] = useState(false);
  const [selectedHabit, setSelectedHabit] = useState<Habit | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingDescription, setEditingDescription] = useState('');
  const [editingCategory, setEditingCategory] = useState<any>('general');
  const [updating, setUpdating] = useState(false);
  const reduceMotion = useReducedMotion();

  const swipeableRefs = useRef<{ [key: string]: any }>({});

  useEffect(() => {
    if (coach && id) {
      loadClientData();
      
      const subscription = supabase
        .channel(`client-details-${id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions', filter: `coach_id=eq.${coach.id}` }, () => {
            loadClientData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'habit_logs', filter: `client_id=eq.${id}` }, () => {
            loadClientData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'habits', filter: `client_id=eq.${id}` }, () => {
            loadClientData();
        })
        .subscribe();

      return () => { supabase.removeChannel(subscription); };
    }
  }, [coach, id]);

  const loadClientData = async () => {
    try {
      // Only show the loading screen the first time. Later refreshes happen quietly.
      if (!hasLoadedOnce.current && !refreshing) setLoading(true);

      const dateStrForDaysAgo = (daysAgo: number) => {
        const d = new Date();
        d.setDate(d.getDate() - daysAgo);
        return [
          d.getFullYear(),
          String(d.getMonth() + 1).padStart(2, '0'),
          String(d.getDate()).padStart(2, '0'),
        ].join('-');
      };

      // Fetch everything at the same time instead of one after another
      const [
        clientRes,
        challengesRes,
        sessionsRes,
        checkinsRes,
        habitsRes,
        habitLogsRes,
        sessionLogRes,
        stepsRes,
        mealsRes,
      ] = await Promise.all([
        supabase.rpc('get_client_details', { target_client_id: id }),
        supabase.rpc('get_coach_mother_challenges', { p_coach_id: coach?.id, p_client_id: id }),
        supabase
          .from('sessions')
          .select('*, client:clients!sessions_client_id_fkey(id, profiles(full_name))')
          .eq('coach_id', coach?.id)
          .gte('scheduled_at', new Date().toISOString()),
        supabase.from('check_ins').select('*').eq('client_id', id).order('date', { ascending: false }),
        supabase
          .from('habits')
          .select('*')
          .eq('client_id', id)
          .eq('is_active', true)
          .order('created_at', { ascending: true }),
        supabase
          .from('habit_logs')
          .select('date, habit_id, completed')
          .eq('client_id', id)
          .gte('date', dateStrForDaysAgo(90))
          .eq('completed', true),
        supabase
          .from('sessions')
          .select('*')
          .eq('client_id', id)
          .order('scheduled_at', { ascending: false }),
        supabase
          .from('daily_logs')
          .select('date, steps')
          .eq('client_id', id)
          .order('date', { ascending: false })
          .limit(30),
        supabase
          .from('meals')
          .select('meal_date')
          .eq('client_id', id)
          .gte('meal_date', dateStrForDaysAgo(90)),
      ]);

      if (clientRes.error) throw clientRes.error;
      setClient(clientRes.data);
      setChallenges(challengesRes.data || []);

      const sessionsData = sessionsRes.data;
      if (!sessionsRes.error && sessionsData) {
        setAllCoachSessions(
          sessionsData.map((s: any) => ({ ...s, client_name: s.client?.profiles?.full_name || 'Unknown' }))
        );
        setPendingResolutions(
          sessionsData.filter(
            (s: any) =>
              s.client_id === id &&
              (s.status === 'pending_resolution' ||
                s.status === 'proposed' ||
                (s.invite_sent === true && s.status === 'scheduled' && !s.cancellation_reason) ||
                s.cancellation_reason?.startsWith('pending_reschedule') ||
                s.cancellation_reason === 'reschedule_rejected')
          )
        );
      }

      if (!checkinsRes.error && checkinsRes.data) setCheckins(checkinsRes.data);
      const activeHabitsList = (!habitsRes.error && habitsRes.data) || [];
      setHabits(activeHabitsList as Habit[]);
      if (!sessionLogRes.error && sessionLogRes.data) setSessionLog(sessionLogRes.data);
      if (stepsRes.data) setStepsLog(stepsRes.data);

      // Streak (2-missed-days rule). Same math the client app uses (Check-in + Meal + Coach tasks).
      const completedLogs = habitLogsRes.data || [];
      const checkInsList = checkinsRes.data || [];
      const checkInDatesSet = new Set(checkInsList.map((c: any) => c.date));
      const mealDatesSet = new Set((mealsRes.data || []).map((m: any) => m.meal_date));

      const isDateCompleted = (dateStr: string) => {
        // Essential 1: Check-in
        if (!checkInDatesSet.has(dateStr)) return false;

        // Essential 2: At least 1 meal
        if (!mealDatesSet.has(dateStr)) return false;

        // Essential 3+: Any active coach habits established for that date
        const habitsForDate = activeHabitsList.filter((h: any) => {
          const createdDate = h.created_at ? h.created_at.split('T')[0] : '2000-01-01';
          return createdDate <= dateStr;
        });
        if (habitsForDate.length > 0) {
          return habitsForDate.every((h: any) =>
            completedLogs.some((l: any) => l.habit_id === h.id && l.date === dateStr && l.completed)
          );
        }
        return true;
      };

      const isTodayDone = isDateCompleted(dateStrForDaysAgo(0));
      const isYesterdayDone = isDateCompleted(dateStrForDaysAgo(1));
      const isDayBeforeYesterdayDone = isDateCompleted(dateStrForDaysAgo(2));

      const countStreak = (startDaysAgo: number) => {
        let count = isTodayDone ? 1 : 0;
        let daysAgo = startDaysAgo;
        let consecutiveMiss = 0;
        while (daysAgo <= 90) {
          if (isDateCompleted(dateStrForDaysAgo(daysAgo))) {
            count += 1;
            consecutiveMiss = 0;
          } else {
            consecutiveMiss += 1;
            if (consecutiveMiss >= 2) break;
          }
          daysAgo += 1;
        }
        return count;
      };

      let computedStreak = 0;
      let coldStatus = false;

      // Essentials always exist, so streak calculation runs for all clients
      if (isYesterdayDone) {
        computedStreak = countStreak(1);
      } else if (isDayBeforeYesterdayDone) {
        computedStreak = countStreak(2);
        coldStatus = !isTodayDone && computedStreak > 0;
      } else {
        computedStreak = isTodayDone ? 1 : 0;
      }

      setStreak(computedStreak);
      setIsColdStreak(coldStatus);
      hasLoadedOnce.current = true;
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };


  const handleDeleteHabit = async (habitId: string) => {
    Alert.alert(
      'Delete Task',
      'Are you sure? This will stop tracking this requirement for the client.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.from('habits').update({ is_active: false }).eq('id', habitId);
              if (error) throw error;
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setHabits(prev => prev.filter(h => h.id !== habitId));
            } catch (e: any) {
              Alert.alert('Error', e.message);
            }
          }
        }
      ]
    );
  };

  const handleEditHabit = (habit: Habit) => {
    setSelectedHabit(habit);
    setEditingName(habit.name);
    setEditingDescription(habit.description || '');
    setEditingCategory(habit.category || 'general');
    setEditHabitModalVisible(true);
    // Close swipeable
    swipeableRefs.current[habit.id]?.close();
  };

  const handleUpdateHabit = async () => {
    if (!selectedHabit) return;
    if (!editingName.trim()) {
        Alert.alert('Required', 'Please provide a name for the task.');
        return;
    }

    try {
      setUpdating(true);
      const { error } = await supabase
        .from('habits')
        .update({
          name: editingName.trim(),
          description: editingDescription.trim() || null,
          category: editingCategory
        })
        .eq('id', selectedHabit.id);

      if (error) throw error;
      
      setHabits(prev => prev.map(h => h.id === selectedHabit.id ? ({ 
        ...h, 
        name: editingName.trim(), 
        description: editingDescription.trim() || null,
        category: editingCategory
      } as Habit) : h));
      
      setEditHabitModalVisible(false);
      setSelectedHabit(null);
    } catch (e: any) {
      Alert.alert('Update Failed', e.message);
    } finally {
      setUpdating(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadClientData();
  }, [id, coach]);

  const isDark = isDarkColor(colors.background || '#010417');
  const primaryColor = colors.primary || '#3B82F6';
  const isPrimaryDark = isDarkColor(primaryColor);
  const textColor = colors.text || (isDark ? '#FFFFFF' : '#0F172A');
  const textSecondaryColor = colors.textSecondary || (isDark ? '#94A3B8' : '#64748B');
  const cardBg = colors.surface || (isDark ? '#0F172A' : '#FFFFFF');
  const cardBorder = colors.border || (isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0');
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const todayStr = `${yyyy}-${mm}-${dd}`;
  const todayLog = stepsLog.find(log => log.date === todayStr);
  const todaySteps = todayLog ? todayLog.steps : (stepsLog.length > 0 && stepsLog[0]?.steps ? stepsLog[0].steps : 0);

  const stepsChartData = useMemo(() => {
    const points: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${day}`;
      const log = stepsLog.find(l => l.date === dateStr);
      points.push(log?.steps || 0);
    }
    return points;
  }, [stepsLog]);

  const avgSteps = useMemo(() => {
    if (stepsChartData.length === 0) return 0;
    const total = stepsChartData.reduce((acc, curr) => acc + (curr || 0), 0);
    return Math.round(total / 7);
  }, [stepsChartData]);

  const stepsTimeStr = 'Last 7 Days';

  if (loading && !refreshing) {
    return <CoachClientDetailsSkeleton />;
  }

  if (!client) {
    return (
      <View className="flex-1 bg-slate-950 justify-center items-center">
        <Text className="text-white font-bold">Client not found</Text>
      </View>
    );
  }

  const validWeights = checkins.filter(c => c.weight_kg !== null && c.weight_kg !== undefined);
  const latestWeight = validWeights.length > 0 ? Number(validWeights[0].weight_kg) : null;
  const latestWeightDate = validWeights.length > 0 ? validWeights[0].date : null;

  let weightDaysAgo = 0;
  if (latestWeightDate) {
    const checkinDate = new Date(latestWeightDate);
    const todayDate = new Date();
    const diffTime = Math.abs(todayDate.getTime() - checkinDate.getTime());
    weightDaysAgo = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  const validSleep = checkins.filter(c => c.sleep_hours !== null && c.sleep_hours !== undefined);
  const avgSleep = validSleep.length > 0 
    ? (validSleep.reduce((sum, c) => sum + Number(c.sleep_hours), 0) / validSleep.length).toFixed(1) 
    : null;

  const validEnergy = checkins.filter(c => c.energy_level !== null && c.energy_level !== undefined);
  const avgEnergy = validEnergy.length > 0 
    ? (validEnergy.reduce((sum, c) => sum + Number(c.energy_level), 0) / validEnergy.length).toFixed(1) 
    : null;

  const computedChallenges = challenges.map(c => {
    const endDate = new Date(c.end_date);
    endDate.setHours(23, 59, 59, 999);
    const isPast = endDate < new Date();
    
    if (c.status === 'active' && isPast) {
      return { ...c, status: 'completed' };
    }
    return c;
  });

  const activeChallengesCount = computedChallenges.filter(c => c.status === 'active').length;
  const upcomingSessions = sessionLog.filter(s => s.status === 'scheduled' && new Date(s.scheduled_at) > new Date());

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
            {/* Header */}
            <View className="flex-row items-center justify-between px-6 pt-10 pb-5 border-b" style={{ borderBottomColor: colors.border }}>
                {activeSubView === null ? (
                  <>
                    <View className="flex-row items-center gap-3.5 flex-1 pr-3">
                        <TouchableOpacity 
                          onPress={() => router.back()} 
                          className="w-10 h-10 rounded-2xl items-center justify-center border"
                          style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                        >
                            <ArrowLeft size={18} color={colors.text} />
                        </TouchableOpacity>
                        <BrandedAvatar name={client.profiles?.full_name} size={42} imageUrl={client.profiles?.avatar_url} />
                        <View className="flex-1">
                            <Text className="text-lg font-black tracking-tight" numberOfLines={1} style={{ color: colors.text }}>
                              {client.profiles?.full_name}
                            </Text>
                            {client.profiles?.email && (
                              <Text className="text-xs font-medium" numberOfLines={1} style={{ color: colors.textSecondary }}>
                                {client.profiles?.email}
                              </Text>
                            )}
                        </View>
                    </View>
                    <View className="flex-row items-center gap-2">
                        <TouchableOpacity 
                          onPress={() => {
                            if (!isMeetConnected && !googleMeetService.isConnectedSync(coach)) {
                              setShowGoogleMeetGate(true);
                              return;
                            }
                            setSchedulerVisible(true);
                          }} 
                          className="w-10 h-10 rounded-2xl items-center justify-center border"
                          style={{ backgroundColor: cardBg, borderColor: cardBorder }}
                        >
                            <CalendarIcon size={18} color={colors.primary} />
                        </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <>
                    <View className="flex-row items-center gap-3.5 flex-1 pr-3">
                        <TouchableOpacity 
                          onPress={() => setActiveSubView(null)} 
                          className="w-10 h-10 rounded-2xl items-center justify-center border"
                          style={{ backgroundColor: cardBg, borderColor: cardBorder }}
                        >
                            <ArrowLeft size={18} color={textColor} />
                        </TouchableOpacity>
                        <BrandedAvatar name={client.profiles?.full_name} size={42} imageUrl={client.profiles?.avatar_url} />
                        <View className="flex-1">
                            <Text className="text-lg font-black tracking-tight" numberOfLines={1} style={{ color: textColor }}>
                              {activeSubView === 'daily_tasks' ? 'Daily Tasks' : 'Weight History'}
                            </Text>
                            <Text className="text-xs font-medium" numberOfLines={1} style={{ color: textSecondaryColor }}>
                              {client.profiles?.full_name}
                            </Text>
                        </View>
                    </View>
                  </>
                )}
            </View>

            {pendingResolutions.length > 0 && activeSubView === null && (
                <TouchableOpacity 
                    style={{ backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}25` }}
                    className="mx-3 mt-3 border rounded-2xl p-4 flex-row items-center justify-between"
                    onPress={() => setPendingModalVisible(true)}
                >
                    <View className="flex-row items-center gap-3">
                        <View style={{ backgroundColor: colors.primary }} className="w-2 h-2 rounded-full" />
                        <Text style={{ color: colors.primary }} className="font-bold text-xs uppercase tracking-widest">{pendingResolutions.length} Resolutions Pending</Text>
                    </View>
                    <ChevronRight size={16} color={colors.primary} />
                </TouchableOpacity>
            )}

            <ScrollView 
                className="flex-1"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 120 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
            >
                {activeSubView === null ? (
                  <View className="px-3 pt-3">
                    {/* ─── 1. Steps Card (Matching Dashboard Design) ───────────── */}
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => router.push(`/(client)/analytics-detail?metric=steps&clientId=${id}&name=${encodeURIComponent(client?.profiles?.full_name || '')}&avatar=${encodeURIComponent(client?.profiles?.avatar_url || '')}` as any)}
                      style={{
                        backgroundColor: cardBg,
                        borderColor: cardBorder,
                        borderWidth: 1,
                      }}
                      className="p-6 rounded-[36px] mb-3 relative overflow-hidden"
                    >
                      <View
                        style={{ backgroundColor: `${colors.primary}0D` }}
                        className="absolute -top-12 -right-12 w-36 h-36 rounded-full pointer-events-none"
                      />
                      <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center gap-2.5">
                          <View
                            style={{ backgroundColor: `${colors.primary}16` }}
                            className="w-10 h-10 rounded-2xl items-center justify-center"
                          >
                            <Flame size={20} color={colors.primary} />
                          </View>
                          <Text style={{ color: textColor }} className="text-lg font-black tracking-tight">
                            Avg Steps
                          </Text>
                        </View>

                        <View className="flex-row items-center gap-1">
                          <Text style={{ color: textSecondaryColor }} className="text-xs font-semibold">
                            {stepsTimeStr}
                          </Text>
                          <ChevronRight size={18} color={textSecondaryColor} />
                        </View>
                      </View>

                      <View className="flex-row items-end justify-between mt-4">
                        <View className="flex-row items-baseline gap-2">
                          <Text style={{ color: textColor }} className="text-4xl font-black tracking-tighter leading-none mb-1">
                            {(avgSteps || 0).toLocaleString()}
                          </Text>
                          <Text style={{ color: textSecondaryColor }} className="text-base font-bold">
                            steps
                          </Text>
                        </View>

                        <MiniBarChart data={stepsChartData} color={colors.primary} isDark={isDark} />
                      </View>
                    </TouchableOpacity>

                    {/* ─── 2. Core Health Metrics Grid (2x2 with Huge Numbers) ─── */}
                    {/* Row 1: Streak and Weight */}
                    <View className="flex-row gap-3 mb-3">
                      {/* Active Streak */}
                      <View 
                        className="flex-1 rounded-[32px] p-6 border relative overflow-hidden justify-between"
                        style={{ backgroundColor: cardBg, borderColor: cardBorder }}
                      >
                        <View
                          style={{ backgroundColor: `${colors.primary}0D` }}
                          className="absolute -top-8 -right-8 w-24 h-24 rounded-full pointer-events-none"
                        />
                        <View className="flex-row items-center justify-between mb-4">
                          <View
                            className="w-11 h-11 rounded-2xl items-center justify-center border"
                            style={{ backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}35` }}
                          >
                            <Award size={20} color={colors.primary} />
                          </View>
                          <View
                            className="px-2.5 py-1 rounded-full border"
                            style={{ backgroundColor: `${colors.primary}15`, borderColor: `${colors.primary}30` }}
                          >
                            <Text style={{ color: colors.primary }} className="text-[9px] font-black uppercase tracking-wider">
                              Streak
                            </Text>
                          </View>
                        </View>
                        <View>
                          <View className="flex-row items-center gap-1 mb-1">
                            <StreakFire
                              variant={streak <= 0 ? 'zero' : isColdStreak ? 'cold' : 'active'}
                              size={36}
                              style={{
                                marginLeft: -6,
                                marginVertical: -6,
                                transform: [{ translateY: -8 }],
                              }}
                            />
                            <Text style={{ color: textColor }} className="text-4xl font-black tracking-tighter leading-none">
                              {formatCompactNumber(streak)} <Text className="text-sm font-bold" style={{ color: textSecondaryColor }}>{streak === 1 ? 'Day' : 'Days'}</Text>
                            </Text>
                          </View>
                          <Text style={{ color: textSecondaryColor }} className="text-xs font-bold uppercase tracking-wider">
                            Active Streak
                          </Text>
                        </View>
                      </View>

                      {/* Weight Card (Click to open Weight History) */}
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => setActiveSubView('weight_history')}
                        className="flex-1 rounded-[32px] p-6 border relative overflow-hidden justify-between"
                        style={{ backgroundColor: cardBg, borderColor: cardBorder }}
                      >
                        <View
                          style={{ backgroundColor: `${colors.primary}0D` }}
                          className="absolute -top-8 -right-8 w-24 h-24 rounded-full pointer-events-none"
                        />
                        <View className="flex-row items-center justify-between mb-4">
                          <View
                            className="w-11 h-11 rounded-2xl items-center justify-center border"
                            style={{ backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}35` }}
                          >
                            <Scale size={20} color={colors.primary} />
                          </View>
                          <View className="flex-row items-center gap-1">
                            {weightDaysAgo > 5 ? (
                              <View style={{ backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}25` }} className="px-2 py-0.5 rounded-full border">
                                <Text style={{ color: colors.primary }} className="text-[8px] font-black uppercase">Old</Text>
                              </View>
                            ) : null}
                            <ChevronRight size={16} color={textSecondaryColor} />
                          </View>
                        </View>
                        <View>
                          <Text style={{ color: textColor }} className="text-4xl font-black tracking-tighter leading-none mb-1">
                            {latestWeight ? latestWeight : '--'} <Text className="text-sm font-bold" style={{ color: textSecondaryColor }}>kg</Text>
                          </Text>
                          <Text style={{ color: textSecondaryColor }} className="text-xs font-bold uppercase tracking-wider">
                            {weightDaysAgo > 5 ? `${weightDaysAgo}d ago` : 'Last Weight'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    </View>

                    {/* Row 2: Sleep and Energy */}
                    <View className="flex-row gap-3 mb-4">
                      {/* Avg Sleep */}
                      <View 
                        className="flex-1 rounded-[32px] p-6 border relative overflow-hidden justify-between"
                        style={{ backgroundColor: cardBg, borderColor: cardBorder }}
                      >
                        <View
                          style={{ backgroundColor: `${colors.primary}0D` }}
                          className="absolute -top-8 -right-8 w-24 h-24 rounded-full pointer-events-none"
                        />
                        <View className="flex-row items-center justify-between mb-4">
                          <View
                            className="w-11 h-11 rounded-2xl items-center justify-center border"
                            style={{ backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}35` }}
                          >
                            <Clock size={20} color={colors.primary} />
                          </View>
                          <View
                            className="px-2.5 py-1 rounded-full border"
                            style={{ backgroundColor: `${colors.primary}15`, borderColor: `${colors.primary}30` }}
                          >
                            <Text style={{ color: colors.primary }} className="text-[9px] font-black uppercase tracking-wider">
                              Sleep
                            </Text>
                          </View>
                        </View>
                        <View>
                          <Text style={{ color: textColor }} className="text-4xl font-black tracking-tighter leading-none mb-1">
                            {avgSleep ? avgSleep : '--'} <Text className="text-sm font-bold" style={{ color: textSecondaryColor }}>hrs</Text>
                          </Text>
                          <Text style={{ color: textSecondaryColor }} className="text-xs font-bold uppercase tracking-wider">
                            Avg Sleep
                          </Text>
                        </View>
                      </View>

                      {/* Avg Energy */}
                      <View 
                        className="flex-1 rounded-[32px] p-6 border relative overflow-hidden justify-between"
                        style={{ backgroundColor: cardBg, borderColor: cardBorder }}
                      >
                        <View
                          style={{ backgroundColor: `${colors.primary}0D` }}
                          className="absolute -top-8 -right-8 w-24 h-24 rounded-full pointer-events-none"
                        />
                        <View className="flex-row items-center justify-between mb-4">
                          <View
                            className="w-11 h-11 rounded-2xl items-center justify-center border"
                            style={{ backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}35` }}
                          >
                            <Zap size={20} color={colors.primary} />
                          </View>
                          <View
                            className="px-2.5 py-1 rounded-full border"
                            style={{ backgroundColor: `${colors.primary}15`, borderColor: `${colors.primary}30` }}
                          >
                            <Text style={{ color: colors.primary }} className="text-[9px] font-black uppercase tracking-wider">
                              Energy
                            </Text>
                          </View>
                        </View>
                        <View>
                          <Text style={{ color: textColor }} className="text-4xl font-black tracking-tighter leading-none mb-1">
                            {avgEnergy ? avgEnergy : '--'} <Text className="text-sm font-bold" style={{ color: textSecondaryColor }}>/10</Text>
                          </Text>
                          <Text style={{ color: textSecondaryColor }} className="text-xs font-bold uppercase tracking-wider">
                            Avg Energy
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* ─── 3. Manage Section ───────────────────────────────────── */}
                    <Text style={{ color: textColor }} className="text-2xl font-black tracking-tight mb-3 px-1">
                      Manage
                    </Text>

                    {/* Big Branded Analytics Card (matching Coach Dashboard) */}
                    <View className="mb-3">
                      <TouchableOpacity
                        activeOpacity={0.88}
                        onPress={() => router.push(`/(client)/analytics?clientId=${id}&name=${encodeURIComponent(client?.profiles?.full_name || '')}&avatar=${encodeURIComponent(client?.profiles?.avatar_url || '')}` as any)}
                        className="rounded-[36px] p-6 border relative overflow-hidden"
                        style={{
                          backgroundColor: isDark
                            ? `${primaryColor}15`
                            : `${primaryColor}10`,
                          borderColor: `${primaryColor}40`,
                        }}
                      >
                        {/* Glow ambient background circles */}
                        <View
                          style={{ backgroundColor: `${primaryColor}25` }}
                          className="absolute -top-16 -right-16 w-56 h-56 rounded-full pointer-events-none"
                        />
                        <View
                          style={{ backgroundColor: `${primaryColor}15` }}
                          className="absolute -bottom-12 -left-12 w-44 h-44 rounded-full pointer-events-none"
                        />

                        {/* Top Header Row */}
                        <View className="flex-row items-center justify-between mb-4">
                          <View className="flex-row items-center gap-3.5">
                            <View
                              className="rounded-2xl items-center justify-center border"
                              style={{
                                width: 52,
                                height: 52,
                                backgroundColor: primaryColor,
                                borderColor: `${primaryColor}80`,
                              }}
                            >
                              <BarChart2
                                size={26}
                                color={colors.textOnPrimary || (isPrimaryDark ? '#FFFFFF' : '#0F172A')}
                                strokeWidth={2.3}
                              />
                            </View>
                            <View>
                              <Text
                                style={{ color: textColor }}
                                className="text-2xl font-black tracking-tight"
                              >
                                Client Analytics
                              </Text>
                              <Text
                                style={{ color: primaryColor }}
                                className="text-xs font-black uppercase tracking-wider mt-0.5"
                              >
                                Nutrition, Steps & Health
                              </Text>
                            </View>
                          </View>

                          <View
                            className="w-10 h-10 rounded-full items-center justify-center border"
                            style={{
                              backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#FFFFFF',
                              borderColor: `${primaryColor}50`,
                            }}
                          >
                            <ChevronRight size={20} color={primaryColor} />
                          </View>
                        </View>

                        {/* Description */}
                        <Text
                          style={{ color: textSecondaryColor }}
                          className="text-sm font-medium leading-5 mb-4"
                        >
                          Check client calories, macros, sleep, and daily habits with interactive charts.
                        </Text>

                        {/* Feature Pills */}
                        <View className="flex-row items-center gap-2 flex-wrap">
                          <View
                            className="px-3 py-1.5 rounded-full border flex-row items-center gap-1.5"
                            style={{
                              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
                              borderColor: `${primaryColor}30`,
                            }}
                          >
                            <Utensils size={13} color={primaryColor} />
                            <Text style={{ color: textColor }} className="text-xs font-bold">
                              Food & Macros
                            </Text>
                          </View>

                          <View
                            className="px-3 py-1.5 rounded-full border flex-row items-center gap-1.5"
                            style={{
                              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
                              borderColor: `${primaryColor}30`,
                            }}
                          >
                            <Flame size={13} color={primaryColor} />
                            <Text style={{ color: textColor }} className="text-xs font-bold">
                              Steps
                            </Text>
                          </View>

                          <View
                            className="px-3 py-1.5 rounded-full border flex-row items-center gap-1.5"
                            style={{
                              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
                              borderColor: `${primaryColor}30`,
                            }}
                          >
                            <Moon size={13} color={primaryColor} />
                            <Text style={{ color: textColor }} className="text-xs font-bold">
                              Sleep
                            </Text>
                          </View>

                          <View
                            className="px-3 py-1.5 rounded-full border flex-row items-center gap-1.5"
                            style={{
                              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
                              borderColor: `${primaryColor}30`,
                            }}
                          >
                            <Zap size={13} color={primaryColor} />
                            <Text style={{ color: textColor }} className="text-xs font-bold">
                              Energy
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    </View>

                    <View className="gap-3 mb-6">
                      {/* Daily Tasks Card */}
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => setActiveSubView('daily_tasks')}
                        className="p-5 rounded-[32px] border flex-row items-center justify-between"
                        style={{ backgroundColor: cardBg, borderColor: cardBorder }}
                      >
                        <View className="flex-row items-center gap-3.5 flex-1 pr-3">
                          <View
                            className="w-12 h-12 rounded-2xl items-center justify-center border"
                            style={{ backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}35` }}
                          >
                            <Target size={22} color={colors.primary} />
                          </View>
                          <View className="flex-1">
                            <Text className="text-base font-black tracking-tight" style={{ color: textColor }}>
                              Daily Tasks
                            </Text>
                            <Text className="text-xs font-medium mt-0.5" style={{ color: textSecondaryColor }}>
                              {habits.length > 0 ? `${habits.length} active daily tasks` : 'Assign daily habits'}
                            </Text>
                          </View>
                        </View>
                        <View className="flex-row items-center gap-2.5">
                          <Text className="text-2xl font-black tracking-tight" style={{ color: colors.primary }}>
                            {formatCompactNumber(habits.length)}
                          </Text>
                          <ChevronRight size={18} color={textSecondaryColor} />
                        </View>
                      </TouchableOpacity>

                      {/* Challenges Card */}
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => openClientPage('challenges')}
                        className="p-5 rounded-[32px] border flex-row items-center justify-between"
                        style={{ backgroundColor: cardBg, borderColor: cardBorder }}
                      >
                        <View className="flex-row items-center gap-3.5 flex-1 pr-3">
                          <View
                            className="w-12 h-12 rounded-2xl items-center justify-center border"
                            style={{ backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}35` }}
                          >
                            <Award size={22} color={colors.primary} />
                          </View>
                          <View className="flex-1">
                            <Text className="text-base font-black tracking-tight" style={{ color: textColor }}>
                              Challenges
                            </Text>
                            <Text className="text-xs font-medium mt-0.5" style={{ color: textSecondaryColor }}>
                              {activeChallengesCount > 0 ? `${formatCompactNumber(activeChallengesCount)} active challenges` : 'Start a challenge'}
                            </Text>
                          </View>
                        </View>
                        <View className="flex-row items-center gap-2.5">
                          <Text className="text-2xl font-black tracking-tight" style={{ color: colors.primary }}>
                            {formatCompactNumber(activeChallengesCount)}
                          </Text>
                          <ChevronRight size={18} color={textSecondaryColor} />
                        </View>
                      </TouchableOpacity>

                      {/* Check-ins Card */}
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => openClientPage('checkins')}
                        className="p-5 rounded-[32px] border flex-row items-center justify-between"
                        style={{ backgroundColor: cardBg, borderColor: cardBorder }}
                      >
                        <View className="flex-row items-center gap-3.5 flex-1 pr-3">
                          <View
                            className="w-12 h-12 rounded-2xl items-center justify-center border"
                            style={{ backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}35` }}
                          >
                            <CalendarIcon size={22} color={colors.primary} />
                          </View>
                          <View className="flex-1">
                            <Text className="text-base font-black tracking-tight" style={{ color: textColor }}>
                              Check-ins
                            </Text>
                            <Text className="text-xs font-medium mt-0.5" style={{ color: textSecondaryColor }}>
                              {checkins.length > 0 ? `${formatCompactNumber(checkins.length)} check-ins logged` : 'No logs recorded'}
                            </Text>
                          </View>
                        </View>
                        <View className="flex-row items-center gap-2.5">
                          <Text className="text-2xl font-black tracking-tight" style={{ color: colors.primary }}>
                            {formatCompactNumber(checkins.length)}
                          </Text>
                          <ChevronRight size={18} color={textSecondaryColor} />
                        </View>
                      </TouchableOpacity>

                      {/* Sessions Card */}
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => openClientPage('sessions')}
                        className="p-5 rounded-[32px] border flex-row items-center justify-between"
                        style={{ backgroundColor: cardBg, borderColor: cardBorder }}
                      >
                        <View className="flex-row items-center gap-3.5 flex-1 pr-3">
                          <View
                            className="w-12 h-12 rounded-2xl items-center justify-center border"
                            style={{ backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}35` }}
                          >
                            <Clock size={22} color={colors.primary} />
                          </View>
                          <View className="flex-1">
                            <Text className="text-base font-black tracking-tight" style={{ color: textColor }}>
                              Sessions
                            </Text>
                            <Text className="text-xs font-medium mt-0.5" style={{ color: textSecondaryColor }}>
                              {upcomingSessions.length > 0 ? `${formatCompactNumber(upcomingSessions.length)} upcoming scheduled` : 'Weekly schedule'}
                            </Text>
                          </View>
                        </View>
                        <View className="flex-row items-center gap-2.5">
                          <Text className="text-2xl font-black tracking-tight" style={{ color: colors.primary }}>
                            {formatCompactNumber(upcomingSessions.length)}
                          </Text>
                          <ChevronRight size={18} color={textSecondaryColor} />
                        </View>
                      </TouchableOpacity>
                    </View>

                    {/* ─── 4. Client Info Card ─────────────────────────────────── */}
                    <Text style={{ color: textColor }} className="text-2xl font-black tracking-tight mb-3 px-1">
                      Client Info
                    </Text>
                    <View 
                      className="rounded-[32px] border overflow-hidden mb-8"
                      style={{ backgroundColor: cardBg, borderColor: cardBorder }}
                    >
                      <View className="p-5 border-b" style={{ borderBottomColor: cardBorder }}>
                        <View className="flex-row items-center gap-2 mb-1.5">
                          <Target size={16} color={colors.primary} />
                          <Text className="text-xs font-bold uppercase tracking-wider" style={{ color: textSecondaryColor }}>Goal</Text>
                        </View>
                        <Text className="text-base font-bold" style={{ color: textColor }}>{client.goal || 'Not set'}</Text>
                      </View>

                      <View className="p-5 border-b" style={{ borderBottomColor: cardBorder }}>
                        <View className="flex-row items-center gap-2 mb-1.5">
                          <Mail size={16} color={colors.primary} />
                          <Text className="text-xs font-bold uppercase tracking-wider" style={{ color: textSecondaryColor }}>Email</Text>
                        </View>
                        <Text className="text-base font-bold" style={{ color: textColor }} selectable>{client.profiles?.email || 'Not set'}</Text>
                      </View>

                      <View className="flex-row border-b" style={{ borderBottomColor: cardBorder }}>
                        <View className="flex-1 p-5 border-r" style={{ borderRightColor: cardBorder }}>
                          <View className="flex-row items-center gap-2 mb-1.5">
                            <Award size={16} color={colors.primary} />
                            <Text className="text-xs font-bold uppercase tracking-wider" style={{ color: textSecondaryColor }}>Experience</Text>
                          </View>
                          <Text className="text-base font-bold capitalize" style={{ color: textColor }}>{client.experience_level || 'Not set'}</Text>
                        </View>
                        <View className="flex-1 p-5">
                          <View className="flex-row items-center gap-2 mb-1.5">
                            <User size={16} color={colors.primary} />
                            <Text className="text-xs font-bold uppercase tracking-wider" style={{ color: textSecondaryColor }}>Height</Text>
                          </View>
                          <Text className="text-base font-bold" style={{ color: textColor }}>{client.height_cm ? `${client.height_cm} cm` : 'Not set'}</Text>
                        </View>
                      </View>

                      <View className="flex-row">
                        <View className="flex-1 p-5 border-r" style={{ borderRightColor: cardBorder }}>
                          <View className="flex-row items-center gap-2 mb-1.5">
                            <Clock size={16} color={colors.primary} />
                            <Text className="text-xs font-bold uppercase tracking-wider" style={{ color: textSecondaryColor }}>Age</Text>
                          </View>
                          <Text className="text-base font-bold" style={{ color: textColor }}>
                            {client.date_of_birth ? `${Math.floor((new Date().getTime() - new Date(client.date_of_birth).getTime()) / (1000 * 3600 * 24 * 365.25))} yrs` : 'Not set'}
                          </Text>
                        </View>
                        <View className="flex-1 p-5">
                          <View className="flex-row items-center gap-2 mb-1.5">
                            <Scale size={16} color={colors.primary} />
                            <Text className="text-xs font-bold uppercase tracking-wider" style={{ color: textSecondaryColor }}>Starting</Text>
                          </View>
                          <Text className="text-base font-bold" style={{ color: textColor }}>
                            {validWeights.length > 0 ? `${validWeights[validWeights.length - 1].weight_kg} kg` : 'Not set'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                ) : activeSubView === 'daily_tasks' ? (
                  <View className="px-3 pt-3">
                    <View className="mb-4 px-1">
                        <Text className="text-2xl font-black tracking-tight" style={{ color: textColor }}>Daily Tasks</Text>
                    </View>
                    {habits.length === 0 ? (
                        <View 
                            className="p-8 items-center justify-center rounded-[32px] border border-dashed"
                            style={{ backgroundColor: cardBg, borderColor: cardBorder }}
                        >
                             <View 
                               className="w-12 h-12 rounded-2xl items-center justify-center border mb-3"
                               style={{ backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}35` }}
                             >
                               <Target size={24} color={colors.primary} />
                             </View>
                             <Text className="font-black text-base" style={{ color: textColor }}>No Daily Tasks</Text>
                             <Text className="text-xs mt-1 text-center px-4" style={{ color: textSecondaryColor }}>No daily habits have been assigned to this client yet.</Text>
                             <TouchableOpacity 
                                onPress={() => router.push(`/(coach)/clients/create-protocol?clientId=${id}&autoAddNew=true`)}
                                className="mt-6 px-6 h-12 rounded-2xl flex-row items-center gap-2"
                                style={{ backgroundColor: colors.primary }}
                             >
                                <Plus size={16} color={colors.textOnPrimary || 'white'} />
                                <Text className="font-black text-xs uppercase tracking-wider" style={{ color: colors.textOnPrimary || 'white' }}>Assign Tasks</Text>
                             </TouchableOpacity>
                        </View>
                    ) : (
                        habits.map((habit, idx) => (
                            <View
                                key={habit.id}
                                style={{
                                    borderRadius: 30,
                                    overflow: 'hidden',
                                    marginBottom: 12,
                                    backgroundColor: cardBg,
                                }}
                            >
                                <Swipeable
                                    ref={ref => { swipeableRefs.current[habit.id] = ref; }}
                                    containerStyle={{
                                        borderRadius: 30,
                                        overflow: 'hidden',
                                        backgroundColor: cardBg,
                                    }}
                                    childrenContainerStyle={{
                                        borderRadius: 30,
                                        overflow: 'hidden',
                                        backgroundColor: cardBg,
                                    }}
                                    renderRightActions={(progress) => (
                                        <HabitSwipeActions
                                            progress={progress}
                                            cardBg={cardBg}
                                            cardBorder={cardBorder}
                                            textColor={textColor}
                                            onEdit={() => handleEditHabit(habit)}
                                            onDelete={() => handleDeleteHabit(habit.id)}
                                        />
                                    )}
                                >
                                    <MotiView 
                                        from={reduceMotion ? { opacity: 0 } : { opacity: 0, translateX: -10 }} 
                                        animate={reduceMotion ? { opacity: 1 } : { opacity: 1, translateX: 0 }} 
                                        transition={{ delay: reduceMotion ? 0 : idx * 50 }}
                                        className="rounded-[30px] p-5 border flex-row items-center gap-4"
                                        style={{ backgroundColor: cardBg, borderColor: cardBorder }}
                                    >
                                        <View 
                                            className="w-12 h-12 rounded-2xl items-center justify-center border"
                                            style={{ backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}35` }}
                                        >
                                            <Target size={20} color={colors.primary} />
                                        </View>
                                        <View className="flex-1">
                                            <Text className="font-black text-base" style={{ color: textColor }}>{habit.name}</Text>
                                            <Text className="text-xs font-medium mt-0.5" numberOfLines={1} style={{ color: textSecondaryColor }}>{habit.description || 'Daily task'}</Text>
                                        </View>
                                        <View 
                                            className="px-3 py-1 rounded-full border"
                                            style={{ backgroundColor: colors.background, borderColor: cardBorder }}
                                        >
                                            <Text className="text-[10px] font-black uppercase tracking-wider" style={{ color: textSecondaryColor }}>{habit.category || 'General'}</Text>
                                        </View>
                                        {isEditingHabits && (
                                            <TouchableOpacity onPress={() => handleEditHabit(habit)} className="p-2">
                                                <ChevronRight size={16} color={textSecondaryColor} />
                                            </TouchableOpacity>
                                        )}
                                    </MotiView>
                                </Swipeable>
                            </View>
                        ))
                    )}

                    {habits.length > 0 && (
                        <TouchableOpacity 
                            onPress={() => router.push(`/(coach)/clients/create-protocol?clientId=${id}&autoAddNew=true`)}
                            className="mt-2 p-5 rounded-[30px] border items-center border-dashed flex-row justify-center gap-2"
                            style={{ backgroundColor: cardBg, borderColor: cardBorder }}
                        >
                            <Plus size={18} color={colors.primary} />
                            <Text className="font-bold text-xs uppercase tracking-wider" style={{ color: colors.primary }}>Click to add tasks</Text>
                        </TouchableOpacity>
                    )}
                  </View>
                ) : activeSubView === 'weight_history' ? (
                  <View className="px-3 pt-3">
                    <View className="mb-4 px-1">
                      <Text className="text-2xl font-black tracking-tight" style={{ color: textColor }}>Weight History</Text>
                    </View>
                    {/* Summary Card */}
                    <View 
                      className="p-6 rounded-[32px] border mb-4 relative overflow-hidden"
                      style={{ backgroundColor: cardBg, borderColor: cardBorder }}
                    >
                      <View
                        style={{ backgroundColor: `${colors.primary}0D` }}
                        className="absolute -top-10 -right-10 w-32 h-32 rounded-full pointer-events-none"
                      />
                      <Text className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: textSecondaryColor }}>
                        Current Weight
                      </Text>
                      <View className="flex-row items-baseline gap-2">
                        <Text className="text-4xl font-black tracking-tighter leading-none mb-1" style={{ color: textColor }}>
                          {latestWeight ? latestWeight : '--'}
                        </Text>
                        <Text className="text-base font-bold" style={{ color: textSecondaryColor }}>
                          kg
                        </Text>
                      </View>

                      {/* Progress since first check-in */}
                      {(() => {
                        const firstWeight = validWeights.length > 0 ? Number(validWeights[validWeights.length - 1].weight_kg) : null;
                        const totalDiff = (latestWeight !== null && firstWeight !== null) ? Number((latestWeight - firstWeight).toFixed(1)) : null;
                        if (totalDiff === null || validWeights.length < 2) return null;
                        const isLoss = totalDiff < 0;
                        const isGain = totalDiff > 0;
                        return (
                          <View className="flex-row items-center gap-2 mt-4 pt-4 border-t" style={{ borderTopColor: cardBorder }}>
                            <View 
                              className="px-2.5 py-1 rounded-full border flex-row items-center gap-1"
                              style={{ 
                                backgroundColor: isLoss ? `${colors.primary}15` : isGain ? 'rgba(245,158,11,0.1)' : colors.background,
                                borderColor: isLoss ? `${colors.primary}30` : isGain ? 'rgba(245,158,11,0.2)' : cardBorder 
                              }}
                            >
                              <TrendingUp 
                                size={12} 
                                color={isLoss ? colors.primary : isGain ? '#F59E0B' : textSecondaryColor} 
                                style={isLoss ? { transform: [{ rotate: '180deg' }] } : undefined}
                              />
                              <Text 
                                className="font-black text-xs"
                                style={{ color: isLoss ? colors.primary : isGain ? '#F59E0B' : textSecondaryColor }}
                              >
                                {isLoss ? `${totalDiff} kg` : isGain ? `+${totalDiff} kg` : 'Stable'}
                              </Text>
                            </View>
                            <Text className="text-xs font-medium" style={{ color: textSecondaryColor }}>
                              since start ({validWeights[validWeights.length - 1].weight_kg} kg)
                            </Text>
                          </View>
                        );
                      })()}
                    </View>

                    <Text className="text-xs font-bold uppercase tracking-widest mb-3 ml-1" style={{ color: textSecondaryColor }}>
                      All Logs ({validWeights.length})
                    </Text>

                    {validWeights.length === 0 ? (
                      <View 
                        className="p-8 items-center justify-center rounded-[32px] border border-dashed"
                        style={{ backgroundColor: cardBg, borderColor: cardBorder }}
                      >
                        <View 
                          className="w-12 h-12 rounded-2xl items-center justify-center border mb-3"
                          style={{ backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}35` }}
                        >
                          <Scale size={24} color={colors.primary} />
                        </View>
                        <Text className="font-black text-base" style={{ color: textColor }}>No Weight Logged</Text>
                        <Text className="text-xs mt-1 text-center px-4" style={{ color: textSecondaryColor }}>The client hasn't recorded any weigh-ins yet.</Text>
                      </View>
                    ) : (
                      <View className="gap-2.5">
                        {validWeights.map((checkin, idx) => {
                          const currentWeight = Number(checkin.weight_kg);
                          const prevCheckin = validWeights[idx + 1];
                          const prevWeight = prevCheckin ? Number(prevCheckin.weight_kg) : null;
                          const diff = prevWeight !== null ? (currentWeight - prevWeight) : null;

                          return (
                            <MotiView
                              key={checkin.id}
                              from={reduceMotion ? { opacity: 0 } : { opacity: 0, translateY: 10 }}
                              animate={reduceMotion ? { opacity: 1 } : { opacity: 1, translateY: 0 }}
                              transition={{ delay: idx * 30 }}
                              className="rounded-[28px] p-4 border"
                              style={{ backgroundColor: cardBg, borderColor: cardBorder }}
                            >
                              <View className="flex-row items-center justify-between">
                                <View>
                                  <Text className="font-black text-base" style={{ color: textColor }}>
                                    {currentWeight} kg
                                  </Text>
                                  <Text className="font-medium text-xs mt-0.5" style={{ color: textSecondaryColor }}>
                                    {new Date(checkin.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                                  </Text>
                                </View>

                                {diff !== null && (
                                  <View 
                                    className="px-2.5 py-1 rounded-full border flex-row items-center gap-1"
                                    style={{ 
                                      backgroundColor: diff < 0 ? `${colors.primary}15` : diff > 0 ? 'rgba(245,158,11,0.1)' : colors.background,
                                      borderColor: diff < 0 ? `${colors.primary}30` : diff > 0 ? 'rgba(245,158,11,0.2)' : cardBorder
                                    }}
                                  >
                                    <TrendingUp 
                                      size={11} 
                                      color={diff < 0 ? colors.primary : diff > 0 ? '#F59E0B' : textSecondaryColor} 
                                      style={diff < 0 ? { transform: [{ rotate: '180deg' }] } : undefined}
                                    />
                                    <Text 
                                      className="font-black text-[10px] uppercase tracking-wider"
                                      style={{ color: diff < 0 ? colors.primary : diff > 0 ? '#F59E0B' : textSecondaryColor }}
                                    >
                                      {diff < 0 ? `${diff.toFixed(1)} kg` : diff > 0 ? `+${diff.toFixed(1)} kg` : 'Stable'}
                                    </Text>
                                  </View>
                                )}
                              </View>

                              {checkin.notes ? (
                                <View 
                                  className="mt-2.5 pt-2.5 border-t"
                                  style={{ borderTopColor: cardBorder }}
                                >
                                  <Text className="text-xs font-normal leading-4" style={{ color: textSecondaryColor }}>
                                    "{checkin.notes}"
                                  </Text>
                                </View>
                              ) : null}
                            </MotiView>
                          );
                        })}
                      </View>
                    )}
                  </View>
                ) : null}
            </ScrollView>

            {/* Floating Message Button */}
            {activeSubView === null && (
              <MotiView
                animate={{ scale: reduceMotion ? 1 : (messageFabPressed ? 0.82 : 1) }}
                transition={{ type: 'spring', damping: 14, stiffness: 320 } as any}
                style={{
                  position: 'absolute',
                  bottom: 24,
                  right: 20,
                  zIndex: 90,
                }}
              >
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Message Client"
                  activeOpacity={0.88}
                  onPressIn={() => setMessageFabPressed(true)}
                  onPressOut={() => setMessageFabPressed(false)}
                  onPress={() =>
                    router.push({
                      pathname: '/(coach)/chat/[id]',
                      params: { id: id as string },
                    })
                  }
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    backgroundColor: colors.primary,
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: colors.primary,
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.45,
                    shadowRadius: 12,
                    elevation: 8,
                    borderWidth: 1.5,
                    borderColor: 'rgba(255, 255, 255, 0.25)',
                  }}
                >
                  <MessageSquare size={24} color={colors.textOnPrimary || '#FFFFFF'} />
                </TouchableOpacity>
              </MotiView>
            )}
        </View>
      </SafeAreaView>

      {/* Scheduler Modal */}
      {client && (
        <SchedulerModal
          visible={schedulerVisible}
          onClose={() => setSchedulerVisible(false)}
          onConfirm={async (s) => { /* handle s */ await loadClientData(); }}
          clientContext={{ name: client.profiles?.full_name || 'Client', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, avatar_url: client.profiles?.avatar_url }}
          existingSessions={allCoachSessions}
          targetClientId={id as string}
        />
      )}

      <GoogleMeetGateModal
        visible={showGoogleMeetGate}
        coachId={coach?.id}
        expectedEmail={user?.email}
        onClose={() => setShowGoogleMeetGate(false)}
        onConnected={() => {
          setIsMeetConnected(true);
          setShowGoogleMeetGate(false);
          setSchedulerVisible(true);
        }}
      />

      {/* Pending Resolutions Modal */}
      <PendingResolutionsModal
        visible={pendingModalVisible}
        onClose={() => { setPendingModalVisible(false); loadClientData(); }}
        sessions={pendingResolutions}
        onResolve={(session) => {
            setPendingModalVisible(false);
            const proposedStart = new Date(session.scheduled_at).getTime();
            const proposedEnd = proposedStart + (session.duration_minutes || 60) * 60000;
            const existing = allCoachSessions.find(s => s.id !== session.id && s.status !== 'cancelled' && (new Date(s.scheduled_at).getTime() < proposedEnd && (new Date(s.scheduled_at).getTime() + (s.duration_minutes || 60) * 60000) > proposedStart));
            if (existing) {
                setCurrentConflict({ existingSession: { ...existing, client_name: existing.client_name }, proposedSession: { ...session, client_name: client.profiles?.full_name || 'Client' }, recommendations: [] });
                setConflictModalVisible(true);
            } else {
                 Alert.alert('No Conflict', 'Confirm this session?', [{ text: 'Cancel' }, { text: 'Confirm', onPress: async () => { await supabase.from('sessions').update({ status: 'scheduled' }).eq('id', session.id); loadClientData(); } }]);
            }
        }}
        onDelete={async (s) => { await supabase.from('sessions').delete().eq('id', s.id); loadClientData(); }}
      />

       {currentConflict && (
        <ConflictResolutionModal 
            visible={conflictModalVisible}
            conflictInfo={currentConflict}
            onCancel={() => { setConflictModalVisible(false); setCurrentConflict(null); }}
            onResolve={async () => { await loadClientData(); setConflictModalVisible(false); setCurrentConflict(null); }}
        />
       )}

       {/* Edit Habit Modal */}
       <Modal
         visible={editHabitModalVisible}
         animationType="slide"
         transparent={true}
       >
         <View className="flex-1 bg-black/60 justify-end">
           <View 
             className="rounded-t-[48px] p-8 border-t pb-16"
             style={{ backgroundColor: colors.surface, borderTopColor: colors.border }}
           >
             {/* Header */}
             <View className="flex-row justify-between items-center mb-10">
               <View>
                 <Text className="text-2xl font-black tracking-tight" style={{ color: colors.text }}>Edit Task</Text>
                 <Text className="text-[10px] uppercase tracking-[2px] font-black mt-1" style={{ color: colors.primary }}>Daily Task</Text>
               </View>
               <TouchableOpacity 
                 onPress={() => setEditHabitModalVisible(false)}
                 className="w-12 h-12 rounded-2xl items-center justify-center border"
                 style={{ backgroundColor: colors.background, borderColor: colors.border }}
               >
                 <Plus size={24} color={colors.textSecondary} style={{ transform: [{ rotate: '45deg' }] }} />
               </TouchableOpacity>
             </View>

             <View>
               {/* Task Name */}
               <View className="mb-8">
                 <Text className="text-[10px] font-black uppercase tracking-[2px] mb-3 ml-1" style={{ color: colors.textSecondary }}>Task Name</Text>
                 <TextInput
                   className="rounded-2xl px-6 py-5 font-bold text-lg border"
                   style={{ backgroundColor: colors.background, borderColor: colors.border, color: colors.text }}
                   value={editingName}
                   onChangeText={setEditingName}
                   placeholder="e.g. Morning Walk"
                   placeholderTextColor={colors.textTertiary}
                   selectionColor={colors.primary}
                 />
               </View>

               {/* Instructions */}
               <View className="mb-8">
                 <Text className="text-[10px] font-black uppercase tracking-[2px] mb-3 ml-1" style={{ color: colors.textSecondary }}>Instructions</Text>
                 <TextInput
                   className="rounded-2xl px-6 py-5 font-medium text-base min-h-[120px] border"
                   style={{ backgroundColor: colors.background, borderColor: colors.border, color: colors.text }}
                   value={editingDescription}
                   onChangeText={setEditingDescription}
                   placeholder="Add specific instructions for the client..."
                   placeholderTextColor={colors.textTertiary}
                   multiline
                   textAlignVertical="top"
                   selectionColor={colors.primary}
                 />
               </View>

               {/* Category Grid */}
               <View className="mb-10">
                 <Text className="text-[10px] font-black uppercase tracking-[2px] mb-4 ml-1" style={{ color: colors.textSecondary }}>Category</Text>
                 <View className="flex-row flex-wrap gap-3">
                   {['training', 'nutrition', 'recovery', 'consistency'].map((cat) => (
                     <TouchableOpacity
                       key={cat}
                       onPress={() => setEditingCategory(cat)}
                       className="flex-1 min-w-[140px] h-14 rounded-2xl border items-center justify-center"
                       style={editingCategory === cat ? {
                         backgroundColor: `${colors.primary}15`,
                         borderColor: `${colors.primary}40`
                       } : {
                         backgroundColor: colors.background,
                         borderColor: colors.border
                       }}
                     >
                       <Text 
                         className="text-[10px] font-black uppercase tracking-[1px]" 
                         style={{ color: editingCategory === cat ? colors.primary : colors.textSecondary }}
                       >
                         {cat}
                       </Text>
                     </TouchableOpacity>
                   ))}
                 </View>
               </View>

               {/* Submit Button */}
               <TouchableOpacity
                 onPress={handleUpdateHabit}
                 disabled={updating}
                 activeOpacity={0.8}
                 className="h-20 rounded-[28px] items-center justify-center shadow-2xl"
                 style={{ backgroundColor: updating ? colors.surface : colors.primary }}
               >
                 {updating ? (
                   <ActivityIndicator color={colors.textOnPrimary || 'white'} />
                 ) : (
                   <Text className="font-black text-lg uppercase tracking-[2px]" style={{ color: colors.textOnPrimary || 'white' }}>Save Task</Text>
                 )}
               </TouchableOpacity>
             </View>
           </View>
         </View>
       </Modal>

       {/* Floating Circular Edit Button for Daily Tasks */}
       {activeSubView === 'daily_tasks' && (
         <MotiView
           from={{ opacity: reduceMotion ? 1 : 0, scale: reduceMotion ? 1 : 0.8 }}
           animate={{ opacity: 1, scale: 1 }}
           style={{
             position: 'absolute',
             bottom: Platform.OS === 'ios' ? 36 : 24,
             right: 20,
             zIndex: 99,
           }}
         >
           <TouchableOpacity
             onPress={() => router.push(`/(coach)/clients/create-protocol?clientId=${id}`)}
             activeOpacity={0.8}
             style={{
               width: 56,
               height: 56,
               borderRadius: 28,
               backgroundColor: colors.primary,
               alignItems: 'center',
               justifyContent: 'center',
               shadowColor: colors.primary,
               shadowOffset: { width: 0, height: 6 },
               shadowOpacity: 0.35,
               shadowRadius: 10,
               elevation: 6,
             }}
           >
             <Edit2 size={22} color={colors.textOnPrimary || 'white'} strokeWidth={2.2} />
           </TouchableOpacity>
         </MotiView>
       )}
    </View>
  );
}

const InfoTile = ({ icon, label, value, fullWidth, selectable }: { icon: any, label: string, value: string, fullWidth?: boolean, selectable?: boolean }) => {
    const theme = useTheme();
    const colors = theme.colors;
    return (
        <View style={{ width: fullWidth ? '100%' : '50%' }}>
            <View className="flex-row items-center gap-2 mb-1">
                {icon}
                <Text className="text-[10px] font-black uppercase tracking-widest" style={{ color: colors.textSecondary }}>{label}</Text>
            </View>
            <Text className="font-bold text-base" style={{ color: colors.text }} selectable={selectable}>{value}</Text>
        </View>
    );
};
