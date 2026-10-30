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
} from 'lucide-react-native';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useTheme } from '@/contexts/BrandContext';
import { isDarkColor } from '@/lib/theme-utils';
import { BrandedAvatar } from '@/components/BrandedAvatar';
import SchedulerModal from '@/components/SchedulerModal';
import { CoachClientDetailsSkeleton } from '@/components/CoachClientDetailsSkeleton';
import PendingResolutionsModal from '@/components/PendingResolutionsModal';
import ConflictResolutionModal from '@/components/ConflictResolutionModal';
import { ProposedSession } from '@/lib/ai-scheduling-service';
import { MotiView, AnimatePresence } from 'moti';
import { useReducedMotion } from 'react-native-reanimated';

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
  const { coach } = useAuth();
  const theme = useTheme();
  const colors = theme.colors;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [client, setClient] = useState<any>(null);
  const [challenges, setChallenges] = useState<any[]>([]);
  const [schedulerVisible, setSchedulerVisible] = useState(false);
  const [allCoachSessions, setAllCoachSessions] = useState<any[]>([]);
  const [pendingResolutions, setPendingResolutions] = useState<any[]>([]);
  const [pendingModalVisible, setPendingModalVisible] = useState(false);
  const [challengeFilter, setChallengeFilter] = useState<'active' | 'history'>('active');
  type SubView = 'daily_tasks' | 'challenges' | 'checkins' | 'sessions' | 'weight_history' | null;
  const [activeSubView, setActiveSubView] = useState<SubView>(
    (tab as string) === 'checkins' ? 'checkins' : (tab as string) === 'daily_tasks' ? 'daily_tasks' : (tab as string) === 'challenges' ? 'challenges' : (tab as string) === 'sessions' ? 'sessions' : null
  );
  const [checkins, setCheckins] = useState<any[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [streak, setStreak] = useState(0);
  const [sessionLog, setSessionLog] = useState<any[]>([]);
  const [stepsLog, setStepsLog] = useState<any[]>([]);
  
  // Conflict Resolution State
  const [conflictModalVisible, setConflictModalVisible] = useState(false);
  const [currentConflict, setCurrentConflict] = useState<any>(null);
  // Habit Editing State
  const [isEditingHabits, setIsEditingHabits] = useState(false);
  const [isEditingChallenges, setIsEditingChallenges] = useState(false);
  const [editHabitModalVisible, setEditHabitModalVisible] = useState(false);
  const [selectedHabit, setSelectedHabit] = useState<Habit | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingDescription, setEditingDescription] = useState('');
  const [editingCategory, setEditingCategory] = useState<any>('general');
  const [updating, setUpdating] = useState(false);
  const [pastSessionsExpanded, setPastSessionsExpanded] = useState(false);
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
        .subscribe();

      return () => { supabase.removeChannel(subscription); };
    }
  }, [coach, id]);

  const loadClientData = async () => {
    try {
      if (!refreshing) setLoading(true);
      
      const { data: clientData, error: clientError } = await supabase.rpc('get_client_details', { target_client_id: id });
      if (clientError) throw clientError;
      setClient(clientData);

      const { data: challengesData, error: challengesError } = await supabase.rpc('get_coach_mother_challenges', { 
        p_coach_id: coach?.id,
        p_client_id: id 
      });
      if (challengesError) throw challengesError;
      setChallenges(challengesData || []);

      const { data: sessionsData, error: sessionsError } = await supabase.from('sessions').select(`*, client:clients!sessions_client_id_fkey(id, profiles(full_name))`).eq('coach_id', coach?.id).gte('scheduled_at', new Date().toISOString());
        
      if (!sessionsError && sessionsData) {
          const sessionsWithNames = sessionsData.map(s => ({ ...s, client_name: s.client?.profiles?.full_name || 'Unknown' }));
          setAllCoachSessions(sessionsWithNames);
          const pending = sessionsData.filter(s => s.client_id === id && (s.status === 'pending_resolution' || s.status === 'proposed' || (s.invite_sent === true && s.status === 'scheduled' && !s.cancellation_reason) || (s.cancellation_reason?.startsWith('pending_reschedule')) || (s.cancellation_reason === 'reschedule_rejected')));
          setPendingResolutions(pending);
      }

      const { data: checkinsData, error: checkinsError } = await supabase
        .from('check_ins')
        .select('*')
        .eq('client_id', id)
        .order('date', { ascending: false });
        
      if (!checkinsError && checkinsData) {
        setCheckins(checkinsData);
      }

      // Load Habits for Daily Tasks tab
      const { data: habitsData, error: habitsError } = await supabase
        .from('habits')
        .select('*')
        .eq('client_id', id)
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      if (!habitsError && habitsData) {
        setHabits(habitsData);
      }

      // Load Streak
      const viewerTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const { data: streakData } = await supabase.rpc('get_client_streak', { p_client_id: id, p_timezone: viewerTimezone });
      setStreak(streakData || 0);

      // Load Session Log
      const { data: sessionLogData, error: sessionLogError } = await supabase
        .from('sessions')
        .select('*')
        .eq('client_id', id)
        .order('scheduled_at', { ascending: false });

      if (!sessionLogError && sessionLogData) {
        setSessionLog(sessionLogData);
      }

      // Load steps logs
      const { data: stepsData } = await supabase
        .from('daily_logs')
        .select('*')
        .eq('client_id', id)
        .order('date', { ascending: false });
      if (stepsData) {
        setStepsLog(stepsData);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleDeleteChallenge = async (challengeId: string) => {
    Alert.alert(
      'Remove Challenge',
      'Are you sure? This will delete the challenge and all progress.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.from('mother_challenges').delete().eq('id', challengeId);
              if (error) throw error;
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setChallenges(prev => prev.filter(c => c.id !== challengeId));
            } catch (e: any) {
              Alert.alert('Error', e.message);
            }
          }
        }
      ]
    );
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

  const isDark = isDarkColor(colors.background || '#010417');
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const todayStr = `${yyyy}-${mm}-${dd}`;
  const todayLog = stepsLog.find(log => log.date === todayStr);
  const todaySteps = todayLog ? todayLog.steps : (stepsLog.length > 0 && stepsLog[0].steps ? stepsLog[0].steps : 0);

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

  const stepsTimeStr = useMemo(() => {
    if (todayLog) {
      return 'Today';
    }
    if (stepsLog.length > 0 && stepsLog[0]?.date) {
      return new Date(stepsLog[0].date + 'T00:00:00').toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      });
    }
    return 'Today';
  }, [todayLog, stepsLog]);

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
  const filteredChallenges = computedChallenges.filter(c => challengeFilter === 'active' ? c.status === 'active' : c.status === 'completed');
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
                    <TouchableOpacity 
                      onPress={() => setSchedulerVisible(true)} 
                      className="w-10 h-10 rounded-2xl items-center justify-center border"
                      style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                    >
                        <CalendarIcon size={18} color={colors.primary} />
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <View className="flex-row items-center gap-3.5 flex-1 pr-3">
                        <TouchableOpacity 
                          onPress={() => setActiveSubView(null)} 
                          className="w-10 h-10 rounded-2xl items-center justify-center border"
                          style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                        >
                            <ArrowLeft size={18} color={colors.text} />
                        </TouchableOpacity>
                        <View className="flex-1">
                            <Text className="text-lg font-black tracking-tight" numberOfLines={1} style={{ color: colors.text }}>
                              {activeSubView === 'daily_tasks' ? 'Daily Tasks'
                                : activeSubView === 'challenges' ? 'Challenges'
                                : activeSubView === 'checkins' ? 'Check-ins'
                                : activeSubView === 'sessions' ? 'Sessions'
                                : 'Weight History'}
                            </Text>
                            <Text className="text-xs font-medium" numberOfLines={1} style={{ color: colors.textSecondary }}>
                              {client.profiles?.full_name}
                            </Text>
                        </View>
                    </View>
                    {activeSubView === 'sessions' ? (
                      <TouchableOpacity 
                        onPress={() => setSchedulerVisible(true)} 
                        className="w-10 h-10 rounded-2xl items-center justify-center border"
                        style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                      >
                        <CalendarIcon size={18} color={colors.primary} />
                      </TouchableOpacity>
                    ) : activeSubView === 'challenges' ? (
                      <TouchableOpacity 
                        onPress={() => router.push(`/(coach)/clients/create-selection?clientId=${id}`)} 
                        className="h-10 px-3.5 rounded-2xl flex-row items-center gap-1.5"
                        style={{ backgroundColor: colors.primary }}
                      >
                        <Plus size={16} color={colors.textOnPrimary || 'white'} />
                        <Text className="font-bold text-xs" style={{ color: colors.textOnPrimary || 'white' }}>Create</Text>
                      </TouchableOpacity>
                    ) : activeSubView === 'daily_tasks' ? (
                      <TouchableOpacity 
                        onPress={() => router.push(`/(coach)/clients/create-protocol?clientId=${id}`)} 
                        className="h-10 px-3.5 rounded-2xl flex-row items-center gap-1.5"
                        style={{ backgroundColor: colors.primary }}
                      >
                        <Plus size={16} color={colors.textOnPrimary || 'white'} />
                        <Text className="font-bold text-xs" style={{ color: colors.textOnPrimary || 'white' }}>Add</Text>
                      </TouchableOpacity>
                    ) : null}
                  </>
                )}
            </View>

            {pendingResolutions.length > 0 && activeSubView === null && (
                <TouchableOpacity 
                    className="mx-6 mt-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex-row items-center justify-between"
                    onPress={() => setPendingModalVisible(true)}
                >
                    <View className="flex-row items-center gap-3">
                        <View className="w-2 h-2 rounded-full bg-amber-500" />
                        <Text className="text-amber-500 font-bold text-xs uppercase tracking-widest">{pendingResolutions.length} Resolutions Pending</Text>
                    </View>
                    <ChevronRight size={16} color="#F59E0B" />
                </TouchableOpacity>
            )}

            <ScrollView 
                className="flex-1"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 120 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
            >
                {activeSubView === null ? (
                  <View className="px-6 pt-6">
                    {/* ─── 1. Steps Card (Apple Design) ───────────────────────── */}
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => router.push(`/(client)/analytics-detail?metric=steps&clientId=${id}` as any)}
                      style={{
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                      }}
                      className="p-6 rounded-[32px] border shadow-sm mb-4"
                    >
                      <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center gap-2.5">
                          <View
                            style={{ backgroundColor: `${colors.primary}16` }}
                            className="w-9 h-9 rounded-xl items-center justify-center"
                          >
                            <Flame size={18} color={colors.primary} />
                          </View>
                          <Text style={{ color: colors.text }} className="text-lg font-black tracking-tight">
                            Steps
                          </Text>
                        </View>

                        <View className="flex-row items-center gap-1">
                          <Text style={{ color: colors.textSecondary }} className="text-xs font-semibold">
                            {stepsTimeStr}
                          </Text>
                          <ChevronRight size={18} color={colors.textSecondary} />
                        </View>
                      </View>

                      <View className="flex-row items-end justify-between mt-4">
                        <View className="flex-row items-baseline gap-2">
                          <Text style={{ color: colors.text }} className="text-3xl font-black tracking-tight">
                            {(todaySteps || 0).toLocaleString()}
                          </Text>
                          <Text style={{ color: colors.textSecondary }} className="text-base font-bold">
                            steps
                          </Text>
                        </View>

                        <MiniBarChart data={stepsChartData} color={colors.primary} isDark={isDark} />
                      </View>
                    </TouchableOpacity>

                    {/* ─── 2. Quick Health Metric Cards (2x2 Grid) ─────────────── */}
                    <View className="flex-row flex-wrap justify-between gap-3 mb-4">
                      {/* Active Streak */}
                      <View 
                        className="w-[48%] rounded-[28px] p-4 border justify-between"
                        style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                      >
                        <View className="flex-row items-center justify-between mb-3">
                          <View className="w-8 h-8 rounded-xl items-center justify-center bg-emerald-500/10 border border-emerald-500/20">
                            <Award size={16} color="#10B981" />
                          </View>
                          <Text className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">Streak</Text>
                        </View>
                        <View>
                          <Text className="text-2xl font-black tracking-tight" style={{ color: colors.text }}>
                            {streak} <Text className="text-xs font-bold" style={{ color: colors.textSecondary }}>Days</Text>
                          </Text>
                          <Text className="text-[11px] font-semibold mt-0.5" style={{ color: colors.textSecondary }}>Active Streak</Text>
                        </View>
                      </View>

                      {/* Weight Card */}
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => setActiveSubView('weight_history')}
                        className="w-[48%] rounded-[28px] p-4 border justify-between"
                        style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                      >
                        <View className="flex-row items-center justify-between mb-3">
                          <View className="w-8 h-8 rounded-xl items-center justify-center bg-amber-500/10 border border-amber-500/20">
                            <Scale size={16} color="#F59E0B" />
                          </View>
                          {weightDaysAgo > 5 ? (
                            <View className="bg-red-500/10 px-1.5 py-0.5 rounded-md border border-red-500/20">
                              <Text className="text-red-500 text-[8px] font-bold uppercase">Update</Text>
                            </View>
                          ) : (
                            <ChevronRight size={14} color={colors.textSecondary} />
                          )}
                        </View>
                        <View>
                          <Text className="text-2xl font-black tracking-tight" style={{ color: colors.text }}>
                            {latestWeight ? latestWeight : '--'} <Text className="text-xs font-bold" style={{ color: colors.textSecondary }}>kg</Text>
                          </Text>
                          <Text className="text-[11px] font-semibold mt-0.5" style={{ color: colors.textSecondary }}>
                            {weightDaysAgo > 5 ? `${weightDaysAgo}d ago` : 'Last Weight'}
                          </Text>
                        </View>
                      </TouchableOpacity>

                      {/* Avg Sleep */}
                      <View 
                        className="w-[48%] rounded-[28px] p-4 border justify-between"
                        style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                      >
                        <View className="flex-row items-center justify-between mb-3">
                          <View className="w-8 h-8 rounded-xl items-center justify-center bg-indigo-500/10 border border-indigo-500/20">
                            <Clock size={16} color="#6366F1" />
                          </View>
                          <Text className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">Sleep</Text>
                        </View>
                        <View>
                          <Text className="text-2xl font-black tracking-tight" style={{ color: colors.text }}>
                            {avgSleep ? avgSleep : '--'} <Text className="text-xs font-bold" style={{ color: colors.textSecondary }}>hrs</Text>
                          </Text>
                          <Text className="text-[11px] font-semibold mt-0.5" style={{ color: colors.textSecondary }}>Avg Sleep</Text>
                        </View>
                      </View>

                      {/* Avg Energy */}
                      <View 
                        className="w-[48%] rounded-[28px] p-4 border justify-between"
                        style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                      >
                        <View className="flex-row items-center justify-between mb-3">
                          <View className="w-8 h-8 rounded-xl items-center justify-center bg-orange-500/10 border border-orange-500/20">
                            <Zap size={16} color="#F97316" />
                          </View>
                          <Text className="text-[10px] font-bold uppercase tracking-wider text-orange-400">Energy</Text>
                        </View>
                        <View>
                          <Text className="text-2xl font-black tracking-tight" style={{ color: colors.text }}>
                            {avgEnergy ? avgEnergy : '--'} <Text className="text-xs font-bold" style={{ color: colors.textSecondary }}>/10</Text>
                          </Text>
                          <Text className="text-[11px] font-semibold mt-0.5" style={{ color: colors.textSecondary }}>Avg Energy</Text>
                        </View>
                      </View>
                    </View>

                    {/* ─── 3. Weight History Row ───────────────────────────────── */}
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => setActiveSubView('weight_history')}
                      className="p-4 rounded-[24px] border flex-row items-center justify-between mb-6"
                      style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                    >
                      <View className="flex-row items-center gap-3">
                        <View className="w-9 h-9 rounded-xl items-center justify-center bg-amber-500/10 border border-amber-500/20">
                          <Scale size={18} color="#F59E0B" />
                        </View>
                        <View>
                          <Text className="text-sm font-black" style={{ color: colors.text }}>Weight History</Text>
                          <Text className="text-xs font-medium" style={{ color: colors.textSecondary }}>
                            {validWeights.length > 0 ? `${validWeights.length} logs recorded` : 'No weigh-ins yet'}
                          </Text>
                        </View>
                      </View>
                      <View className="flex-row items-center gap-1.5">
                        {latestWeight && (
                          <View className="px-2.5 py-1 rounded-full border mr-1" style={{ backgroundColor: colors.background, borderColor: colors.border }}>
                            <Text className="text-xs font-bold" style={{ color: colors.text }}>{latestWeight} kg</Text>
                          </View>
                        )}
                        <ChevronRight size={18} color={colors.textSecondary} />
                      </View>
                    </TouchableOpacity>

                    {/* ─── 4. Manage Client Hub Cards ──────────────────────────── */}
                    <Text className="text-xs font-bold uppercase tracking-widest mb-3 ml-1" style={{ color: colors.textSecondary }}>
                      Manage
                    </Text>
                    <View className="gap-3 mb-6">
                      {/* Daily Tasks Card */}
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => setActiveSubView('daily_tasks')}
                        className="p-5 rounded-[28px] border flex-row items-center justify-between"
                        style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                      >
                        <View className="flex-row items-center gap-3.5 flex-1 pr-3">
                          <View
                            className="w-11 h-11 rounded-2xl items-center justify-center border"
                            style={{ backgroundColor: `${colors.primary}15`, borderColor: `${colors.primary}30` }}
                          >
                            <Target size={20} color={colors.primary} />
                          </View>
                          <View className="flex-1">
                            <Text className="text-base font-black tracking-tight" style={{ color: colors.text }}>
                              Daily Tasks
                            </Text>
                            <Text className="text-xs font-medium mt-0.5" style={{ color: colors.textSecondary }}>
                              {habits.length > 0 ? `${habits.length} active daily tasks` : 'Assign daily habits'}
                            </Text>
                          </View>
                        </View>
                        <View className="flex-row items-center gap-2">
                          <View className="px-2.5 py-1 rounded-full border" style={{ backgroundColor: colors.background, borderColor: colors.border }}>
                            <Text className="text-xs font-bold" style={{ color: colors.primary }}>{habits.length}</Text>
                          </View>
                          <ChevronRight size={18} color={colors.textSecondary} />
                        </View>
                      </TouchableOpacity>

                      {/* Challenges Card */}
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => setActiveSubView('challenges')}
                        className="p-5 rounded-[28px] border flex-row items-center justify-between"
                        style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                      >
                        <View className="flex-row items-center gap-3.5 flex-1 pr-3">
                          <View className="w-11 h-11 rounded-2xl items-center justify-center bg-amber-500/10 border border-amber-500/20">
                            <Award size={20} color="#F59E0B" />
                          </View>
                          <View className="flex-1">
                            <Text className="text-base font-black tracking-tight" style={{ color: colors.text }}>
                              Challenges
                            </Text>
                            <Text className="text-xs font-medium mt-0.5" style={{ color: colors.textSecondary }}>
                              {activeChallengesCount > 0 ? `${activeChallengesCount} active challenges` : 'Start a challenge'}
                            </Text>
                          </View>
                        </View>
                        <View className="flex-row items-center gap-2">
                          <View className="px-2.5 py-1 rounded-full border" style={{ backgroundColor: colors.background, borderColor: colors.border }}>
                            <Text className="text-xs font-bold" style={{ color: '#F59E0B' }}>{activeChallengesCount}</Text>
                          </View>
                          <ChevronRight size={18} color={colors.textSecondary} />
                        </View>
                      </TouchableOpacity>

                      {/* Check-ins Card */}
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => setActiveSubView('checkins')}
                        className="p-5 rounded-[28px] border flex-row items-center justify-between"
                        style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                      >
                        <View className="flex-row items-center gap-3.5 flex-1 pr-3">
                          <View className="w-11 h-11 rounded-2xl items-center justify-center bg-emerald-500/10 border border-emerald-500/20">
                            <CalendarIcon size={20} color="#10B981" />
                          </View>
                          <View className="flex-1">
                            <Text className="text-base font-black tracking-tight" style={{ color: colors.text }}>
                              Check-ins
                            </Text>
                            <Text className="text-xs font-medium mt-0.5" style={{ color: colors.textSecondary }}>
                              {checkins.length > 0 ? `${checkins.length} check-ins logged` : 'No logs recorded'}
                            </Text>
                          </View>
                        </View>
                        <View className="flex-row items-center gap-2">
                          <View className="px-2.5 py-1 rounded-full border" style={{ backgroundColor: colors.background, borderColor: colors.border }}>
                            <Text className="text-xs font-bold" style={{ color: '#10B981' }}>{checkins.length}</Text>
                          </View>
                          <ChevronRight size={18} color={colors.textSecondary} />
                        </View>
                      </TouchableOpacity>

                      {/* Sessions Card */}
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => setActiveSubView('sessions')}
                        className="p-5 rounded-[28px] border flex-row items-center justify-between"
                        style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                      >
                        <View className="flex-row items-center gap-3.5 flex-1 pr-3">
                          <View className="w-11 h-11 rounded-2xl items-center justify-center bg-indigo-500/10 border border-indigo-500/20">
                            <Clock size={20} color="#6366F1" />
                          </View>
                          <View className="flex-1">
                            <Text className="text-base font-black tracking-tight" style={{ color: colors.text }}>
                              Sessions
                            </Text>
                            <Text className="text-xs font-medium mt-0.5" style={{ color: colors.textSecondary }}>
                              {upcomingSessions.length > 0 ? `${upcomingSessions.length} upcoming scheduled` : 'Weekly schedule'}
                            </Text>
                          </View>
                        </View>
                        <View className="flex-row items-center gap-2">
                          <View className="px-2.5 py-1 rounded-full border" style={{ backgroundColor: colors.background, borderColor: colors.border }}>
                            <Text className="text-xs font-bold" style={{ color: '#6366F1' }}>{upcomingSessions.length}</Text>
                          </View>
                          <ChevronRight size={18} color={colors.textSecondary} />
                        </View>
                      </TouchableOpacity>

                      {/* Analytics Card */}
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => router.push(`/(client)/analytics?clientId=${id}` as any)}
                        className="p-5 rounded-[28px] border flex-row items-center justify-between"
                        style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                      >
                        <View className="flex-row items-center gap-3.5 flex-1 pr-3">
                          <View
                            className="w-11 h-11 rounded-2xl items-center justify-center border"
                            style={{ backgroundColor: `${colors.primary}15`, borderColor: `${colors.primary}30` }}
                          >
                            <Activity size={20} color={colors.primary} />
                          </View>
                          <View className="flex-1">
                            <Text className="text-base font-black tracking-tight" style={{ color: colors.text }}>
                              Analytics
                            </Text>
                            <Text className="text-xs font-medium mt-0.5" style={{ color: colors.textSecondary }}>
                              Steps, sleep, energy & trends
                            </Text>
                          </View>
                        </View>
                        <View className="flex-row items-center gap-2">
                          <View className="px-2.5 py-1 rounded-full border" style={{ backgroundColor: colors.background, borderColor: colors.border }}>
                            <Text className="text-xs font-bold" style={{ color: colors.primary }}>View</Text>
                          </View>
                          <ChevronRight size={18} color={colors.textSecondary} />
                        </View>
                      </TouchableOpacity>
                    </View>

                    {/* ─── 5. Client Info Card (Apple Grouped Style) ─────────────── */}
                    <Text className="text-xs font-bold uppercase tracking-widest mb-3 ml-1" style={{ color: colors.textSecondary }}>
                      Client Info
                    </Text>
                    <View 
                      className="rounded-[28px] border overflow-hidden mb-8"
                      style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                    >
                      <View className="p-5 border-b" style={{ borderBottomColor: colors.border }}>
                        <View className="flex-row items-center gap-2.5 mb-1.5">
                          <Target size={16} color={colors.primary} />
                          <Text className="text-xs font-bold uppercase tracking-wider" style={{ color: colors.textSecondary }}>Goal</Text>
                        </View>
                        <Text className="text-base font-bold" style={{ color: colors.text }}>{client.goal || 'Not set'}</Text>
                      </View>

                      <View className="p-5 border-b" style={{ borderBottomColor: colors.border }}>
                        <View className="flex-row items-center gap-2.5 mb-1.5">
                          <Mail size={16} color={colors.primary} />
                          <Text className="text-xs font-bold uppercase tracking-wider" style={{ color: colors.textSecondary }}>Email</Text>
                        </View>
                        <Text className="text-base font-bold" style={{ color: colors.text }} selectable>{client.profiles?.email || 'Not set'}</Text>
                      </View>

                      <View className="flex-row border-b" style={{ borderBottomColor: colors.border }}>
                        <View className="flex-1 p-5 border-r" style={{ borderRightColor: colors.border }}>
                          <View className="flex-row items-center gap-2 mb-1.5">
                            <Award size={16} color={colors.primary} />
                            <Text className="text-xs font-bold uppercase tracking-wider" style={{ color: colors.textSecondary }}>Experience</Text>
                          </View>
                          <Text className="text-base font-bold capitalize" style={{ color: colors.text }}>{client.experience_level || 'Not set'}</Text>
                        </View>
                        <View className="flex-1 p-5">
                          <View className="flex-row items-center gap-2 mb-1.5">
                            <User size={16} color={colors.primary} />
                            <Text className="text-xs font-bold uppercase tracking-wider" style={{ color: colors.textSecondary }}>Height</Text>
                          </View>
                          <Text className="text-base font-bold" style={{ color: colors.text }}>{client.height_cm ? `${client.height_cm} cm` : 'Not set'}</Text>
                        </View>
                      </View>

                      <View className="flex-row">
                        <View className="flex-1 p-5 border-r" style={{ borderRightColor: colors.border }}>
                          <View className="flex-row items-center gap-2 mb-1.5">
                            <Clock size={16} color={colors.primary} />
                            <Text className="text-xs font-bold uppercase tracking-wider" style={{ color: colors.textSecondary }}>Age</Text>
                          </View>
                          <Text className="text-base font-bold" style={{ color: colors.text }}>
                            {client.date_of_birth ? `${Math.floor((new Date().getTime() - new Date(client.date_of_birth).getTime()) / (1000 * 3600 * 24 * 365.25))} yrs` : 'Not set'}
                          </Text>
                        </View>
                        <View className="flex-1 p-5">
                          <View className="flex-row items-center gap-2 mb-1.5">
                            <Scale size={16} color={colors.primary} />
                            <Text className="text-xs font-bold uppercase tracking-wider" style={{ color: colors.textSecondary }}>Starting</Text>
                          </View>
                          <Text className="text-base font-bold" style={{ color: colors.text }}>
                            {validWeights.length > 0 ? `${validWeights[validWeights.length - 1].weight_kg} kg` : 'Not set'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                ) : activeSubView === 'daily_tasks' ? (
                  <View className="px-6 py-8">
                    <View className="flex-row items-center justify-between mb-8 ml-1">
                        <Text className="text-[10px] font-black uppercase tracking-[4px]" style={{ color: colors.textSecondary }}>Daily Tasks</Text>
                        {habits.length > 0 && (
                            <TouchableOpacity onPress={() => router.push(`/(coach)/clients/create-protocol?clientId=${id}`)}>
                                <Text className="text-[10px] font-black uppercase tracking-widest" style={{ color: colors.primary }}>Edit</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                    {habits.length === 0 ? (
                        <View 
                            className="p-12 items-center justify-center rounded-[40px] border border-dashed"
                            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                        >
                             <Zap size={32} color={colors.textSecondary} />
                             <Text className="font-black text-xs uppercase mt-6" style={{ color: colors.text }}>No Daily Tasks</Text>
                             <Text className="text-[10px] mt-2 text-center px-4 leading-4" style={{ color: colors.textSecondary }}>No daily habits have been assigned to this client yet.</Text>
                             <TouchableOpacity 
                                onPress={() => router.push(`/(coach)/clients/create-protocol?clientId=${id}`)}
                                className="mt-8 px-6 h-12 rounded-full flex-row items-center gap-2 border"
                                style={{ backgroundColor: `${colors.primary}15`, borderColor: `${colors.primary}30` }}
                             >
                                <Plus size={16} color={colors.primary} />
                                <Text className="font-black text-[10px] uppercase tracking-widest" style={{ color: colors.primary }}>Assign Tasks</Text>
                             </TouchableOpacity>
                        </View>
                    ) : (
                        habits.map((habit, idx) => (
                            <Swipeable
                                key={habit.id}
                                ref={ref => { swipeableRefs.current[habit.id] = ref; }}
                                renderRightActions={() => (
                                    <View className="flex-row mb-4 pl-4">
                                        <TouchableOpacity 
                                            onPress={() => handleEditHabit(habit)}
                                            className="w-16 h-full rounded-3xl items-center justify-center border mr-2"
                                            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                                        >
                                            <Edit2 size={20} color={colors.text} />
                                        </TouchableOpacity>
                                        <TouchableOpacity 
                                            onPress={() => handleDeleteHabit(habit.id)}
                                            className="w-16 h-full bg-red-500 rounded-3xl items-center justify-center shadow-lg shadow-red-500/20"
                                        >
                                            <Trash2 size={20} color="white" />
                                        </TouchableOpacity>
                                    </View>
                                )}
                            >
                                <MotiView 
                                    from={{ opacity: 0, translateX: -10 }} 
                                    animate={{ opacity: 1, translateX: 0 }} 
                                    transition={{ delay: idx * 50 }}
                                    className="rounded-[32px] p-6 mb-4 border flex-row items-center gap-4"
                                    style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                                >
                                    <View 
                                        className="w-12 h-12 rounded-2xl items-center justify-center border"
                                        style={{ backgroundColor: `${colors.primary}15`, borderColor: `${colors.primary}30` }}
                                    >
                                        <Target size={20} color={colors.primary} />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="font-black text-base" style={{ color: colors.text }}>{habit.name}</Text>
                                        <Text className="text-xs font-medium mt-1" numberOfLines={1} style={{ color: colors.textSecondary }}>{habit.description || 'No instructions provided'}</Text>
                                    </View>
                                    <View 
                                        className="px-3 py-1.5 rounded-full border"
                                        style={{ backgroundColor: colors.background, borderColor: colors.border }}
                                    >
                                        <Text className="text-[8px] font-black uppercase tracking-widest" style={{ color: colors.textSecondary }}>{habit.category || 'General'}</Text>
                                    </View>
                                    {isEditingHabits && (
                                        <TouchableOpacity onPress={() => handleEditHabit(habit)} className="p-2">
                                            <ChevronRight size={16} color={colors.textSecondary} />
                                        </TouchableOpacity>
                                    )}
                                </MotiView>
                            </Swipeable>
                        ))
                    )}

                    {habits.length > 0 && (
                        <TouchableOpacity 
                            onPress={() => router.push(`/(coach)/clients/create-protocol?clientId=${id}`)}
                            className="mt-4 p-8 rounded-[40px] border items-center border-dashed"
                            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                        >
                            <View 
                                className="w-12 h-12 rounded-full items-center justify-center border mb-4"
                                style={{ backgroundColor: colors.background, borderColor: colors.border }}
                            >
                                <Plus size={20} color={colors.textSecondary} />
                            </View>
                            <Text className="font-black text-sm uppercase tracking-widest" style={{ color: colors.text }}>Add or Edit Tasks</Text>
                        </TouchableOpacity>
                    )}
                  </View>
                ) : activeSubView === 'challenges' ? (
                  <View className="px-6 py-8">
                    <View className="flex-row justify-between items-center mb-8">
                        <View className="flex-row gap-6">
                            <TouchableOpacity onPress={() => setChallengeFilter('active')}>
                                <Text className="text-2xl font-black" style={{ color: challengeFilter === 'active' ? colors.text : colors.textSecondary }}>Active</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setChallengeFilter('history')}>
                                <Text className="text-2xl font-black" style={{ color: challengeFilter === 'history' ? colors.text : colors.textSecondary }}>History</Text>
                            </TouchableOpacity>
                        </View>
                        <View className="flex-row gap-2">
                             <TouchableOpacity 
                                onPress={() => router.push(`/(coach)/clients/ai-selection?clientId=${id}`)} 
                                className="w-10 h-10 rounded-full items-center justify-center border shadow-lg"
                                style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                             >
                                <Sparkles size={18} color={colors.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity 
                                onPress={() => router.push(`/(coach)/clients/create-selection?clientId=${id}`)} 
                                className="h-10 px-4 rounded-full flex-row items-center gap-2 shadow-lg"
                                style={{ backgroundColor: colors.primary }}
                            >
                                <Plus size={16} color={colors.textOnPrimary || 'white'} />
                                <Text className="font-black text-xs uppercase" style={{ color: colors.textOnPrimary || 'white' }}>Create</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {filteredChallenges.length === 0 ? (
                        <View 
                            className="p-12 items-center justify-center rounded-[40px] border border-dashed"
                            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                        >
                             <Zap size={32} color={colors.textSecondary} />
                             <Text className="font-black text-xs uppercase mt-6" style={{ color: colors.text }}>No Challenges</Text>
                             <Text className="text-[10px] mt-2 text-center px-4 leading-4" style={{ color: colors.textSecondary }}>No challenges started yet.</Text>
                        </View>
                    ) : (
                        filteredChallenges.map((challenge, idx) => (
                            <ChallengeCard 
                                key={challenge.id} 
                                challenge={challenge} 
                                coachId={id as string} 
                                index={idx} 
                                isEditing={isEditingChallenges}
                                onDelete={() => handleDeleteChallenge(challenge.id)}
                            />
                        ))
                    )}

                    {/* Launch Section */}
                    <View 
                        className="mt-10 p-10 rounded-[48px] border items-center"
                        style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                    >
                        <View 
                            className="w-16 h-16 rounded-full items-center justify-center border mb-6"
                            style={{ backgroundColor: colors.background, borderColor: colors.border }}
                        >
                            <Plus size={32} color={colors.textSecondary} />
                        </View>
                        <Text className="text-2xl font-black mb-4 text-center" style={{ color: colors.text }}>Start a Challenge</Text>
                        <Text className="text-xs font-medium text-center mb-10 leading-5" style={{ color: colors.textSecondary }}>
                            Create a custom challenge or generate one with AI.
                        </Text>
                        <View className="flex-row gap-4 w-full">
                            <TouchableOpacity 
                                onPress={() => router.push(`/(coach)/clients/create-selection?clientId=${id}`)}
                                className="flex-1 h-14 rounded-full items-center justify-center border"
                                style={{ backgroundColor: colors.background, borderColor: colors.border }}
                            >
                                <Text className="font-bold text-xs uppercase" style={{ color: colors.text }}>Custom</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                onPress={() => router.push(`/(coach)/clients/ai-selection?clientId=${id}`)}
                                className="flex-1 h-14 rounded-full items-center justify-center"
                                style={{ backgroundColor: colors.primary }}
                            >
                                <Text className="font-bold text-xs uppercase" style={{ color: colors.textOnPrimary || 'white' }}>Use AI</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                  </View>
                ) : activeSubView === 'checkins' ? (
                  <View className="px-6 py-8">
                    {checkins.length === 0 ? (
                        <View 
                            className="p-12 items-center justify-center rounded-[40px] border border-dashed"
                            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                        >
                             <Target size={32} color={colors.textSecondary} />
                             <Text className="font-black text-xs uppercase mt-6" style={{ color: colors.text }}>No Check-ins Yet</Text>
                             <Text className="text-[10px] mt-2 text-center px-4 leading-4" style={{ color: colors.textSecondary }}>The client hasn't logged any daily check-ins.</Text>
                        </View>
                    ) : (
                        checkins.map((checkin, idx) => (
                            <MotiView 
                                key={checkin.id}
                                from={{ opacity: 0, translateY: 10 }} 
                                animate={{ opacity: 1, translateY: 0 }} 
                                transition={{ delay: idx * 50 }}
                                className="rounded-[32px] p-6 mb-4 border"
                                style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                            >
                                <View className="flex-row justify-between items-center mb-4">
                                    <Text className="font-black text-lg" style={{ color: colors.text }}>{new Date(checkin.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</Text>
                                    <View className="bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
                                        <Text className="text-emerald-400 text-[10px] font-black uppercase tracking-[2px]">Logged</Text>
                                    </View>
                                </View>
                                
                                <View className="flex-row flex-wrap gap-y-4 mb-4">
                                    <View className="w-1/2 flex-row items-center gap-2">
                                        <Scale size={16} color={colors.textSecondary} />
                                        <Text className="font-bold" style={{ color: colors.text }}>{checkin.weight_kg ? `${checkin.weight_kg} kg` : '--'}</Text>
                                    </View>
                                    <View className="w-1/2 flex-row items-center gap-2">
                                        <Clock size={16} color={colors.textSecondary} />
                                        <Text className="font-bold" style={{ color: colors.text }}>{checkin.sleep_hours ? `${checkin.sleep_hours} hrs` : '--'}</Text>
                                    </View>
                                    <View className="w-1/2 flex-row items-center gap-2">
                                        <Zap size={16} color={colors.textSecondary} />
                                        <Text className="font-bold" style={{ color: colors.text }}>Energy: {checkin.energy_level ? `${checkin.energy_level}/10` : '--'}</Text>
                                    </View>
                                </View>

                                {checkin.notes && (
                                    <View 
                                        className="mt-2 p-4 rounded-2xl border"
                                        style={{ backgroundColor: colors.background, borderColor: colors.border }}
                                    >
                                        <Text className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: colors.textSecondary }}>Notes</Text>
                                        <Text className="text-sm leading-5" style={{ color: colors.text }}>{checkin.notes}</Text>
                                    </View>
                                )}
                            </MotiView>
                        ))
                    )}
                  </View>
                ) : activeSubView === 'sessions' ? (() => {
                  // Compute Weekly Slots and Ad-Hoc/Past Sessions
                  const activeWeeklySlots = sessionLog.filter(s => s.recurrence_rule && s.recurrence_rule.includes('WEEKLY'));
                  const weeklySlotConfigs = activeWeeklySlots.map(s => {
                    const d = new Date(s.scheduled_at);
                    return {
                      dayOfWeek: d.getDay(),
                      hour: d.getHours(),
                      minute: d.getMinutes(),
                      sessionType: s.session_type,
                      duration: s.duration_minutes || 60,
                      session: s
                    };
                  });

                  const upcomingSessions = sessionLog.filter(s => {
                    return s.status === 'scheduled' && new Date(s.scheduled_at) > new Date();
                  });

                  const upcomingWeeklyOccurrences: any[] = [];
                  const upcomingAdHocSessions: any[] = [];

                  upcomingSessions.forEach(s => {
                    const d = new Date(s.scheduled_at);
                    const isWeeklyOccurrence = weeklySlotConfigs.some(cfg => {
                      const dayMatches = d.getDay() === cfg.dayOfWeek;
                      const timeDiffMin = Math.abs((d.getHours() * 60 + d.getMinutes()) - (cfg.hour * 60 + cfg.minute));
                      return dayMatches && timeDiffMin <= 30;
                    });
                    
                    if (isWeeklyOccurrence) {
                      upcomingWeeklyOccurrences.push(s);
                    } else {
                      upcomingAdHocSessions.push(s);
                    }
                  });

                  const pastSessions = sessionLog.filter(s => {
                    const isPast = new Date(s.scheduled_at) <= new Date();
                    const isCompletedOrCancelled = s.status === 'completed' || s.status === 'cancelled';
                    return isPast || isCompletedOrCancelled;
                  });

                  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
                  const weeklyCadence = daysOfWeek.map((dayName, idx) => {
                    const targetDayOfWeek = idx === 6 ? 0 : idx + 1; // 0 for Sunday, 1 for Monday, etc.
                    const slotCfg = weeklySlotConfigs.find(cfg => cfg.dayOfWeek === targetDayOfWeek);
                    
                    if (slotCfg) {
                      const conflictingSession = upcomingAdHocSessions.find(s => {
                        const d = new Date(s.scheduled_at);
                        return d.getDay() === targetDayOfWeek;
                      });
                      
                      return {
                        day: dayName,
                        status: conflictingSession ? 'Rescheduled' : 'Active',
                        is_active: true,
                        session: slotCfg.session,
                        rescheduled: conflictingSession ? {
                          date: new Date(conflictingSession.scheduled_at).toLocaleDateString([], { month: 'short', day: 'numeric' }),
                          time: new Date(conflictingSession.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                          session: conflictingSession
                        } : null
                      };
                    }
                    
                    return {
                      day: dayName,
                      status: 'Not Set',
                      is_active: false
                    };
                  });

                  return (
                    <View className="px-6 py-8">
                      {/* Action Button */}
                      <TouchableOpacity 
                        onPress={() => setSchedulerVisible(true)}
                        className="mb-8 h-14 rounded-[24px] flex-row items-center justify-center gap-3 shadow-lg"
                        style={{ backgroundColor: colors.primary }}
                      >
                        <Plus size={18} color={colors.textOnPrimary || 'white'} strokeWidth={3} />
                        <Text className="font-black text-sm uppercase tracking-wider" style={{ color: colors.textOnPrimary || 'white' }}>Schedule Session</Text>
                      </TouchableOpacity>

                      {/* Primary Focus: Weekly Cadence */}
                      <View className="mb-8">
                        <View className="flex-row items-center justify-between mb-4">
                          <View>
                            <Text className="text-xl font-black" style={{ color: colors.text }}>Weekly Slots</Text>
                            <Text className="text-xs mt-1" style={{ color: colors.textSecondary }}>Regular weekly session times</Text>
                          </View>
                          <View 
                            className="w-8 h-8 rounded-full border items-center justify-center"
                            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                          >
                            <CalendarIcon size={14} color={colors.textSecondary} />
                          </View>
                        </View>
                        
                        <View className="gap-3">
                          {weeklyCadence.map((dayItem, idx) => (
                            <MotiView
                              key={dayItem.day}
                              from={reduceMotion ? { opacity: 0 } : { opacity: 0, translateY: 10 }}
                              animate={reduceMotion ? { opacity: 1 } : { opacity: 1, translateY: 0 }}
                              transition={{ delay: idx * 30 }}
                              className="rounded-[24px] p-5 border flex-row items-center justify-between"
                              style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                            >
                              <View className="flex-1">
                                <Text className="font-black text-base" style={{ color: colors.text }}>{dayItem.day}</Text>
                                {dayItem.is_active ? (
                                  dayItem.status === 'Rescheduled' && dayItem.rescheduled ? (
                                    <View className="mt-1.5 gap-1">
                                      <Text className="font-bold text-xs" style={{ color: colors.textSecondary }}>
                                        {dayItem.session.session_type.replace('_', ' ')} · {new Date(dayItem.session.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </Text>
                                      <Text className="text-amber-500 font-medium text-xs">
                                        Moved to {dayItem.rescheduled.date} at {dayItem.rescheduled.time}
                                      </Text>
                                    </View>
                                  ) : (
                                    <Text className="font-bold text-xs mt-1" style={{ color: colors.textSecondary }}>
                                      {dayItem.session.session_type.replace('_', ' ')} · {new Date(dayItem.session.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </Text>
                                  )
                                ) : (
                                  <Text className="font-medium text-xs mt-1" style={{ color: colors.textSecondary }}>Not scheduled</Text>
                                )}
                              </View>
                              
                              <View>
                                {dayItem.is_active ? (
                                  dayItem.status === 'Rescheduled' ? (
                                    <View className="bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/20">
                                      <Text className="text-amber-500 font-black text-[9px] uppercase tracking-wider">Rescheduled</Text>
                                    </View>
                                  ) : (
                                    <View className="bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
                                      <Text className="text-emerald-400 font-black text-[9px] uppercase tracking-wider">Set</Text>
                                    </View>
                                  )
                                ) : (
                                  <View 
                                    className="px-3 py-1.5 rounded-xl border"
                                    style={{ backgroundColor: colors.background, borderColor: colors.border }}
                                  >
                                    <Text className="font-black text-[9px] uppercase tracking-wider" style={{ color: colors.textSecondary }}>Not Set</Text>
                                  </View>
                                )}
                              </View>
                            </MotiView>
                          ))}
                        </View>
                      </View>

                      {/* Secondary Focus: Upcoming Ad-Hoc */}
                      <View className="mb-8">
                        <View className="flex-row items-center justify-between mb-4">
                          <View>
                            <Text className="text-xl font-black" style={{ color: colors.text }}>Extra Sessions</Text>
                            <Text className="text-xs mt-1" style={{ color: colors.textSecondary }}>One-time meetings and special sessions</Text>
                          </View>
                          <View 
                            className="w-8 h-8 rounded-full border items-center justify-center"
                            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                          >
                            <Plus size={14} color={colors.textSecondary} />
                          </View>
                        </View>
                        
                        {upcomingAdHocSessions.length === 0 ? (
                          <View 
                            className="p-8 items-center justify-center rounded-[32px] border border-dashed"
                            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                          >
                            <Text className="font-bold text-xs uppercase" style={{ color: colors.textSecondary }}>No extra sessions</Text>
                            <Text className="text-[10px] mt-1 text-center" style={{ color: colors.textSecondary }}>Only your regular weekly schedule is active.</Text>
                          </View>
                        ) : (
                          <View className="gap-3">
                            {upcomingAdHocSessions.map((session, idx) => (
                              <MotiView
                                key={session.id}
                                from={reduceMotion ? { opacity: 0 } : { opacity: 0, translateY: 10 }}
                                animate={reduceMotion ? { opacity: 1 } : { opacity: 1, translateY: 0 }}
                                transition={{ delay: idx * 30 }}
                                className="rounded-[24px] p-5 border flex-row items-center justify-between"
                                style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                              >
                                <View className="flex-1">
                                  <View className="flex-row items-center gap-2 mb-1">
                                    <CalendarIcon size={12} color={colors.textSecondary} />
                                    <Text className="font-black text-sm" style={{ color: colors.text }}>
                                      {new Date(session.scheduled_at).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                                    </Text>
                                  </View>
                                  <View className="flex-row items-center gap-4">
                                    <View className="flex-row items-center gap-1.5">
                                      <Clock size={12} color={colors.textSecondary} />
                                      <Text className="font-bold text-xs" style={{ color: colors.textSecondary }}>
                                        {new Date(session.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </Text>
                                    </View>
                                    <View className="w-1 h-1 rounded-full" style={{ backgroundColor: colors.border }} />
                                    <Text className="font-bold text-xs" style={{ color: colors.textSecondary }}>{session.duration_minutes || 60} min</Text>
                                    <View className="w-1 h-1 rounded-full" style={{ backgroundColor: colors.border }} />
                                    <Text className="font-bold text-xs capitalize" style={{ color: colors.textSecondary }}>{session.session_type.replace('_', ' ')}</Text>
                                  </View>
                                </View>
                                
                                <View 
                                  className="px-3 py-1.5 rounded-xl border"
                                  style={{ backgroundColor: `${colors.primary}15`, borderColor: `${colors.primary}30` }}
                                >
                                  <Text className="font-black text-[9px] uppercase tracking-wider" style={{ color: colors.primary }}>Upcoming</Text>
                                </View>
                              </MotiView>
                            ))}
                          </View>
                        )}
                      </View>

                      {/* Tertiary Focus: History */}
                      <View className="mb-6">
                        <TouchableOpacity
                          onPress={() => {
                            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                            setPastSessionsExpanded(!pastSessionsExpanded);
                          }}
                          className="flex-row items-center justify-between p-5 rounded-[24px] border"
                          style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                        >
                          <View className="flex-row items-center gap-3">
                            <Clock size={16} color={colors.textSecondary} />
                            <Text className="font-black text-sm uppercase tracking-wider" style={{ color: colors.textSecondary }}>Past Sessions ({pastSessions.length})</Text>
                          </View>
                          <MotiView
                            from={{ rotate: '0deg' }}
                            animate={{ rotate: pastSessionsExpanded ? '90deg' : '0deg' }}
                            transition={{ type: 'timing', duration: 200 } as any}
                          >
                            <ChevronRight size={18} color={colors.textSecondary} />
                          </MotiView>
                        </TouchableOpacity>
                        
                        {pastSessionsExpanded && (
                          <View className="mt-3 gap-3">
                            {pastSessions.length === 0 ? (
                              <View 
                                className="p-8 items-center justify-center rounded-[32px] border border-dashed"
                                style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                              >
                                <Text className="font-bold text-xs uppercase" style={{ color: colors.textSecondary }}>No past sessions</Text>
                              </View>
                            ) : (
                              pastSessions.map((session, idx) => (
                                <MotiView
                                  key={session.id}
                                  from={reduceMotion ? { opacity: 0 } : { opacity: 0, translateY: 10 }}
                                  animate={reduceMotion ? { opacity: 1 } : { opacity: 1, translateY: 0 }}
                                  transition={{ delay: idx * 20 }}
                                  className="rounded-[24px] p-5 border flex-row items-center justify-between"
                                  style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                                >
                                  <View className="flex-1">
                                    <View className="flex-row items-center gap-2 mb-1">
                                      <CalendarIcon size={12} color={colors.textSecondary} />
                                      <Text className="font-black text-sm" style={{ color: colors.text }}>
                                        {new Date(session.scheduled_at).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                                      </Text>
                                    </View>
                                    <View className="flex-row items-center gap-4">
                                      <View className="flex-row items-center gap-1.5">
                                        <Clock size={12} color={colors.textSecondary} />
                                        <Text className="font-bold text-xs" style={{ color: colors.textSecondary }}>
                                          {new Date(session.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </Text>
                                      </View>
                                      <View className="w-1 h-1 rounded-full" style={{ backgroundColor: colors.border }} />
                                      <Text className="font-bold text-xs" style={{ color: colors.textSecondary }}>{session.duration_minutes || 60} min</Text>
                                      <View className="w-1 h-1 rounded-full" style={{ backgroundColor: colors.border }} />
                                      <Text className="font-bold text-xs capitalize" style={{ color: colors.textSecondary }}>{session.session_type.replace('_', ' ')}</Text>
                                    </View>
                                  </View>
                                  
                                  {(() => {
                                    const isCompleted = session.status === 'completed';
                                    const isMissed = (session.status === 'scheduled' && new Date(session.scheduled_at) <= new Date()) || (session.status === 'cancelled' && session.cancellation_reason === 'Client No-Show');
                                    const isDiscussed = session.status === 'cancelled' && session.cancellation_reason !== 'Client No-Show';
                                    
                                    if (isCompleted) {
                                      return (
                                        <View className="bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20 flex-row items-center gap-1">
                                          <Check size={10} color="#10B981" strokeWidth={3} />
                                          <Text className="text-emerald-400 font-black text-[9px] uppercase tracking-wider">Completed</Text>
                                        </View>
                                      );
                                    }
                                    if (isMissed) {
                                      return (
                                        <View className="bg-red-500/10 px-3 py-1.5 rounded-xl border border-red-500/20 flex-row items-center gap-1">
                                          <X size={10} color="#EF4444" strokeWidth={3} />
                                          <Text className="text-red-400 font-black text-[9px] uppercase tracking-wider">Missed</Text>
                                        </View>
                                      );
                                    }
                                    if (isDiscussed) {
                                      return (
                                        <View 
                                          className="px-3 py-1.5 rounded-xl border flex-row items-center gap-1"
                                          style={{ backgroundColor: colors.background, borderColor: colors.border }}
                                        >
                                          <Text className="font-black text-[9px] uppercase tracking-wider" style={{ color: colors.textSecondary }}>Discussed</Text>
                                        </View>
                                      );
                                    }
                                    return (
                                      <View 
                                        className="px-3 py-1.5 rounded-xl border flex-row items-center gap-1"
                                        style={{ backgroundColor: colors.background, borderColor: colors.border }}
                                      >
                                        <Text className="font-black text-[9px] uppercase tracking-wider capitalize" style={{ color: colors.textSecondary }}>{session.status}</Text>
                                      </View>
                                    );
                                  })()}
                                </MotiView>
                              ))
                            )}
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })() : activeSubView === 'weight_history' ? (
                  <View className="px-6 py-6">
                    {/* Summary Card */}
                    <View 
                      className="p-6 rounded-[28px] border mb-6"
                      style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                    >
                      <Text className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: colors.textSecondary }}>
                        Current Weight
                      </Text>
                      <View className="flex-row items-baseline gap-2">
                        <Text className="text-4xl font-black tracking-tight" style={{ color: colors.text }}>
                          {latestWeight ? latestWeight : '--'}
                        </Text>
                        <Text className="text-lg font-bold" style={{ color: colors.textSecondary }}>
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
                          <View className="flex-row items-center gap-2 mt-4 pt-4 border-t" style={{ borderTopColor: colors.border }}>
                            <View className={`px-2.5 py-1 rounded-full border flex-row items-center gap-1 ${
                              isLoss ? 'bg-emerald-500/10 border-emerald-500/20' : isGain ? 'bg-amber-500/10 border-amber-500/20' : 'border'
                            }`}
                            style={totalDiff === 0 ? { backgroundColor: colors.background, borderColor: colors.border } : undefined}
                            >
                              <TrendingUp 
                                size={12} 
                                color={isLoss ? '#10B981' : isGain ? '#F59E0B' : colors.textSecondary} 
                                style={isLoss ? { transform: [{ rotate: '180deg' }] } : undefined}
                              />
                              <Text className={`font-black text-xs ${isLoss ? 'text-emerald-500' : isGain ? 'text-amber-500' : ''}`}
                                style={totalDiff === 0 ? { color: colors.textSecondary } : undefined}
                              >
                                {isLoss ? `${totalDiff} kg` : isGain ? `+${totalDiff} kg` : 'Stable'}
                              </Text>
                            </View>
                            <Text className="text-xs font-medium" style={{ color: colors.textSecondary }}>
                              since starting ({validWeights[validWeights.length - 1].weight_kg} kg)
                            </Text>
                          </View>
                        );
                      })()}
                    </View>

                    <Text className="text-xs font-bold uppercase tracking-widest mb-3 ml-1" style={{ color: colors.textSecondary }}>
                      All Logs ({validWeights.length})
                    </Text>

                    {validWeights.length === 0 ? (
                      <View 
                        className="p-12 items-center justify-center rounded-[32px] border border-dashed"
                        style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                      >
                        <Scale size={32} color={colors.textSecondary} />
                        <Text className="font-black text-sm uppercase mt-4" style={{ color: colors.text }}>No Weight Logged</Text>
                        <Text className="text-xs mt-1 text-center" style={{ color: colors.textSecondary }}>The client hasn't recorded any weigh-ins yet.</Text>
                      </View>
                    ) : (
                      <View className="gap-3">
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
                              className="rounded-[24px] p-5 border"
                              style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                            >
                              <View className="flex-row items-center justify-between">
                                <View>
                                  <Text className="font-black text-base" style={{ color: colors.text }}>
                                    {currentWeight} kg
                                  </Text>
                                  <Text className="font-medium text-xs mt-0.5" style={{ color: colors.textSecondary }}>
                                    {new Date(checkin.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                                  </Text>
                                </View>

                                {diff !== null && (
                                  <View className={`px-3 py-1.5 rounded-xl border flex-row items-center gap-1 ${
                                    diff < 0 
                                      ? 'bg-emerald-500/10 border-emerald-500/20' 
                                      : diff > 0 
                                        ? 'bg-amber-500/10 border-amber-500/20'
                                        : 'border'
                                  }`}
                                  style={diff === 0 ? { backgroundColor: colors.background, borderColor: colors.border } : undefined}
                                  >
                                    <TrendingUp 
                                      size={11} 
                                      color={diff < 0 ? '#10B981' : diff > 0 ? '#F59E0B' : colors.textSecondary} 
                                      style={diff < 0 ? { transform: [{ rotate: '180deg' }] } : undefined}
                                    />
                                    <Text className={`font-black text-[10px] uppercase tracking-wider ${
                                      diff < 0 
                                        ? 'text-emerald-500' 
                                        : diff > 0 
                                          ? 'text-amber-500' 
                                          : ''
                                    }`}
                                    style={diff === 0 ? { color: colors.textSecondary } : undefined}
                                    >
                                      {diff < 0 ? `${diff.toFixed(1)} kg` : diff > 0 ? `+${diff.toFixed(1)} kg` : 'Stable'}
                                    </Text>
                                  </View>
                                )}
                              </View>

                              {checkin.notes ? (
                                <View 
                                  className="mt-3 pt-3 border-t"
                                  style={{ borderTopColor: colors.border }}
                                >
                                  <Text className="text-xs font-normal leading-4" style={{ color: colors.textSecondary }}>
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

const ChallengeCard = ({ challenge, index, isEditing, onDelete }: { challenge: any, coachId: string, index: number, isEditing?: boolean, onDelete?: () => void }) => {
    const router = useRouter();
    const theme = useTheme();
    const colors = theme.colors;
    const [showMenu, setShowMenu] = useState(false);
    const totalSubs = Number(challenge.total_subs || 0);
    const completedSubs = Number(challenge.completed_subs || 0);
    const completionRate = totalSubs > 0 ? Math.round((completedSubs / totalSubs) * 100) : 0;
    const totalDays = Math.max(1, Math.ceil((new Date(challenge.end_date).getTime() - new Date(challenge.start_date).getTime()) / (1000 * 3600 * 24)));
    const isCompleted = challenge.status === 'completed';
    
    return (
        <Swipeable
            renderRightActions={() => (
                <View className="flex-row mb-6 pl-4 h-[280px]">
                    <TouchableOpacity 
                        onPress={() => router.push(`/(coach)/challenges/${challenge.id}`)}
                        className="w-16 h-full rounded-3xl items-center justify-center border mr-2"
                        style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                    >
                        <Edit2 size={20} color={colors.text} />
                    </TouchableOpacity>
                    <TouchableOpacity 
                        onPress={onDelete}
                        className="w-16 h-full bg-red-500 rounded-3xl items-center justify-center shadow-lg shadow-red-500/20"
                    >
                        <Trash2 size={20} color="white" />
                    </TouchableOpacity>
                </View>
            )}
            enabled={isEditing && !isCompleted}
        >
            <MotiView 
                from={{ opacity: 0, scale: 0.95 }} 
                animate={{ opacity: 1, scale: 1 }} 
                transition={{ delay: index * 100 }}
                className="border rounded-[40px] p-8 mb-6 overflow-hidden"
                style={{ backgroundColor: colors.surface, borderColor: colors.border }}
            >
                <View className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -mr-16 -mt-16" style={{ backgroundColor: `${colors.primary}10` }} />
                
                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => router.push(`/(coach)/challenges/${challenge.id}`)}
                >
                    <View className="flex-row justify-between items-start mb-10">
                        <View className="flex-row items-center gap-3">
                            <BrandedAvatar name={challenge.client_name || 'Client'} size={32} imageUrl={challenge.client_avatar} />
                            <View>
                                <Text className="text-[8px] font-black uppercase tracking-widest" style={{ color: colors.textSecondary }}>Client</Text>
                                <Text className="font-bold text-sm tracking-tight" style={{ color: colors.text }}>{challenge.client_name || 'Individual'}</Text>
                            </View>
                        </View>
                        <View 
                            className="px-3 py-1.5 rounded-full border"
                            style={{ backgroundColor: colors.background, borderColor: colors.border }}
                        >
                            <Text 
                                className="text-[8px] font-black uppercase tracking-[2px]"
                                style={{ color: isCompleted ? '#10B981' : colors.primary }}
                            >
                                {isCompleted ? 'Finished' : 'Active'}
                            </Text>
                        </View>
                    </View>

                    <Text className="text-2xl font-black mb-4 tracking-tight" style={{ color: colors.text }}>{challenge.name}</Text>
                    
                    <View className="flex-row items-center gap-4 mb-10">
                        <View className="flex-row items-center gap-2">
                            <CalendarIcon size={14} color={colors.textSecondary} />
                            <Text className="text-[11px] font-bold" style={{ color: colors.textSecondary }}>
                                {new Date(challenge.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - {new Date(challenge.end_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </Text>
                        </View>
                        <View className="w-1 h-1 rounded-full" style={{ backgroundColor: colors.border }} />
                        <Text className="text-[11px] font-bold" style={{ color: colors.textSecondary }}>{totalDays} {totalDays === 1 ? 'Day' : 'Days'}</Text>
                    </View>

                    <View className="flex-row justify-between items-end mb-3">
                        <Text className="text-[10px] font-black uppercase tracking-widest" style={{ color: colors.textSecondary }}>Progress</Text>
                        <Text className="text-xl font-black tracking-tight" style={{ color: colors.text }}>{completionRate}%</Text>
                    </View>

                    <View className="w-full h-2 rounded-full overflow-hidden mb-10" style={{ backgroundColor: colors.background }}>
                        <View className="h-full rounded-full" style={{ width: `${completionRate}%`, backgroundColor: colors.primary }} />
                    </View>
                </TouchableOpacity>

                <View className="flex-row gap-3">
                    <TouchableOpacity 
                        onPress={() => router.push(`/(coach)/challenges/${challenge.id}`)}
                        className="flex-1 h-16 rounded-[24px] items-center justify-center border"
                        style={{
                            backgroundColor: isCompleted ? colors.surface : colors.primary,
                            borderColor: colors.border,
                        }}
                    >
                        <Text 
                            className="font-black text-base" 
                            style={{ color: isCompleted ? colors.text : (colors.textOnPrimary || 'white') }}
                        >
                            {isCompleted ? 'View Results' : 'Manage Plan'}
                        </Text>
                    </TouchableOpacity>
                    {!isCompleted && (
                        isEditing ? (
                             <TouchableOpacity onPress={onDelete} className="w-16 h-16 bg-red-500/10 rounded-[24px] items-center justify-center border border-red-500/20">
                                <Trash2 size={20} color="#EF4444" />
                            </TouchableOpacity>
                        ) : (
                        <View>
                        {/* Full-screen backdrop to close menu on outside tap */}
                        {showMenu && (
                            <TouchableWithoutFeedback onPress={() => setShowMenu(false)}>
                                <View
                                    style={{
                                        position: 'absolute',
                                        top: -2000,
                                        left: -2000,
                                        right: -2000,
                                        bottom: -2000,
                                        zIndex: 40,
                                    }}
                                />
                            </TouchableWithoutFeedback>
                        )}

                        <AnimatePresence>
                            {showMenu && (
                                <MotiView
                                    from={{ opacity: 0, translateY: 8, scale: 0.98 }}
                                    animate={{ opacity: 1, translateY: 0, scale: 1 }}
                                    exit={{ opacity: 0, translateY: 8, scale: 0.98 }}
                                    transition={{ type: 'timing', duration: 180 } as any}
                                    style={{
                                        position: 'absolute',
                                        bottom: 72,
                                        right: 0,
                                        backgroundColor: colors.surface,
                                        borderWidth: 1,
                                        borderColor: colors.border,
                                        borderRadius: 20,
                                        padding: 8,
                                        width: 160,
                                        zIndex: 50,
                                        shadowColor: '#000',
                                        shadowOffset: { width: 0, height: 8 },
                                        shadowOpacity: 0.25,
                                        shadowRadius: 24,
                                        elevation: 12,
                                    }}
                                >
                                    <TouchableOpacity 
                                        onPress={() => {
                                            setShowMenu(false);
                                            router.push(`/(coach)/challenges/edit/${challenge.id}`);
                                        }}
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            gap: 12,
                                            padding: 12,
                                            borderRadius: 12,
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: `${colors.primary}15`, alignItems: 'center', justifyContent: 'center' }}>
                                            <Edit2 size={16} color={colors.primary} />
                                        </View>
                                        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>Edit</Text>
                                    </TouchableOpacity>
                                    
                                    <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 8, marginVertical: 4 }} />
                                    
                                    <TouchableOpacity 
                                        onPress={() => {
                                            setShowMenu(false);
                                            onDelete?.();
                                        }}
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            gap: 12,
                                            padding: 12,
                                            borderRadius: 12,
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(239,68,68,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                                            <Trash2 size={16} color="#EF4444" />
                                        </View>
                                        <Text style={{ color: '#EF4444', fontWeight: '700', fontSize: 13 }}>Delete</Text>
                                    </TouchableOpacity>
                                </MotiView>
                            )}
                        </AnimatePresence>
                        
                        <TouchableOpacity 
                            onPress={() => setShowMenu(!showMenu)}
                            style={[{
                                width: 64,
                                height: 64,
                                borderRadius: 24,
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderWidth: 1,
                                zIndex: 51,
                            }, showMenu
                                ? { backgroundColor: `${colors.primary}15`, borderColor: colors.primary }
                                : { backgroundColor: colors.surface, borderColor: colors.border }
                            ]}
                        >
                            <MoreVertical size={20} color={showMenu ? colors.primary : colors.textSecondary} />
                        </TouchableOpacity>
                        </View>
                        )
                    )}
                </View>
            </MotiView>
        </Swipeable>
    );
};
