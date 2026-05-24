import { useState, useEffect, useCallback, useRef } from 'react';
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
  X
} from 'lucide-react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useTheme } from '@/contexts/BrandContext';
import { BrandedAvatar } from '@/components/BrandedAvatar';
import SchedulerModal from '@/components/SchedulerModal';
import PendingResolutionsModal from '@/components/PendingResolutionsModal';
import ConflictResolutionModal from '@/components/ConflictResolutionModal';
import { ProposedSession } from '@/lib/ai-scheduling-service';
import { MotiView, AnimatePresence } from 'moti';
import { useReducedMotion } from 'react-native-reanimated';

export default function ClientDetailsScreen() {
  const { id, tab } = useLocalSearchParams();
  const router = useRouter();
  const { coach } = useAuth();
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [client, setClient] = useState<any>(null);
  const [challenges, setChallenges] = useState<any[]>([]);
  const [schedulerVisible, setSchedulerVisible] = useState(false);
  const [allCoachSessions, setAllCoachSessions] = useState<any[]>([]);
  const [pendingResolutions, setPendingResolutions] = useState<any[]>([]);
  const [pendingModalVisible, setPendingModalVisible] = useState(false);
  const [challengeFilter, setChallengeFilter] = useState<'active' | 'history'>('active');
  const [mainTab, setMainTab] = useState<'overview' | 'daily_tasks' | 'challenges' | 'checkins' | 'sessions'>(
    (tab as string) === 'checkins' ? 'checkins' : (tab as string) === 'daily_tasks' ? 'daily_tasks' : (tab as string) === 'challenges' ? 'challenges' : (tab as string) === 'sessions' ? 'sessions' : 'overview'
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

  const swipeableRefs = useRef<{ [key: string]: Swipeable | null }>({});

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
    return (
      <View className="flex-1 bg-slate-950 justify-center items-center">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (!client) {
    return (
      <View className="flex-1 bg-slate-950 justify-center items-center">
        <Text className="text-white font-bold">Client not found</Text>
      </View>
    );
  }

  // Calculate Today's Steps
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const todayStr = `${yyyy}-${mm}-${dd}`;
  const todayLog = stepsLog.find(log => log.date === todayStr);
  const todaySteps = todayLog ? todayLog.steps : 0;

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

  const filteredChallenges = challenges.filter(c => challengeFilter === 'active' ? c.status === 'active' : c.status === 'completed');

  return (
    <View style={{ flex: 1 }} className="bg-slate-950">
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
            {/* Header */}
            <View className="flex-row items-center justify-between px-6 pt-10 pb-6 border-b border-white/5">
                <View className="flex-row items-center gap-4">
                    <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 bg-slate-900 rounded-xl items-center justify-center border border-white/5">
                        <ArrowLeft size={20} color="white" />
                    </TouchableOpacity>
                    <BrandedAvatar name={client.profiles?.full_name} size={40} imageUrl={client.profiles?.avatar_url} />
                    <View>
                        <Text className="text-white text-xl font-black">{client.profiles?.full_name}</Text>
                        {client.profiles?.email && (
                            <Text className="text-slate-500 text-xs font-medium">{client.profiles?.email}</Text>
                        )}
                    </View>
                </View>
                <TouchableOpacity onPress={() => setSchedulerVisible(true)} className="w-10 h-10 bg-slate-900 rounded-xl items-center justify-center border border-white/5">
                    <CalendarIcon size={20} color="#3B82F6" />
                </TouchableOpacity>
            </View>

            {pendingResolutions.length > 0 && (
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
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" />}
            >
                {/* Main Tab Navigation */}
                <View className="border-b border-white/5 mt-4">
                    <ScrollView 
                        horizontal 
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ paddingHorizontal: 24 }}
                    >
                        <TouchableOpacity 
                            className={`mr-8 pb-4 border-b-2 ${mainTab === 'overview' ? 'border-blue-500' : 'border-transparent'}`}
                            onPress={() => setMainTab('overview')}
                        >
                            <Text className={`text-sm font-black uppercase tracking-widest ${mainTab === 'overview' ? 'text-white' : 'text-slate-500'}`}>Overview</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            className={`mr-8 pb-4 border-b-2 ${mainTab === 'daily_tasks' ? 'border-emerald-500' : 'border-transparent'}`}
                            onPress={() => setMainTab('daily_tasks')}
                        >
                            <Text className={`text-sm font-black uppercase tracking-widest ${mainTab === 'daily_tasks' ? 'text-white' : 'text-slate-500'}`}>Daily Tasks</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            className={`mr-8 pb-4 border-b-2 ${mainTab === 'challenges' ? 'border-indigo-500' : 'border-transparent'}`}
                            onPress={() => setMainTab('challenges')}
                        >
                            <Text className={`text-sm font-black uppercase tracking-widest ${mainTab === 'challenges' ? 'text-white' : 'text-slate-500'}`}>Challenges</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            className={`mr-8 pb-4 border-b-2 ${mainTab === 'checkins' ? 'border-blue-500' : 'border-transparent'}`}
                            onPress={() => setMainTab('checkins')}
                        >
                            <Text className={`text-sm font-black uppercase tracking-widest ${mainTab === 'checkins' ? 'text-white' : 'text-slate-500'}`}>Check-ins</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            className={`pb-4 border-b-2 ${mainTab === 'sessions' ? 'border-blue-500' : 'border-transparent'}`}
                            onPress={() => setMainTab('sessions')}
                        >
                            <Text className={`text-sm font-black uppercase tracking-widest ${mainTab === 'sessions' ? 'text-white' : 'text-slate-500'}`}>Sessions</Text>
                        </TouchableOpacity>
                    </ScrollView>
                </View>

                {mainTab === 'overview' ? (
                  <>
                    {/* Premium Metrics Grid */}
                    <View className="px-6 pt-8 pb-4">
                        <View className="flex-row flex-wrap justify-between gap-4 mb-4">
                            {/* Today's Steps Card (Full Width) */}
                            <View className="w-full bg-indigo-500/10 rounded-[32px] p-6 border border-indigo-500/20 flex-row items-center justify-between">
                                <View className="flex-row items-center gap-4">
                                    <View className="w-12 h-12 bg-indigo-500/20 rounded-2xl items-center justify-center border border-indigo-500/30">
                                        <Zap size={22} color="#818CF8" />
                                    </View>
                                    <View>
                                        <Text className="text-indigo-400 text-[10px] font-black uppercase tracking-wider">Today's Steps</Text>
                                        <Text className="text-white text-2xl font-black mt-1">
                                            {todaySteps.toLocaleString()}
                                        </Text>
                                    </View>
                                </View>
                                <View className="bg-indigo-500/20 px-3 py-1.5 rounded-xl border border-indigo-500/30">
                                    <Text className="text-indigo-400 font-black text-[9px] uppercase tracking-wider">Today</Text>
                                </View>
                            </View>

                            {/* Streak Card */}
                            <View className="w-[47%] bg-slate-900/40 rounded-[32px] p-5 border border-white/5 items-center justify-between">
                                <View className="w-10 h-10 bg-emerald-500/10 rounded-2xl items-center justify-center border border-emerald-500/20 mb-3">
                                    <Award size={18} color="#10B981" />
                                </View>
                                <Text className="text-slate-500 text-[10px] font-black uppercase tracking-wider text-center">Active Streak</Text>
                                <Text className="text-white text-lg font-black mt-1">{streak} Days</Text>
                            </View>

                            {/* Weight Card */}
                            <View className="w-[47%] bg-slate-900/40 rounded-[32px] p-5 border border-white/5 items-center justify-between">
                                <View className="w-10 h-10 bg-amber-500/10 rounded-2xl items-center justify-center border border-amber-500/20 mb-3">
                                    <Scale size={18} color="#F59E0B" />
                                </View>
                                <Text className="text-slate-500 text-[10px] font-black uppercase tracking-wider text-center">
                                    {weightDaysAgo > 5 ? `Weight (${weightDaysAgo}d ago)` : 'Last Weight'}
                                </Text>
                                <Text className="text-white text-lg font-black mt-1">{latestWeight ? `${latestWeight} kg` : '--'}</Text>
                                {weightDaysAgo > 5 && (
                                    <View className="mt-1 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20">
                                        <Text className="text-red-400 text-[8px] font-black uppercase">Not Updated</Text>
                                    </View>
                                )}
                            </View>

                            {/* Average Sleep Card */}
                            <View className="w-[47%] bg-slate-900/40 rounded-[32px] p-5 border border-white/5 items-center justify-between">
                                <View className="w-10 h-10 bg-indigo-500/10 rounded-2xl items-center justify-center border border-indigo-500/20 mb-3">
                                    <Clock size={18} color="#6366F1" />
                                </View>
                                <Text className="text-slate-500 text-[10px] font-black uppercase tracking-wider text-center">Avg Sleep</Text>
                                <Text className="text-white text-lg font-black mt-1">{avgSleep ? `${avgSleep} hrs` : '--'}</Text>
                            </View>

                            {/* Average Energy Card */}
                            <View className="w-[47%] bg-slate-900/40 rounded-[32px] p-5 border border-white/5 items-center justify-between">
                                <View className="w-10 h-10 bg-orange-500/10 rounded-2xl items-center justify-center border border-orange-500/20 mb-3">
                                    <Zap size={18} color="#F97316" />
                                </View>
                                <Text className="text-slate-500 text-[10px] font-black uppercase tracking-wider text-center">Avg Energy</Text>
                                <Text className="text-white text-lg font-black mt-1">{avgEnergy ? `${avgEnergy}/10` : '--'}</Text>
                            </View>
                        </View>
                    </View>

                    {/* Client Info Card */}
                    <View className="px-6 pb-8">
                        <View className="bg-slate-900/40 rounded-[32px] p-6 border border-white/5">
                            <Text className="text-slate-500 text-[10px] font-black uppercase tracking-[4px] mb-6">Client Info</Text>
                            <View className="flex-row flex-wrap gap-y-6">
                                <InfoTile icon={<Target size={14} color="#64748B" />} label="Goal" value={client.goal || 'Not set'} fullWidth />
                                <InfoTile icon={<Mail size={14} color="#64748B" />} label="Email" value={client.profiles?.email || 'Not set'} fullWidth selectable />
                                <InfoTile icon={<Award size={14} color="#64748B" />} label="Experience" value={client.experience_level || 'Not set'} />
                                <InfoTile icon={<User size={14} color="#64748B" />} label="Height" value={client.height_cm ? `${client.height_cm} cm` : 'Not set'} />
                                <InfoTile icon={<Clock size={14} color="#64748B" />} label="Age" value={client.date_of_birth ? `${Math.floor((new Date().getTime() - new Date(client.date_of_birth).getTime()) / (1000 * 3600 * 24 * 365.25))}` : 'Not set'} />
                            </View>
                        </View>
                    </View>

                    {/* Synced Activity (Steps History) */}
                    <View className="px-6 pb-8">
                        <Text className="text-slate-500 text-[10px] font-black uppercase tracking-[4px] mb-4 ml-1">Synced Activity</Text>
                        {stepsLog.length === 0 ? (
                            <View className="p-8 items-center justify-center bg-slate-900/20 rounded-[32px] border border-slate-900 border-dashed">
                                <Text className="text-slate-500 font-bold text-xs uppercase">No steps synced yet</Text>
                            </View>
                        ) : (
                            <View className="gap-3">
                                {stepsLog.slice(0, 5).map((logItem, idx) => (
                                    <MotiView
                                        key={logItem.id}
                                        from={reduceMotion ? { opacity: 0 } : { opacity: 0, translateY: 10 }}
                                        animate={reduceMotion ? { opacity: 1 } : { opacity: 1, translateY: 0 }}
                                        transition={{ delay: idx * 30 }}
                                        className="bg-slate-900/40 rounded-[24px] p-5 border border-white/5 flex-row items-center justify-between"
                                    >
                                        <View className="flex-1">
                                            <Text className="text-white font-black text-sm">
                                                {new Date(logItem.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                                            </Text>
                                            <Text className="text-slate-400 font-bold text-xs mt-1">
                                                {logItem.steps ? `${logItem.steps.toLocaleString()} steps` : '0 steps'}
                                            </Text>
                                        </View>
                                        <View className="bg-indigo-500/10 px-3 py-1.5 rounded-xl border border-indigo-500/20">
                                            <Text className="text-indigo-400 font-black text-[9px] uppercase tracking-wider">Synced</Text>
                                        </View>
                                    </MotiView>
                                ))}
                            </View>
                        )}
                    </View>

                    {/* Weigh-in History */}
                    <View className="px-6 pb-8">
                        <Text className="text-slate-500 text-[10px] font-black uppercase tracking-[4px] mb-4 ml-1">Weigh-in History</Text>
                        {validWeights.length === 0 ? (
                            <View className="p-8 items-center justify-center bg-slate-900/20 rounded-[32px] border border-slate-900 border-dashed">
                                <Text className="text-slate-500 font-bold text-xs uppercase">No weight records yet</Text>
                            </View>
                        ) : (
                            <View className="gap-3">
                                {validWeights.slice(0, 5).map((checkin, idx) => {
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
                                            className="bg-slate-900/40 rounded-[24px] p-5 border border-white/5 flex-row items-center justify-between"
                                        >
                                            <View className="flex-1">
                                                <Text className="text-white font-black text-sm">
                                                    {new Date(checkin.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                                                </Text>
                                                <Text className="text-slate-400 font-bold text-xs mt-1">
                                                    {currentWeight} kg
                                                </Text>
                                            </View>
                                            {diff !== null && (
                                                <View className={`px-3 py-1.5 rounded-xl border flex-row items-center gap-1 ${
                                                    diff < 0 
                                                        ? 'bg-emerald-500/10 border-emerald-500/20' 
                                                        : diff > 0 
                                                            ? 'bg-amber-500/10 border-amber-500/20'
                                                            : 'bg-slate-800 border-white/5'
                                                }`}>
                                                    <TrendingUp 
                                                        size={10} 
                                                        color={diff < 0 ? '#10B981' : diff > 0 ? '#F59E0B' : '#64748B'} 
                                                        style={diff < 0 ? { transform: [{ rotate: '180deg' }] } : undefined}
                                                    />
                                                    <Text className={`font-black text-[9px] uppercase tracking-wider ${
                                                        diff < 0 
                                                            ? 'text-emerald-400' 
                                                            : diff > 0 
                                                                ? 'text-amber-500'
                                                                : 'text-slate-400'
                                                    }`}>
                                                        {diff < 0 ? `${diff.toFixed(1)} kg` : diff > 0 ? `+${diff.toFixed(1)} kg` : 'Stable'}
                                                    </Text>
                                                </View>
                                            )}
                                        </MotiView>
                                    );
                                })}
                            </View>
                        )}
                    </View>
                  </>
                ) : mainTab === 'daily_tasks' ? (
                  <View className="px-6 py-8">
                    <View className="flex-row items-center justify-between mb-8 ml-1">
                        <Text className="text-slate-500 text-[10px] font-black uppercase tracking-[4px]">Daily Tasks</Text>
                        {habits.length > 0 && (
                            <TouchableOpacity onPress={() => router.push(`/(coach)/clients/create-protocol?clientId=${id}`)}>
                                <Text className="text-blue-500 text-[10px] font-black uppercase tracking-widest">Edit</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                    {habits.length === 0 ? (
                        <View className="p-12 items-center justify-center bg-slate-900/20 rounded-[40px] border border-slate-900 border-dashed">
                             <Zap size={32} color="#1E293B" />
                             <Text className="text-slate-700 font-black text-xs uppercase mt-6">No Daily Tasks</Text>
                             <Text className="text-slate-800 text-[10px] mt-2 text-center px-4 leading-4">No daily habits have been assigned to this client yet.</Text>
                             <TouchableOpacity 
                                onPress={() => router.push(`/(coach)/clients/create-protocol?clientId=${id}`)}
                                className="mt-8 px-6 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex-row items-center gap-2"
                             >
                                <Plus size={16} color="#10B981" />
                                <Text className="text-emerald-500 font-black text-[10px] uppercase tracking-widest">Assign Protocol</Text>
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
                                            className="w-16 h-full bg-slate-800 rounded-3xl items-center justify-center border border-white/5 mr-2"
                                        >
                                            <Edit2 size={20} color="white" />
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
                                    className="bg-slate-900/40 rounded-[32px] p-6 mb-4 border border-white/5 flex-row items-center gap-4"
                                >
                                    <View className="w-12 h-12 rounded-2xl bg-emerald-500/10 items-center justify-center border border-emerald-500/20">
                                        <Target size={20} color="#10B981" />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-white font-black text-base">{habit.name}</Text>
                                        <Text className="text-slate-500 text-xs font-medium mt-1" numberOfLines={1}>{habit.description || 'No instructions provided'}</Text>
                                    </View>
                                    <View className="bg-slate-950 px-3 py-1.5 rounded-full border border-white/5">
                                        <Text className="text-slate-400 text-[8px] font-black uppercase tracking-widest">{habit.category || 'General'}</Text>
                                    </View>
                                    {isEditingHabits && (
                                        <TouchableOpacity onPress={() => handleEditHabit(habit)} className="p-2">
                                            <ChevronRight size={16} color="#475569" />
                                        </TouchableOpacity>
                                    )}
                                </MotiView>
                            </Swipeable>
                        ))
                    )}

                    {habits.length > 0 && (
                        <TouchableOpacity 
                            onPress={() => router.push(`/(coach)/clients/create-protocol?clientId=${id}`)}
                            className="mt-4 p-8 bg-slate-900/40 rounded-[40px] border border-white/5 items-center border-dashed"
                        >
                            <View className="w-12 h-12 bg-slate-950 rounded-full items-center justify-center border border-white/10 mb-4">
                                <Plus size={20} color="#64748B" />
                            </View>
                            <Text className="text-white font-black text-sm uppercase tracking-widest">Add or Edit Tasks</Text>
                        </TouchableOpacity>
                    )}
                  </View>
                ) : mainTab === 'challenges' ? (
                  <View className="px-6 py-8">
                    <View className="flex-row justify-between items-center mb-8">
                        <View className="flex-row gap-6">
                            <TouchableOpacity onPress={() => setChallengeFilter('active')}>
                                <Text className={`text-2xl font-black ${challengeFilter === 'active' ? 'text-white' : 'text-slate-700'}`}>Active</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setChallengeFilter('history')}>
                                <Text className={`text-2xl font-black ${challengeFilter === 'history' ? 'text-white' : 'text-slate-700'}`}>History</Text>
                            </TouchableOpacity>
                        </View>
                        <View className="flex-row gap-2">
                             <TouchableOpacity onPress={() => router.push(`/(coach)/clients/ai-selection?clientId=${id}`)} className="w-10 h-10 bg-slate-900 rounded-full items-center justify-center border border-white/5 shadow-lg shadow-violet-500/20">
                                <Sparkles size={18} color="#A78BFA" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => router.push(`/(coach)/clients/create-selection?clientId=${id}`)} className="h-10 px-4 bg-blue-600 rounded-full flex-row items-center gap-2 shadow-lg shadow-blue-500/20">
                                <Plus size={16} color="white" />
                                <Text className="text-white font-black text-xs uppercase">Create</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {filteredChallenges.length === 0 ? (
                        <View className="p-12 items-center justify-center bg-slate-900/20 rounded-[40px] border border-slate-900 border-dashed">
                             <Zap size={32} color="#1E293B" />
                             <Text className="text-slate-700 font-black text-xs uppercase mt-6">No Challenges</Text>
                             <Text className="text-slate-800 text-[10px] mt-2 text-center px-4 leading-4">No challenges started yet.</Text>
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
                    <View className="mt-10 p-10 bg-slate-900/40 rounded-[48px] border border-white/5 items-center">
                        <View className="w-16 h-16 bg-slate-950 rounded-full items-center justify-center border border-white/10 mb-6">
                            <Plus size={32} color="#64748B" />
                        </View>
                        <Text className="text-white text-2xl font-black mb-4 text-center">Start a Challenge</Text>
                        <Text className="text-slate-500 text-xs font-medium text-center mb-10 leading-5">
                            Create a custom challenge or generate one with AI.
                        </Text>
                        <View className="flex-row gap-4 w-full">
                            <TouchableOpacity 
                                onPress={() => router.push(`/(coach)/clients/create-selection?clientId=${id}`)}
                                className="flex-1 h-14 bg-slate-950 rounded-full items-center justify-center border border-white/10"
                            >
                                <Text className="text-white font-bold text-xs uppercase">Custom</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                onPress={() => router.push(`/(coach)/clients/ai-selection?clientId=${id}`)}
                                className="flex-1 h-14 bg-orange-200 rounded-full items-center justify-center"
                                style={{ backgroundColor: '#FFD7B5' }}
                            >
                                <Text className="text-slate-900 font-bold text-xs uppercase">Use AI</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                  </View>
                ) : mainTab === 'checkins' ? (
                  <View className="px-6 py-8">
                    {checkins.length === 0 ? (
                        <View className="p-12 items-center justify-center bg-slate-900/20 rounded-[40px] border border-slate-900 border-dashed">
                             <Target size={32} color="#1E293B" />
                             <Text className="text-slate-700 font-black text-xs uppercase mt-6">No Check-ins Yet</Text>
                             <Text className="text-slate-800 text-[10px] mt-2 text-center px-4 leading-4">The client hasn't logged any daily protocols.</Text>
                        </View>
                    ) : (
                        checkins.map((checkin, idx) => (
                            <MotiView 
                                key={checkin.id}
                                from={{ opacity: 0, translateY: 10 }} 
                                animate={{ opacity: 1, translateY: 0 }} 
                                transition={{ delay: idx * 50 }}
                                className="bg-slate-900/40 rounded-[32px] p-6 mb-4 border border-white/5"
                            >
                                <View className="flex-row justify-between items-center mb-4">
                                    <Text className="text-white font-black text-lg">{new Date(checkin.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</Text>
                                    <View className="bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
                                        <Text className="text-emerald-400 text-[10px] font-black uppercase tracking-[2px]">Logged</Text>
                                    </View>
                                </View>
                                
                                <View className="flex-row flex-wrap gap-y-4 mb-4">
                                    <View className="w-1/2 flex-row items-center gap-2">
                                        <Scale size={16} color="#94A3B8" />
                                        <Text className="text-slate-300 font-bold">{checkin.weight_kg ? `${checkin.weight_kg} kg` : '--'}</Text>
                                    </View>
                                    <View className="w-1/2 flex-row items-center gap-2">
                                        <Clock size={16} color="#94A3B8" />
                                        <Text className="text-slate-300 font-bold">{checkin.sleep_hours ? `${checkin.sleep_hours} hrs` : '--'}</Text>
                                    </View>
                                    <View className="w-1/2 flex-row items-center gap-2">
                                        <Zap size={16} color="#94A3B8" />
                                        <Text className="text-slate-300 font-bold">Energy: {checkin.energy_level ? `${checkin.energy_level}/10` : '--'}</Text>
                                    </View>
                                </View>

                                {checkin.notes && (
                                    <View className="mt-2 p-4 bg-slate-950/50 rounded-2xl border border-white/5">
                                        <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Notes</Text>
                                        <Text className="text-slate-300 text-sm leading-5">{checkin.notes}</Text>
                                    </View>
                                )}
                            </MotiView>
                        ))
                    )}
                  </View>
                ) : mainTab === 'sessions' ? (() => {
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
                        className="mb-8 h-14 bg-orange-500 rounded-[24px] flex-row items-center justify-center gap-3 shadow-lg shadow-orange-500/20"
                      >
                        <Plus size={18} color="white" strokeWidth={3} />
                        <Text className="text-white font-black text-sm uppercase tracking-wider">Schedule Session</Text>
                      </TouchableOpacity>

                      {/* Primary Focus: Weekly Cadence */}
                      <View className="mb-8">
                        <View className="flex-row items-center justify-between mb-4">
                          <View>
                            <Text className="text-white text-xl font-black">Weekly Slots</Text>
                            <Text className="text-slate-500 text-xs mt-1">Regular weekly session times</Text>
                          </View>
                          <View className="w-8 h-8 rounded-full bg-slate-900 border border-white/5 items-center justify-center">
                            <CalendarIcon size={14} color="#94A3B8" />
                          </View>
                        </View>
                        
                        <View className="gap-3">
                          {weeklyCadence.map((dayItem, idx) => (
                            <MotiView
                              key={dayItem.day}
                              from={reduceMotion ? { opacity: 0 } : { opacity: 0, translateY: 10 }}
                              animate={reduceMotion ? { opacity: 1 } : { opacity: 1, translateY: 0 }}
                              transition={{ delay: idx * 30 }}
                              className="bg-slate-900/40 rounded-[24px] p-5 border border-white/5 flex-row items-center justify-between"
                            >
                              <View className="flex-1">
                                <Text className="text-white font-black text-base">{dayItem.day}</Text>
                                {dayItem.is_active ? (
                                  dayItem.status === 'Rescheduled' && dayItem.rescheduled ? (
                                    <View className="mt-1.5 gap-1">
                                      <Text className="text-slate-400 font-bold text-xs">
                                        {dayItem.session.session_type.replace('_', ' ')} · {new Date(dayItem.session.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </Text>
                                      <Text className="text-amber-500 font-medium text-xs">
                                        Moved to {dayItem.rescheduled.date} at {dayItem.rescheduled.time}
                                      </Text>
                                    </View>
                                  ) : (
                                    <Text className="text-slate-400 font-bold text-xs mt-1">
                                      {dayItem.session.session_type.replace('_', ' ')} · {new Date(dayItem.session.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </Text>
                                  )
                                ) : (
                                  <Text className="text-slate-500 font-medium text-xs mt-1">Not scheduled</Text>
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
                                  <View className="bg-slate-800/40 px-3 py-1.5 rounded-xl border border-white/5">
                                    <Text className="text-slate-500 font-black text-[9px] uppercase tracking-wider">Not Set</Text>
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
                            <Text className="text-white text-xl font-black">Extra Sessions</Text>
                            <Text className="text-slate-500 text-xs mt-1">One-time meetings and special sessions</Text>
                          </View>
                          <View className="w-8 h-8 rounded-full bg-slate-900 border border-white/5 items-center justify-center">
                            <Plus size={14} color="#94A3B8" />
                          </View>
                        </View>
                        
                        {upcomingAdHocSessions.length === 0 ? (
                          <View className="p-8 items-center justify-center bg-slate-900/20 rounded-[32px] border border-slate-900 border-dashed">
                            <Text className="text-slate-500 font-bold text-xs uppercase">No extra sessions</Text>
                            <Text className="text-slate-600 text-[10px] mt-1 text-center">Only your regular weekly schedule is active.</Text>
                          </View>
                        ) : (
                          <View className="gap-3">
                            {upcomingAdHocSessions.map((session, idx) => (
                              <MotiView
                                key={session.id}
                                from={reduceMotion ? { opacity: 0 } : { opacity: 0, translateY: 10 }}
                                animate={reduceMotion ? { opacity: 1 } : { opacity: 1, translateY: 0 }}
                                transition={{ delay: idx * 30 }}
                                className="bg-slate-900/40 rounded-[24px] p-5 border border-white/5 flex-row items-center justify-between"
                              >
                                <View className="flex-1">
                                  <View className="flex-row items-center gap-2 mb-1">
                                    <CalendarIcon size={12} color="#64748B" />
                                    <Text className="text-white font-black text-sm">
                                      {new Date(session.scheduled_at).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                                    </Text>
                                  </View>
                                  <View className="flex-row items-center gap-4">
                                    <View className="flex-row items-center gap-1.5">
                                      <Clock size={12} color="#94A3B8" />
                                      <Text className="text-slate-400 font-bold text-xs">
                                        {new Date(session.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </Text>
                                    </View>
                                    <View className="w-1 h-1 rounded-full bg-slate-800" />
                                    <Text className="text-slate-400 font-bold text-xs">{session.duration_minutes || 60} min</Text>
                                    <View className="w-1 h-1 rounded-full bg-slate-800" />
                                    <Text className="text-slate-400 font-bold text-xs capitalize">{session.session_type.replace('_', ' ')}</Text>
                                  </View>
                                </View>
                                
                                <View className="bg-blue-500/10 px-3 py-1.5 rounded-xl border border-blue-500/20">
                                  <Text className="text-blue-400 font-black text-[9px] uppercase tracking-wider">Upcoming</Text>
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
                          className="flex-row items-center justify-between p-5 bg-slate-900/30 rounded-[24px] border border-white/5"
                        >
                          <View className="flex-row items-center gap-3">
                            <Clock size={16} color="#64748B" />
                            <Text className="text-slate-400 font-black text-sm uppercase tracking-wider">Past Sessions ({pastSessions.length})</Text>
                          </View>
                          <MotiView
                            from={{ rotate: '0deg' }}
                            animate={{ rotate: pastSessionsExpanded ? '90deg' : '0deg' }}
                            transition={{ type: 'timing', duration: 200 }}
                          >
                            <ChevronRight size={18} color="#64748B" />
                          </MotiView>
                        </TouchableOpacity>
                        
                        {pastSessionsExpanded && (
                          <View className="mt-3 gap-3">
                            {pastSessions.length === 0 ? (
                              <View className="p-8 items-center justify-center bg-slate-900/20 rounded-[32px] border border-slate-900 border-dashed">
                                <Text className="text-slate-600 font-bold text-xs uppercase">No past sessions</Text>
                              </View>
                            ) : (
                              pastSessions.map((session, idx) => (
                                <MotiView
                                  key={session.id}
                                  from={reduceMotion ? { opacity: 0 } : { opacity: 0, translateY: 10 }}
                                  animate={reduceMotion ? { opacity: 1 } : { opacity: 1, translateY: 0 }}
                                  transition={{ delay: idx * 20 }}
                                  className="bg-slate-900/40 rounded-[24px] p-5 border border-white/5 flex-row items-center justify-between"
                                >
                                  <View className="flex-1">
                                    <View className="flex-row items-center gap-2 mb-1">
                                      <CalendarIcon size={12} color="#64748B" />
                                      <Text className="text-white font-black text-sm">
                                        {new Date(session.scheduled_at).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                                      </Text>
                                    </View>
                                    <View className="flex-row items-center gap-4">
                                      <View className="flex-row items-center gap-1.5">
                                        <Clock size={12} color="#94A3B8" />
                                        <Text className="text-slate-400 font-bold text-xs">
                                          {new Date(session.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </Text>
                                      </View>
                                      <View className="w-1 h-1 rounded-full bg-slate-800" />
                                      <Text className="text-slate-400 font-bold text-xs">{session.duration_minutes || 60} min</Text>
                                      <View className="w-1 h-1 rounded-full bg-slate-800" />
                                      <Text className="text-slate-400 font-bold text-xs capitalize">{session.session_type.replace('_', ' ')}</Text>
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
                                        <View className="bg-slate-800 px-3 py-1.5 rounded-xl border border-white/5 flex-row items-center gap-1">
                                          <Text className="text-slate-400 font-black text-[9px] uppercase tracking-wider">Discussed</Text>
                                        </View>
                                      );
                                    }
                                    return (
                                      <View className="bg-slate-800 px-3 py-1.5 rounded-xl border border-white/5 flex-row items-center gap-1">
                                        <Text className="text-slate-400 font-black text-[9px] uppercase tracking-wider capitalize">{session.status}</Text>
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
                })() : null}
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
           <View className="bg-slate-950 rounded-t-[48px] p-8 border-t border-white/10 pb-16">
             {/* Header */}
             <View className="flex-row justify-between items-center mb-10">
               <View>
                 <Text className="text-white text-2xl font-black tracking-tight">Edit Task</Text>
                 <Text className="text-blue-500 text-[10px] uppercase tracking-[2px] font-black mt-1">Daily Protocol</Text>
               </View>
               <TouchableOpacity 
                 onPress={() => setEditHabitModalVisible(false)}
                 className="w-12 h-12 bg-slate-900 rounded-2xl items-center justify-center border border-white/10"
               >
                 <Plus size={24} color="#94A3B8" style={{ transform: [{ rotate: '45deg' }] }} />
               </TouchableOpacity>
             </View>

             <View>
               {/* Task Name */}
               <View className="mb-8">
                 <Text className="text-slate-500 text-[10px] font-black uppercase tracking-[2px] mb-3 ml-1">Task Identity</Text>
                 <TextInput
                   className="bg-slate-900 border border-white/10 rounded-2xl px-6 py-5 text-white font-bold text-lg"
                   value={editingName}
                   onChangeText={setEditingName}
                   placeholder="e.g. Hydration Foundation"
                   placeholderTextColor="#334155"
                   selectionColor="#3B82F6"
                 />
               </View>

               {/* Instructions */}
               <View className="mb-8">
                 <Text className="text-slate-500 text-[10px] font-black uppercase tracking-[2px] mb-3 ml-1">Daily Instructions</Text>
                 <TextInput
                   className="bg-slate-900 border border-white/10 rounded-2xl px-6 py-5 text-white font-medium text-base min-h-[120px]"
                   value={editingDescription}
                   onChangeText={setEditingDescription}
                   placeholder="Add specific instructions for the client..."
                   placeholderTextColor="#334155"
                   multiline
                   textAlignVertical="top"
                   selectionColor="#3B82F6"
                 />
               </View>

               {/* Category Grid */}
               <View className="mb-10">
                 <Text className="text-slate-500 text-[10px] font-black uppercase tracking-[2px] mb-4 ml-1">Focus Area</Text>
                 <View className="flex-row flex-wrap gap-3">
                   {['training', 'nutrition', 'recovery', 'consistency'].map((cat) => (
                     <TouchableOpacity
                       key={cat}
                       onPress={() => setEditingCategory(cat)}
                       className={`flex-1 min-w-[140px] h-14 rounded-2xl border items-center justify-center ${editingCategory === cat ? 'bg-blue-600/10 border-blue-600/40' : 'bg-slate-900 border-white/5'}`}
                     >
                       <Text className={`text-[10px] font-black uppercase tracking-[1px] ${editingCategory === cat ? 'text-blue-400' : 'text-slate-500'}`}>{cat}</Text>
                     </TouchableOpacity>
                   ))}
                 </View>
               </View>

               {/* Submit Button */}
               <TouchableOpacity
                 onPress={handleUpdateHabit}
                 disabled={updating}
                 activeOpacity={0.8}
                 className={`h-20 rounded-[28px] items-center justify-center shadow-2xl shadow-blue-500/20 ${updating ? 'bg-slate-900' : 'bg-blue-600'}`}
               >
                 {updating ? (
                   <ActivityIndicator color="white" />
                 ) : (
                   <Text className="text-white font-black text-lg uppercase tracking-[2px]">Update Task</Text>
                 )}
               </TouchableOpacity>
             </View>
           </View>
         </View>
       </Modal>
    </View>
  );
}

const InfoTile = ({ icon, label, value, fullWidth, selectable }: { icon: any, label: string, value: string, fullWidth?: boolean, selectable?: boolean }) => (
    <View style={{ width: fullWidth ? '100%' : '50%' }}>
        <View className="flex-row items-center gap-2 mb-1">
            {icon}
            <Text className="text-slate-600 text-[10px] font-black uppercase tracking-widest">{label}</Text>
        </View>
        <Text className="text-white font-bold text-base" selectable={selectable}>{value}</Text>
    </View>
);

const ChallengeCard = ({ challenge, index, isEditing, onDelete }: { challenge: any, coachId: string, index: number, isEditing?: boolean, onDelete?: () => void }) => {
    const router = useRouter();
    const [showMenu, setShowMenu] = useState(false);
    const totalSubs = Number(challenge.total_subs || 0);
    const completedSubs = Number(challenge.completed_subs || 0);
    const completionRate = totalSubs > 0 ? Math.round((completedSubs / totalSubs) * 100) : 0;
    const totalDays = Math.max(1, Math.ceil((new Date(challenge.end_date).getTime() - new Date(challenge.start_date).getTime()) / (1000 * 3600 * 24)));
    
    return (
        <Swipeable
            renderRightActions={() => (
                <View className="flex-row mb-6 pl-4 h-[280px]">
                    <TouchableOpacity 
                        onPress={() => router.push(`/(coach)/challenges/${challenge.id}`)}
                        className="w-16 h-full bg-slate-800 rounded-3xl items-center justify-center border border-white/5 mr-2"
                    >
                        <Edit2 size={20} color="white" />
                    </TouchableOpacity>
                    <TouchableOpacity 
                        onPress={onDelete}
                        className="w-16 h-full bg-red-500 rounded-3xl items-center justify-center shadow-lg shadow-red-500/20"
                    >
                        <Trash2 size={20} color="white" />
                    </TouchableOpacity>
                </View>
            )}
            enabled={isEditing}
        >
            <MotiView 
                from={{ opacity: 0, scale: 0.95 }} 
                animate={{ opacity: 1, scale: 1 }} 
                transition={{ delay: index * 100 }}
                className="bg-slate-900 border border-white/5 rounded-[40px] p-8 mb-6 overflow-hidden"
            >
                <View className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 rounded-full blur-3xl -mr-16 -mt-16" />
                
                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => router.push(`/(coach)/challenges/${challenge.id}`)}
                >
                    <View className="flex-row justify-between items-start mb-10">
                        <View className="flex-row items-center gap-3">
                            <BrandedAvatar name={challenge.client_name || 'Client'} size={32} imageUrl={challenge.client_avatar} />
                            <View>
                                <Text className="text-slate-500 text-[8px] font-black uppercase tracking-widest">Client</Text>
                                <Text className="text-white font-bold text-sm tracking-tight">{challenge.client_name || 'Individual'}</Text>
                            </View>
                        </View>
                        <View className="bg-slate-950 px-3 py-1.5 rounded-full border border-blue-600/20">
                            <Text className="text-blue-500 text-[8px] font-black uppercase tracking-[2px]">High Intensity</Text>
                        </View>
                    </View>

                    <Text className="text-white text-2xl font-black mb-4 tracking-tight">{challenge.name}</Text>
                    
                    <View className="flex-row items-center gap-4 mb-10">
                        <View className="flex-row items-center gap-2">
                            <CalendarIcon size={14} color="#64748B" />
                            <Text className="text-slate-400 text-[11px] font-bold">
                                {new Date(challenge.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - {new Date(challenge.end_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </Text>
                        </View>
                        <View className="w-1 h-1 rounded-full bg-slate-800" />
                        <Text className="text-slate-400 text-[11px] font-bold">{totalDays} {totalDays === 1 ? 'Day' : 'Days'}</Text>
                    </View>

                    <View className="flex-row justify-between items-end mb-3">
                        <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Progress</Text>
                        <Text className="text-white text-xl font-black tracking-tight">{completionRate}%</Text>
                    </View>

                    <View className="w-full h-2 bg-slate-950 rounded-full overflow-hidden mb-10">
                        <View className="h-full bg-blue-600 rounded-full" style={{ width: `${completionRate}%` }} />
                    </View>
                </TouchableOpacity>

                <View className="flex-row gap-3">
                    <TouchableOpacity 
                        onPress={() => router.push(`/(coach)/challenges/${challenge.id}`)}
                        className="flex-1 h-16 bg-blue-600 rounded-[24px] items-center justify-center shadow-2xl shadow-blue-500/20"
                    >
                        <Text className="text-white font-black text-base">Manage Plan</Text>
                    </TouchableOpacity>
                    {isEditing ? (
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
                                    from={{ opacity: 0, translateY: 8, scale: 0.92 }}
                                    animate={{ opacity: 1, translateY: 0, scale: 1 }}
                                    exit={{ opacity: 0, translateY: 8, scale: 0.92 }}
                                    transition={{ type: 'timing', duration: 180 }}
                                    style={{
                                        position: 'absolute',
                                        bottom: 72,
                                        right: 0,
                                        backgroundColor: '#0F172A',
                                        borderWidth: 1,
                                        borderColor: 'rgba(255,255,255,0.08)',
                                        borderRadius: 20,
                                        padding: 8,
                                        width: 160,
                                        zIndex: 50,
                                        shadowColor: '#000',
                                        shadowOffset: { width: 0, height: 8 },
                                        shadowOpacity: 0.5,
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
                                        <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(59,130,246,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                                            <Edit2 size={16} color="#3B82F6" />
                                        </View>
                                        <Text style={{ color: 'white', fontWeight: '700', fontSize: 13 }}>Edit</Text>
                                    </TouchableOpacity>
                                    
                                    <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginHorizontal: 8, marginVertical: 4 }} />
                                    
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
                                ? { backgroundColor: '#1E293B', borderColor: 'rgba(59,130,246,0.5)' }
                                : { backgroundColor: '#020617', borderColor: 'rgba(255,255,255,0.05)' }
                            ]}
                        >
                            <MoreVertical size={20} color={showMenu ? '#3B82F6' : '#64748B'} />
                        </TouchableOpacity>
                    </View>
                    )}
                </View>
            </MotiView>
        </Swipeable>
    );
};
