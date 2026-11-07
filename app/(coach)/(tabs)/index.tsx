import { useBrand, useBrandColors, useTheme } from '@/contexts/BrandContext';
import { isDarkColor, hexToRGB } from '@/lib/theme-utils';
import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from 'react';
import {
  View,
  ScrollView,
  SectionList,
  ActivityIndicator,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
  Modal,
  TextInput,
  Dimensions,
  StyleSheet,
  Platform,
  Animated,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from '@/components/BrandedText';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { MotiView, AnimatePresence } from 'moti';
import { useReducedMotion } from 'react-native-reanimated';
import { useAuth } from '@/contexts/AuthContext';
import { useUnread } from '@/contexts/UnreadContext';
import { supabase } from '@/lib/supabase';
import {
  User,
  Users,
  MessageSquare,
  ClipboardCheck,
  Trophy,
  UserPlus,
  ChevronRight,
  ChevronLeft,
  TrendingUp,
  Zap,
  Smile,
  Activity,
  ArrowUpRight,
  Check,
  X,
  Search,
  Video,
  Utensils,
  Moon,
  CheckCircle2,
  Flame,
  BarChart2,
} from 'lucide-react-native';
import { BrandedAvatar } from '@/components/BrandedAvatar';
import LightRays from '@/components/ui/LightRays';
import FeedbackModal from '@/components/FeedbackModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePresence } from '@/contexts/PresenceContext';
import SchedulerModal from '@/components/SchedulerModal';
import { AnalyticsSparkline } from '@/components/AnalyticsSparkline';
import { useTabBarScroll } from '@/contexts/TabBarScrollContext';
import { useGreeting } from '@/hooks/useGreeting';
import { joinSession } from '@/utils/session';
import { CoachDashboardSkeleton } from '@/components/CoachDashboardSkeleton';
import StreakFire from '@/components/StreakFire';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MEAL_CARD_WIDTH = Math.min(SCREEN_WIDTH - 24, 420);

const formatActivityDate = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const checkDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const timeStr = date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (checkDate.getTime() === today.getTime()) {
    return `Today, ${timeStr}`;
  } else if (checkDate.getTime() === yesterday.getTime()) {
    return `Yesterday, ${timeStr}`;
  } else {
    return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`;
  }
};

const getPastLocalDateStr = (daysAgo: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
};

export default function CoachDashboard() {
  const colors = useBrandColors();
  const { isDarkMode } = useTheme();
  const { brand, refreshBrand } = useBrand();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, coach } = useAuth();
  const { handleScroll } = useTabBarScroll();
  const { unreadCount } = useUnread();
  const { greeting, emoji } = useGreeting();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recentCheckins, setRecentCheckins] = useState<any[]>([]);
  const [hasMoreCheckins, setHasMoreCheckins] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const reduceMotion = useReducedMotion();
  const { onlineUserIds, isUserOnline } = usePresence();
  const [isPresenceDropdownOpen, setIsPresenceDropdownOpen] = useState(false);
  const touchInsideDropdownRef = useRef(false);
  const [dashboardClients, setDashboardClients] = useState<any[]>([]);
  const [teamCoaches, setTeamCoaches] = useState<any[]>([]);
  const [recentInteractionMap, setRecentInteractionMap] = useState<
    Record<string, number>
  >({});
  const [clientUserIds, setClientUserIds] = useState<string[]>([]);
  const [stats, setStats] = useState({
    totalClients: 0,
    activeClients: 0,
    compliantToday: 0,
    pendingCheckIns: 0,
    unreadMessages: 0,
    activeChallenges: 0,
    todaysSessions: 0,
    totalCoaches: 0,
  });

  // Upcoming live session state for today
  const [upcomingSession, setUpcomingSession] = useState<any>(null);
  const [nowMs, setNowMs] = useState<number>(Date.now());

  // Today's Meals with photos state
  const [todayMeals, setTodayMeals] = useState<any[]>([]);

  // Slipping / Needs Attention clients state
  const [slippingClients, setSlippingClients] = useState<any[]>([]);

  // Clients Performance averages state
  const [teamPulse, setTeamPulse] = useState<{
    avgSleep: number | null;
    avgEnergy: number | null;
    habitRate: number | null;
    totalLogged: number;
  }>({
    avgSleep: null,
    avgEnergy: null,
    habitRate: null,
    totalLogged: 0,
  });

  // Top Streak clients state
  const [streakChampions, setStreakChampions] = useState<any[]>([]);

  // Activity filter state: all | low_energy | good_mood
  const [feedFilter, setFeedFilter] = useState<
    'all' | 'low_energy' | 'good_mood'
  >('all');

  // AI Scheduler State
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [selectedClientForAI, setSelectedClientForAI] = useState<any>(null);
  const [showAIScheduler, setShowAIScheduler] = useState(false);
  const [allSessions, setAllSessions] = useState<any[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [analyticsData, setAnalyticsData] = useState<any[]>([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);

  // Plan sent success modal
  const params = useLocalSearchParams();
  const [showPlanSentModal, setShowPlanSentModal] = useState(false);
  const [planSentClientName, setPlanSentClientName] = useState('');
  const [planSentClientAvatar, setPlanSentClientAvatar] = useState('');

  // Tick nowMs every 30s to update upcoming session countdown
  useEffect(() => {
    const ticker = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(ticker);
  }, []);

  // Show success modal when arriving from AI challenge review screen
  useEffect(() => {
    if (params.plan_sent === 'true') {
      const name = (params.sent_client_name as string) || '';
      const clientId = (params.sent_client_id as string) || '';
      setPlanSentClientName(name);

      const fetchAvatar = async () => {
        if (clientId) {
          try {
            const { data } = await supabase
              .from('clients')
              .select('profiles!inner(avatar_url)')
              .eq('id', clientId)
              .single();
            const avatarUrl = (data as any)?.profiles?.avatar_url || '';
            setPlanSentClientAvatar(avatarUrl);
          } catch (_) {
            setPlanSentClientAvatar('');
          }
        }
        setTimeout(() => setShowPlanSentModal(true), 400);
      };
      fetchAvatar();
    }
  }, [params.plan_sent]);

  // Display count is stats.activeClients
  const displayActiveCount = stats.activeClients;

  useEffect(() => {
    if (coach) {
      loadDashboardData();

      const channelId = `coach_dashboard_realtime_${Date.now()}_${Math.random()}`;
      const checkinSubscription = supabase
        .channel(channelId)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'check_ins' },
          () => {
            loadDashboardData();
          },
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'habit_logs' },
          () => {
            loadDashboardData();
          },
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'sub_challenges' },
          () => {
            loadDashboardData();
          },
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'sessions' },
          () => {
            loadDashboardData();
          },
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'meals' },
          () => {
            loadDashboardData();
          },
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'messages' },
          () => {
            loadDashboardData();
          },
        )
        .subscribe();

      return () => {
        supabase.removeChannel(checkinSubscription);
      };
    } else {
      setLoading(false);
    }
  }, [coach, unreadCount]);

  useFocusEffect(
    useCallback(() => {
      if (coach) {
        loadDashboardData();
      }
    }, [coach, unreadCount]),
  );

  const loadDashboardData = async () => {
    if (!coach) return;
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const coachUserId = profile?.id || (coach as any)?.user_id;

      const [
        statsResult,
        checkinsResult,
        clientsResult,
        challengesResult,
        sessionResult,
        teamCoachesResult,
        subCoachesResult,
        recentMessagesResult,
      ] = await Promise.all([
        supabase.rpc('get_coach_stats'),
        supabase.rpc('get_recent_checkins', { p_cursor: null, p_limit: 15 }),
        supabase.rpc('get_my_clients'),
        supabase.rpc('get_coach_mother_challenges', {
          p_coach_id: coach?.id,
        }),
        supabase
          .from('sessions')
          .select('*, client:clients(profiles(full_name, avatar_url))')
          .eq('coach_id', coach.id)
          .eq('status', 'scheduled')
          .gte('scheduled_at', new Date().toISOString())
          .lte('scheduled_at', todayEnd.toISOString())
          .order('scheduled_at', { ascending: true })
          .limit(1)
          .maybeSingle(),
        supabase.rpc('get_team_coaches'),
        coach?.id
          ? supabase.rpc('get_sub_coaches', { p_parent_coach_id: coach.id })
          : Promise.resolve({ data: [] }),
        coachUserId
          ? supabase
              .from('messages')
              .select('created_at, sender_id, recipient_id')
              .or(`sender_id.eq.${coachUserId},recipient_id.eq.${coachUserId}`)
              .order('created_at', { ascending: false })
              .limit(250)
          : Promise.resolve({ data: [] }),
      ]);

      const todayDateObj = new Date();
      todayDateObj.setHours(0, 0, 0, 0);

      const activeChallengesCount = (challengesResult?.data || []).filter(
        (c: any) =>
          c.status === 'active' &&
          new Date(c.end_date).getTime() >= todayDateObj.getTime(),
      ).length;

      const subCoachesCount = subCoachesResult?.data?.length || 0;
      const teamCoachesCount = teamCoachesResult?.data?.length || 0;
      const totalCoachesCount = Math.max(
        1,
        Math.max(subCoachesCount, teamCoachesCount) + 1,
      );

      if (statsResult.data) {
        const statsData = Array.isArray(statsResult.data)
          ? statsResult.data[0]
          : statsResult.data;

        setStats({
          totalClients: statsData?.totalClients || 0,
          activeClients: statsData?.activeClients || 0,
          compliantToday: statsData?.compliantToday || 0,
          pendingCheckIns: statsData?.pendingCheckIns || 0,
          unreadMessages: unreadCount,
          activeChallenges: activeChallengesCount,
          todaysSessions: statsData?.todaysSessions || 0,
          totalCoaches: totalCoachesCount,
        });
      }

      const allClients = clientsResult.data || [];
      const clientMap = new Map<
        string,
        { name: string; avatar: string; userId?: string }
      >();
      const userToClientMap = new Map<
        string,
        { clientId: string; name: string; avatar: string }
      >();

      if (clientsResult.data) {
        const ids = allClients
          .filter((c: any) => c.status === 'active')
          .map((c: any) => c.user_id || c.client_user_id)
          .filter(Boolean);

        setClientUserIds(ids);

        allClients.forEach((c: any) => {
          const uId = c.user_id || c.client_user_id;
          clientMap.set(c.client_id, {
            name: c.client_name,
            avatar: c.client_avatar,
            userId: uId,
          });
          if (uId) {
            userToClientMap.set(uId, {
              clientId: c.client_id,
              name: c.client_name,
              avatar: c.client_avatar,
            });
          }
        });

        // Calculate real daily streaks for active clients
        const activeClients = allClients.filter(
          (c: any) => c.status === 'active',
        );
        const activeClientIds = activeClients
          .map((c: any) => c.client_id)
          .filter(Boolean);

        if (activeClientIds.length > 0) {
          try {
            const past60Str = getPastLocalDateStr(60);
            const [checkInsRes, mealsRes, habitsRes, habitLogsRes] =
              await Promise.all([
                supabase
                  .from('check_ins')
                  .select('client_id, date')
                  .in('client_id', activeClientIds)
                  .gte('date', past60Str),
                supabase
                  .from('meals')
                  .select('client_id, meal_date')
                  .in('client_id', activeClientIds)
                  .gte('meal_date', past60Str),
                supabase
                  .from('habits')
                  .select('id, client_id, created_at, is_active')
                  .in('client_id', activeClientIds)
                  .eq('is_active', true),
                supabase
                  .from('habit_logs')
                  .select('client_id, habit_id, date, completed')
                  .in('client_id', activeClientIds)
                  .gte('date', past60Str)
                  .eq('completed', true),
              ]);

            const checkInDatesByClient = new Map<string, Set<string>>();
            (checkInsRes.data || []).forEach((c: any) => {
              if (!checkInDatesByClient.has(c.client_id)) {
                checkInDatesByClient.set(c.client_id, new Set());
              }
              checkInDatesByClient.get(c.client_id)!.add(c.date);
            });

            const mealDatesByClient = new Map<string, Set<string>>();
            (mealsRes.data || []).forEach((m: any) => {
              if (!mealDatesByClient.has(m.client_id)) {
                mealDatesByClient.set(m.client_id, new Set());
              }
              mealDatesByClient.get(m.client_id)!.add(m.meal_date);
            });

            const habitsByClient = new Map<string, any[]>();
            (habitsRes.data || []).forEach((h: any) => {
              if (!habitsByClient.has(h.client_id)) {
                habitsByClient.set(h.client_id, []);
              }
              habitsByClient.get(h.client_id)!.push(h);
            });

            const completedHabitLogsByClient = new Map<string, any[]>();
            (habitLogsRes.data || []).forEach((hl: any) => {
              if (!completedHabitLogsByClient.has(hl.client_id)) {
                completedHabitLogsByClient.set(hl.client_id, []);
              }
              completedHabitLogsByClient.get(hl.client_id)!.push(hl);
            });

            const champions: any[] = [];

            activeClients.forEach((client: any) => {
              const cId = client.client_id;
              const checkInDatesSet =
                checkInDatesByClient.get(cId) || new Set();
              const mealDatesSet = mealDatesByClient.get(cId) || new Set();
              const activeHabitsList = habitsByClient.get(cId) || [];
              const completedLogs = completedHabitLogsByClient.get(cId) || [];

              const isDateCompleted = (dateStr: string) => {
                if (!checkInDatesSet.has(dateStr)) return false;
                if (!mealDatesSet.has(dateStr)) return false;
                const habitsForDate = activeHabitsList.filter((h: any) => {
                  const createdDate = h.created_at
                    ? h.created_at.split('T')[0]
                    : '2000-01-01';
                  return createdDate <= dateStr;
                });
                if (habitsForDate.length > 0) {
                  return habitsForDate.every((h: any) =>
                    completedLogs.some(
                      (l: any) =>
                        l.habit_id === h.id &&
                        l.date === dateStr &&
                        l.completed,
                    ),
                  );
                }
                return true;
              };

              const isTodayDone = isDateCompleted(getPastLocalDateStr(0));
              const isYesterdayDone = isDateCompleted(getPastLocalDateStr(1));
              const isDayBeforeYesterdayDone = isDateCompleted(
                getPastLocalDateStr(2),
              );

              const countStreak = (startDaysAgo: number) => {
                let count = isTodayDone ? 1 : 0;
                let daysAgo = startDaysAgo;
                let consecutiveMiss = 0;
                while (daysAgo <= 60) {
                  if (isDateCompleted(getPastLocalDateStr(daysAgo))) {
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
              let isCold = false;

              if (isYesterdayDone) {
                computedStreak = countStreak(1);
              } else if (isDayBeforeYesterdayDone) {
                computedStreak = countStreak(2);
                isCold = !isTodayDone && computedStreak > 0;
              } else {
                computedStreak = isTodayDone ? 1 : 0;
              }

              // Only clients with an active streak (> 0) qualify
              if (computedStreak > 0) {
                champions.push({
                  ...client,
                  streak: computedStreak,
                  isCold,
                });
              }
            });

            champions.sort((a, b) => b.streak - a.streak);
            setStreakChampions(champions);
          } catch (err) {
            console.error('Error computing streaks:', err);
            setStreakChampions([]);
          }
        } else {
          setStreakChampions([]);
        }
      }

      setDashboardClients(clientsResult.data || []);
      setTeamCoaches(teamCoachesResult?.data || []);

      const interactionMap: Record<string, number> = {};
      if (recentMessagesResult?.data) {
        recentMessagesResult.data.forEach((m: any) => {
          const otherId =
            m.sender_id === coachUserId ? m.recipient_id : m.sender_id;
          if (otherId && !interactionMap[otherId]) {
            interactionMap[otherId] = new Date(m.created_at).getTime();
          }
        });
      }
      setRecentInteractionMap(interactionMap);

      setRecentCheckins(checkinsResult.data || []);
      setHasMoreCheckins((checkinsResult.data || []).length === 15);
      setUpcomingSession(sessionResult?.data || null);

      // Fetch ONLY Unseen Meal Logs (meal_log messages sent to the coach that haven't been seen/read in Messages yet)
      const allClientIds = allClients.map((c: any) => c.client_id);
      if (allClientIds.length > 0) {
        const coachUserId = profile?.id || (coach as any)?.user_id;
        const mealMsgsRes = coachUserId
          ? await supabase
              .from('messages')
              .select('id, sender_id, recipient_id, content, read, created_at')
              .eq('recipient_id', coachUserId)
              .eq('read', false)
              .ilike('content', '%meal%')
              .order('created_at', { ascending: false })
              .limit(20)
          : { data: [] as any[] };

        const unseenEntries: {
          mealId: string;
          messageId: string;
          parsed: any;
          row: any;
          clientInfo: { clientId: string; name: string; avatar: string };
        }[] = [];
        const seenMealIds = new Set<string>();

        (mealMsgsRes.data || []).forEach((msg: any) => {
          try {
            let p =
              typeof msg.content === 'string'
                ? JSON.parse(msg.content)
                : msg.content;
            if (typeof p === 'string' && p.trim().startsWith('{')) {
              p = JSON.parse(p.trim());
            }
            if ((p?.type === 'meal_log' || p?.type === 'meal') && p?.mealId) {
              const clientInfo = userToClientMap.get(msg.sender_id);
              if (clientInfo && !seenMealIds.has(p.mealId)) {
                seenMealIds.add(p.mealId);
                unseenEntries.push({
                  mealId: p.mealId,
                  messageId: msg.id,
                  parsed: p,
                  row: msg,
                  clientInfo,
                });
              }
            }
          } catch {}
        });

        if (unseenEntries.length > 0) {
          const unseenMealIds = unseenEntries.map((e) => e.mealId);
          const { data: mealsRows } = await supabase
            .from('meals')
            .select(
              'id, client_id, meal_name, description, meal_date, meal_time, meal_type, calories, protein_g, carbs_g, fat_g, photo_url, created_at',
            )
            .in('id', unseenMealIds);

          const mealRowMap = new Map<string, any>();
          (mealsRows || []).forEach((m: any) => {
            mealRowMap.set(m.id, m);
          });

          const unseenMeals = unseenEntries
            .map(({ mealId, messageId, parsed, row, clientInfo }) => {
              const m = mealRowMap.get(mealId);
              const photoUrl =
                m?.photo_url ||
                parsed.imageUrl ||
                parsed.photo_url ||
                parsed.url;
              if (!photoUrl) return null;
              return {
                id: mealId,
                client_id: m?.client_id || clientInfo.clientId,
                meal_name: m?.meal_name || parsed.mealName || 'Meal Log',
                description: m?.description || parsed.description || '',
                meal_date:
                  m?.meal_date ||
                  (parsed.timestamp || row.created_at || '').split('T')[0],
                meal_time: m?.meal_time || '',
                meal_type: m?.meal_type || parsed.mealType || 'meal',
                calories: m?.calories ?? parsed.calories,
                protein_g: m?.protein_g ?? parsed.protein,
                carbs_g: m?.carbs_g,
                fat_g: m?.fat_g,
                photo_url: photoUrl,
                created_at: row.created_at || parsed.timestamp || m?.created_at,
                message_id: messageId,
                client_name: clientInfo.name || 'Client',
                client_avatar: clientInfo.avatar,
              };
            })
            .filter(Boolean);

          setTodayMeals(unseenMeals);
        } else {
          setTodayMeals([]);
        }

        // Fetch Habit Logs for client performance
        const { data: habitLogs } = await supabase
          .from('habit_logs')
          .select('completed')
          .eq('date', todayStr)
          .in('client_id', allClientIds);

        let habitRate: number | null = null;
        if (habitLogs && habitLogs.length > 0) {
          const completedCount = habitLogs.filter(
            (h: any) => h.completed,
          ).length;
          habitRate = Math.round((completedCount / habitLogs.length) * 100);
        }

        // Compute Clients Performance (Avg sleep and energy from today's checkins)
        const todayCheckins = (checkinsResult.data || []).filter((c: any) => {
          const cDate = new Date(c.created_at).toISOString().split('T')[0];
          return cDate === todayStr;
        });

        let avgSleep: number | null = null;
        let avgEnergy: number | null = null;

        if (todayCheckins.length > 0) {
          const sleepVals = todayCheckins
            .filter((c: any) => c.sleep_hours != null)
            .map((c: any) => Number(c.sleep_hours));
          if (sleepVals.length > 0) {
            avgSleep =
              Math.round(
                (sleepVals.reduce((a: number, b: number) => a + b, 0) /
                  sleepVals.length) *
                  10,
              ) / 10;
          }

          const energyVals = todayCheckins
            .filter((c: any) => c.energy_level != null)
            .map((c: any) => Number(c.energy_level));
          if (energyVals.length > 0) {
            avgEnergy =
              Math.round(
                (energyVals.reduce((a: number, b: number) => a + b, 0) /
                  energyVals.length) *
                  10,
              ) / 10;
          }
        }

        setTeamPulse({
          avgSleep,
          avgEnergy,
          habitRate,
          totalLogged: todayCheckins.length,
        });

        // Compute Slipping Clients (haven't checked in for 2+ days)
        const latestCheckinMap = new Map<string, number>();
        (checkinsResult.data || []).forEach((c: any) => {
          latestCheckinMap.set(c.client_id, new Date(c.created_at).getTime());
        });

        const twoDaysAgoMs = Date.now() - 2 * 24 * 60 * 60 * 1000;
        const slipping: any[] = [];

        allClients.forEach((client: any) => {
          const lastCheckinTime = latestCheckinMap.get(client.client_id);
          if (!lastCheckinTime || lastCheckinTime < twoDaysAgoMs) {
            const daysSince = lastCheckinTime
              ? Math.floor(
                  (Date.now() - lastCheckinTime) / (24 * 60 * 60 * 1000),
                )
              : null;
            slipping.push({
              ...client,
              daysSinceCheckin: daysSince,
            });
          }
        });

        setSlippingClients(slipping.slice(0, 10));
      }

      // Fetch analytics trend data
      setLoadingAnalytics(true);
      const analyticsResult = await supabase.rpc('get_coach_analytics_trend');
      if (analyticsResult.data) {
        setAnalyticsData(analyticsResult.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingAnalytics(false);
    }
  };

  const loadMoreCheckins = async () => {
    if (
      !coach ||
      loadingMore ||
      !hasMoreCheckins ||
      recentCheckins.length === 0
    )
      return;
    setLoadingMore(true);
    try {
      const lastCheckin = recentCheckins[recentCheckins.length - 1];
      const result = await supabase.rpc('get_recent_checkins', {
        p_cursor: lastCheckin.created_at,
        p_limit: 15,
      });

      const newData = result.data || [];
      if (newData.length > 0) {
        setRecentCheckins((prev) => {
          const existingIds = new Set(prev.map((c) => c.checkin_id));
          return [
            ...prev,
            ...newData.filter((c: any) => !existingIds.has(c.checkin_id)),
          ];
        });
      }
      setHasMoreCheckins(newData.length === 15);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMore(false);
    }
  };

  const filteredCheckins = useMemo(() => {
    if (feedFilter === 'low_energy') {
      return recentCheckins.filter(
        (c) => c.energy_level != null && c.energy_level <= 5,
      );
    }
    if (feedFilter === 'good_mood') {
      return recentCheckins.filter((c) => {
        if (!c.mood) return false;
        const m = c.mood.toLowerCase();
        return (
          m.includes('good') ||
          m.includes('great') ||
          m.includes('happy') ||
          m.includes('energized') ||
          m.includes('strong') ||
          m.includes('motivated')
        );
      });
    }
    return recentCheckins;
  }, [recentCheckins, feedFilter]);

  const groupedCheckins = useMemo(() => {
    const groups: { [key: string]: any[] } = {};

    filteredCheckins.forEach((item) => {
      const date = new Date(item.created_at);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const checkDate = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
      );

      let headerStr = '';
      if (checkDate.getTime() === today.getTime()) {
        headerStr = `TODAY — ${date.toLocaleDateString([], { month: 'short', day: 'numeric' }).toUpperCase()}`;
      } else if (checkDate.getTime() === yesterday.getTime()) {
        headerStr = `YESTERDAY — ${date.toLocaleDateString([], { month: 'short', day: 'numeric' }).toUpperCase()}`;
      } else {
        headerStr = date
          .toLocaleDateString([], {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })
          .toUpperCase();
      }

      if (!groups[headerStr]) {
        groups[headerStr] = [];
      }
      groups[headerStr].push(item);
    });

    return Object.keys(groups).map((key) => ({
      title: key,
      data: groups[key],
    }));
  }, [filteredCheckins]);

  const handleOpenAIScheduler = async () => {
    setLoadingClients(true);
    setShowClientPicker(true);
    try {
      const [clientsResult, sessionsResult] = await Promise.all([
        supabase.rpc('get_my_clients'),
        supabase
          .from('sessions')
          .select('*, client:clients(profiles(full_name, avatar_url))')
          .eq('coach_id', coach?.id),
      ]);

      if (clientsResult.data) {
        setClients(
          clientsResult.data.map((c: any) => ({
            id: c.client_id,
            name: c.client_name,
            avatar: c.client_avatar,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          })),
        );
      }
      setAllSessions(sessionsResult.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingClients(false);
    }
  };

  const startAIScheduler = (client: any) => {
    setSelectedClientForAI(client);
    setShowClientPicker(false);
    setShowAIScheduler(true);
  };

  const isDark = isDarkMode || isDarkColor(colors.background || '#010417');
  const textColor = colors.text || (isDark ? '#FFFFFF' : '#0F172A');
  const textSecondaryColor =
    colors.textSecondary || (isDark ? '#94A3B8' : '#64748B');
  const cardBg = colors.surface || (isDark ? '#0F172A' : '#FFFFFF');
  const cardBorder = isDark
    ? 'rgba(255, 255, 255, 0.08)'
    : colors.border || '#E2E8F0';

  const cardStyle = {
    backgroundColor: cardBg,
    borderColor: cardBorder,
    borderWidth: 1,
  };

  const brandBgHex = isDark
    ? brand?.dark_background_color || colors.background || '#0F172A'
    : brand?.background_color || colors.background || '#FFFFFF';
  const bgRgb = hexToRGB(brandBgHex);
  const topBarBg = `rgba(${bgRgb.r}, ${bgRgb.g}, ${bgRgb.b}, ${isDark ? 0.72 : 0.82})`;

  const borderHex = colors.border || (isDark ? '#334155' : '#E2E8F0');
  const borderRgb = hexToRGB(borderHex);
  const topBarBorder = `rgba(${borderRgb.r}, ${borderRgb.g}, ${borderRgb.b}, ${isDark ? 0.35 : 0.55})`;

  const topBarHeight = insets.top + 68;
  const headerAnim = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);
  const isHeaderHidden = useRef(false);

  const handleDashboardScroll = (event: any) => {
    handleScroll(event);

    const currentScrollY = event.nativeEvent.contentOffset.y;

    if (currentScrollY <= 15) {
      if (isHeaderHidden.current) {
        isHeaderHidden.current = false;
        Animated.spring(headerAnim, {
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
          if (isPresenceDropdownOpen) {
            setIsPresenceDropdownOpen(false);
          }
          Animated.timing(headerAnim, {
            toValue: -topBarHeight,
            duration: 200,
            useNativeDriver: true,
          }).start();
        }
      } else if (diff < 0) {
        // Scrolling UP -> Show bar
        if (isHeaderHidden.current) {
          isHeaderHidden.current = false;
          Animated.spring(headerAnim, {
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

  const rawFirstName = profile?.full_name?.split(' ')[0] || '';
  const firstName = rawFirstName
    ? rawFirstName.charAt(0).toUpperCase() + rawFirstName.slice(1)
    : '';

  useEffect(() => {
    const coachUserId = profile?.id || (coach as any)?.user_id;
    if (!coachUserId) return;

    const sub = supabase
      .channel('coach-dashboard-messages-presence')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const msg = payload.new;
          if (
            msg &&
            (msg.sender_id === coachUserId || msg.recipient_id === coachUserId)
          ) {
            const otherId =
              msg.sender_id === coachUserId ? msg.recipient_id : msg.sender_id;
            if (otherId) {
              setRecentInteractionMap((prev) => ({
                ...prev,
                [otherId]: new Date(msg.created_at).getTime(),
              }));
            }
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, [profile?.id, coach?.user_id]);

  const { onlineClients, onlineCoaches, offlineUsers, totalOnline } =
    useMemo(() => {
      const onClients: any[] = [];
      const offClients: any[] = [];

      (dashboardClients || []).forEach((c: any) => {
        const uId = c.user_id || c.client_user_id;
        const online = uId ? isUserOnline(uId) : false;
        const item = {
          type: 'client',
          id: c.client_id,
          userId: uId,
          name: c.client_name || 'Client',
          avatarUrl: c.client_avatar,
          isOnline: online,
          lastInteractionTime: uId ? recentInteractionMap[uId] || 0 : 0,
        };
        if (online) {
          onClients.push(item);
        } else {
          offClients.push(item);
        }
      });

      const onCoaches: any[] = [];
      const offCoaches: any[] = [];

      (teamCoaches || []).forEach((tc: any) => {
        const uId = tc.user_id;
        const online = uId ? isUserOnline(uId) : false;
        const item = {
          type: 'coach',
          coachId: tc.coach_id,
          userId: uId,
          name: tc.full_name || 'Coach',
          avatarUrl: tc.avatar_url,
          isOnline: online,
          lastInteractionTime: uId ? recentInteractionMap[uId] || 0 : 0,
        };
        if (online) {
          onCoaches.push(item);
        } else {
          offCoaches.push(item);
        }
      });

      // Offline section includes all offline coaches and offline clients
      // Sorted by recent interactions (latest message time first)
      const combinedOffline = [...offClients, ...offCoaches].sort((a, b) => {
        if (b.lastInteractionTime !== a.lastInteractionTime) {
          return b.lastInteractionTime - a.lastInteractionTime;
        }
        return a.name.localeCompare(b.name);
      });

      return {
        onlineClients: onClients,
        onlineCoaches: onCoaches,
        offlineUsers: combinedOffline,
        totalOnline: onClients.length + onCoaches.length,
      };
    }, [
      dashboardClients,
      teamCoaches,
      recentInteractionMap,
      onlineUserIds,
      isUserOnline,
    ]);

  const handleNavigateToMessage = (item: any) => {
    setIsPresenceDropdownOpen(false);
    if (item.type === 'client') {
      router.push({
        pathname: '/(coach)/chat/[id]',
        params: { id: item.id },
      });
    } else if (item.type === 'coach') {
      router.push({
        pathname: '/(coach)/chat/coach/[coachId]',
        params: {
          coachId: item.coachId,
          userId: item.userId,
          fullName: item.name,
          avatarUrl: item.avatarUrl || '',
        },
      });
    }
  };

  const renderUserCard = (item: any) => (
    <TouchableOpacity
      key={`${item.type}-${item.id || item.coachId || item.userId}`}
      activeOpacity={0.7}
      onPress={() => handleNavigateToMessage(item)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 16,
        backgroundColor: isDark
          ? 'rgba(255, 255, 255, 0.04)'
          : 'rgba(0, 0, 0, 0.02)',
        marginBottom: 8,
        borderWidth: 1,
        borderColor: isDark
          ? 'rgba(255, 255, 255, 0.06)'
          : 'rgba(0, 0, 0, 0.05)',
      }}
    >
      <View style={{ position: 'relative', marginRight: 12 }}>
        <BrandedAvatar name={item.name} imageUrl={item.avatarUrl} size={38} />
        {item.isOnline && (
          <View
            style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: '#22C55E',
              borderWidth: 1.5,
              borderColor: cardBg,
            }}
          />
        )}
      </View>

      <View style={{ flex: 1, marginRight: 8 }}>
        <Text
          numberOfLines={1}
          style={{
            color: textColor,
            fontSize: 14,
            fontWeight: '700',
          }}
        >
          {item.name}
        </Text>
        <Text
          numberOfLines={1}
          style={{
            color: textSecondaryColor,
            fontSize: 11,
            fontWeight: '500',
            marginTop: 1,
          }}
        >
          {item.type === 'coach' ? 'Coach' : 'Client'}
        </Text>
      </View>

      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => handleNavigateToMessage(item)}
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: `${colors.primary}18`,
          alignItems: 'center',
          justifyContent: 'center',
        }}
        accessibilityRole="button"
        accessibilityLabel={`Message ${item.name}`}
      >
        <MessageSquare size={16} color={colors.primary} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  if (loading && !refreshing) {
    return <CoachDashboardSkeleton />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

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
      <Animated.View
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
            {/* Brand profile & name */}
            <View className="flex-row items-center gap-3">
              {brand?.logo_url ? (
                <Image
                  source={{ uri: brand.logo_url }}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: isDark
                      ? 'rgba(255,255,255,0.12)'
                      : 'rgba(0,0,0,0.06)',
                  }}
                  contentFit="cover"
                />
              ) : (
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    backgroundColor: colors.primary + '20',
                    borderColor: colors.primary + '35',
                  }}
                  className="border items-center justify-center"
                >
                  <Text
                    style={{ color: colors.primary }}
                    className="text-xl font-black"
                  >
                    {brand?.name
                      ? brand.name.charAt(0).toUpperCase()
                      : coach?.business_name
                        ? coach.business_name.charAt(0).toUpperCase()
                        : 'C'}
                  </Text>
                </View>
              )}
              <View>
                <Text
                  style={{ color: textColor }}
                  className="text-lg font-black tracking-tight"
                  numberOfLines={1}
                >
                  {brand?.name || coach?.business_name || 'Coaching'}
                </Text>
                <Text
                  style={{ color: textSecondaryColor }}
                  className="text-[10px] font-bold uppercase tracking-wider"
                >
                  Coach Portal
                </Text>
              </View>
            </View>

            {/* Right section: Online Tag + Coach Profile */}
            <View className="flex-row items-center gap-2.5">
              {/* Online Tag */}
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
                    () => {},
                  );
                  setIsPresenceDropdownOpen((prev) => !prev);
                }}
                style={{
                  backgroundColor: cardBg,
                  borderColor: isPresenceDropdownOpen
                    ? colors.primary
                    : cardBorder,
                  borderWidth: 1,
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: 20,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                }}
                accessibilityRole="button"
                accessibilityLabel={`Online now: ${totalOnline}`}
              >
                <View style={{ position: 'relative' }}>
                  <User size={18} color={textColor} />
                  <View
                    style={{
                      position: 'absolute',
                      top: -1,
                      right: -3,
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: '#22C55E',
                      borderWidth: 1.5,
                      borderColor: cardBg,
                    }}
                  />
                </View>
                <Text
                  style={{
                    color: textColor,
                    fontSize: 13,
                    fontWeight: '700',
                  }}
                >
                  {totalOnline}
                </Text>
              </TouchableOpacity>

              {/* Coach Profile Avatar */}
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
                    () => {},
                  );
                  router.push({
                    pathname: '/(coach)/(tabs)/profile',
                    params: { scrollToTop: Date.now().toString() },
                  });
                }}
                className="p-1 rounded-full relative"
                style={{
                  backgroundColor: colors.surface,
                  borderColor: cardBorder,
                  borderWidth: 1,
                }}
                activeOpacity={0.7}
              >
                <BrandedAvatar
                  name={profile?.full_name || 'Coach'}
                  imageUrl={profile?.avatar_url}
                  size={42}
                />
                <View
                  style={{ backgroundColor: colors.primary }}
                  className="absolute bottom-0.5 right-0.5 w-3 h-3 rounded-full border-2 border-slate-900"
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Animated.View>

      {/* Floating Tooltip Dropdown for Online People */}
      <AnimatePresence>
        {isPresenceDropdownOpen && (
          <MotiView
            key="presence-dropdown-bubble"
            from={{
              opacity: reduceMotion ? 1 : 0,
              scale: reduceMotion ? 1 : 0.05,
              translateY: reduceMotion ? 0 : -20,
            }}
            animate={{
              opacity: 1,
              scale: 1,
              translateY: 0,
            }}
            exit={{
              opacity: reduceMotion ? 1 : 0,
              scale: reduceMotion ? 1 : 0.05,
              translateY: reduceMotion ? 0 : -20,
            }}
            transition={
              {
                type: 'spring',
                damping: 18,
                stiffness: 240,
                mass: 0.65,
              } as any
            }
            exitTransition={
              {
                type: 'spring',
                damping: 22,
                stiffness: 280,
                mass: 0.6,
              } as any
            }
            style={{
              position: 'absolute',
              top: insets.top + 64,
              right: 16,
              width: Math.min(SCREEN_WIDTH - 32, 340),
              zIndex: 150,
              transformOrigin: '76% 0%',
            }}
          >
            {/* Tooltip arrow pointing up to the online tag */}
            <View
              style={{
                position: 'absolute',
                top: -5,
                right: 76,
                width: 12,
                height: 12,
                backgroundColor: cardBg,
                borderColor: cardBorder,
                borderTopWidth: 1,
                borderLeftWidth: 1,
                transform: [{ rotate: '45deg' }],
                zIndex: 10,
              }}
            />

            <View
              onTouchStart={() => {
                touchInsideDropdownRef.current = true;
              }}
              onTouchEnd={() => {
                setTimeout(() => {
                  touchInsideDropdownRef.current = false;
                }, 200);
              }}
              onTouchCancel={() => {
                touchInsideDropdownRef.current = false;
              }}
              style={{
                backgroundColor: cardBg,
                borderColor: cardBorder,
                borderWidth: 1,
                borderRadius: 24,
                maxHeight: 380,
                overflow: 'hidden',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: isDark ? 0.45 : 0.15,
                shadowRadius: 18,
                elevation: 16,
              }}
            >
              <ScrollView
                nestedScrollEnabled={true}
                showsVerticalScrollIndicator={true}
                style={{ maxHeight: 380 }}
                contentContainerStyle={{ padding: 16 }}
                keyboardShouldPersistTaps="handled"
              >
                {/* Section 1: Online Clients */}
                {onlineClients.length > 0 && (
                  <View style={{ marginBottom: 16 }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        marginBottom: 8,
                        paddingHorizontal: 4,
                      }}
                    >
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: '#22C55E',
                          marginRight: 8,
                        }}
                      />
                      <Text
                        style={{
                          color: textColor,
                          fontSize: 12,
                          fontWeight: '800',
                          letterSpacing: 0.5,
                          textTransform: 'uppercase',
                        }}
                      >
                        Online Clients
                      </Text>
                      <View
                        style={{
                          marginLeft: 8,
                          paddingHorizontal: 6,
                          paddingVertical: 1,
                          borderRadius: 10,
                          backgroundColor: '#22C55E20',
                        }}
                      >
                        <Text
                          style={{
                            color: '#22C55E',
                            fontSize: 11,
                            fontWeight: '700',
                          }}
                        >
                          {onlineClients.length}
                        </Text>
                      </View>
                    </View>
                    {onlineClients.map(renderUserCard)}
                  </View>
                )}

                {/* Section 2: Online Coaches */}
                {onlineCoaches.length > 0 && (
                  <View style={{ marginBottom: 16 }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        marginBottom: 8,
                        paddingHorizontal: 4,
                      }}
                    >
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: '#22C55E',
                          marginRight: 8,
                        }}
                      />
                      <Text
                        style={{
                          color: textColor,
                          fontSize: 12,
                          fontWeight: '800',
                          letterSpacing: 0.5,
                          textTransform: 'uppercase',
                        }}
                      >
                        Online Coaches
                      </Text>
                      <View
                        style={{
                          marginLeft: 8,
                          paddingHorizontal: 6,
                          paddingVertical: 1,
                          borderRadius: 10,
                          backgroundColor: '#22C55E20',
                        }}
                      >
                        <Text
                          style={{
                            color: '#22C55E',
                            fontSize: 11,
                            fontWeight: '700',
                          }}
                        >
                          {onlineCoaches.length}
                        </Text>
                      </View>
                    </View>
                    {onlineCoaches.map(renderUserCard)}
                  </View>
                )}

                {/* Section 3: Offline */}
                {offlineUsers.length > 0 && (
                  <View style={{ marginBottom: 4 }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        marginBottom: 8,
                        paddingHorizontal: 4,
                      }}
                    >
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: textSecondaryColor,
                          opacity: 0.5,
                          marginRight: 8,
                        }}
                      />
                      <Text
                        style={{
                          color: textSecondaryColor,
                          fontSize: 12,
                          fontWeight: '800',
                          letterSpacing: 0.5,
                          textTransform: 'uppercase',
                        }}
                      >
                        Offline
                      </Text>
                      <View
                        style={{
                          marginLeft: 8,
                          paddingHorizontal: 6,
                          paddingVertical: 1,
                          borderRadius: 10,
                          backgroundColor: isDark
                            ? 'rgba(255, 255, 255, 0.08)'
                            : 'rgba(0, 0, 0, 0.06)',
                        }}
                      >
                        <Text
                          style={{
                            color: textSecondaryColor,
                            fontSize: 11,
                            fontWeight: '700',
                          }}
                        >
                          {offlineUsers.length}
                        </Text>
                      </View>
                    </View>
                    {offlineUsers.map(renderUserCard)}
                  </View>
                )}

                {/* Empty state if all sections are empty */}
                {onlineClients.length === 0 &&
                  onlineCoaches.length === 0 &&
                  offlineUsers.length === 0 && (
                    <View
                      style={{
                        paddingVertical: 24,
                        alignItems: 'center',
                      }}
                    >
                      <Text
                        style={{
                          color: textSecondaryColor,
                          fontSize: 13,
                          fontWeight: '500',
                        }}
                      >
                        No users found
                      </Text>
                    </View>
                  )}
              </ScrollView>
            </View>
          </MotiView>
        )}
      </AnimatePresence>

      <SectionList
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 76,
          paddingBottom: 130,
        }}
        sections={groupedCheckins}
        keyExtractor={(item, index) => item.checkin_id + index}
        onScroll={handleDashboardScroll}
        scrollEventThrottle={16}
        onTouchStart={() => {
          if (isPresenceDropdownOpen && !touchInsideDropdownRef.current) {
            setIsPresenceDropdownOpen(false);
          }
        }}
        onScrollBeginDrag={() => {
          if (isPresenceDropdownOpen) {
            setIsPresenceDropdownOpen(false);
          }
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              refreshBrand();
              loadDashboardData();
            }}
            tintColor={colors.primary}
            progressViewOffset={insets.top + 76}
          />
        }
        onEndReached={loadMoreCheckins}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          <View>
            {/* Greeting Section */}
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
              <Text
                style={{ color: colors.primary }}
                className="text-4xl font-black tracking-tight leading-[46px]"
              >
                {firstName || 'Coach'}
              </Text>
            </MotiView>

            {/* Main Cards Body Container (Wide px-3 layout matching Client Dashboard) */}
            <View className="px-3">
              {/* Needs Attention Hero Card (Modeled after CheckInCTACard) */}
              {slippingClients.length > 0 && (
                <SlippingClientsHeroCard
                  clients={slippingClients}
                  onMessageClient={(clientId) => {
                    router.push({
                      pathname: '/(coach)/chat/[id]',
                      params: { id: clientId },
                    });
                  }}
                />
              )}

              {/* Priority Action Hub (Check-ins to review & Unread messages) */}
              <View className="mb-4">
                <View className="flex-row gap-3">
                  {/* Check-ins pill */}
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => {
                      if (stats.pendingCheckIns > 0) {
                        router.push('/(coach)/(tabs)/clients');
                      } else {
                        setFeedFilter('all');
                      }
                    }}
                    className="flex-1 p-6 rounded-[32px] border flex-row items-center gap-4"
                    style={{
                      backgroundColor:
                        stats.pendingCheckIns > 0
                          ? `${colors.primary}12`
                          : cardBg,
                      borderColor:
                        stats.pendingCheckIns > 0
                          ? `${colors.primary}35`
                          : cardBorder,
                    }}
                  >
                    <View
                      className="w-12 h-12 rounded-2xl items-center justify-center border"
                      style={{
                        backgroundColor:
                          stats.pendingCheckIns > 0
                            ? `${colors.primary}25`
                            : isDark
                              ? 'rgba(255, 255, 255, 0.05)'
                              : '#F1F5F9',
                        borderColor:
                          stats.pendingCheckIns > 0
                            ? `${colors.primary}45`
                            : cardBorder,
                      }}
                    >
                      <ClipboardCheck
                        size={22}
                        color={
                          stats.pendingCheckIns > 0
                            ? colors.primary
                            : textSecondaryColor
                        }
                      />
                    </View>
                    <View className="flex-1 justify-center">
                      <Text
                        style={{
                          color: textColor,
                          fontSize: 28,
                          lineHeight: 32,
                        }}
                        className="font-black tracking-tight"
                      >
                        {stats.pendingCheckIns}
                      </Text>
                      <Text
                        style={{
                          color: textSecondaryColor,
                          lineHeight: 14,
                          marginTop: 2,
                        }}
                        className="text-xs font-bold uppercase tracking-wider"
                        numberOfLines={1}
                      >
                        To review
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* Messages pill */}
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => router.push('/(coach)/(tabs)/messages')}
                    className="flex-1 p-6 rounded-[32px] border flex-row items-center gap-4"
                    style={{
                      backgroundColor:
                        stats.unreadMessages > 0
                          ? `${colors.primary}12`
                          : cardBg,
                      borderColor:
                        stats.unreadMessages > 0
                          ? `${colors.primary}35`
                          : cardBorder,
                    }}
                  >
                    <View
                      className="w-12 h-12 rounded-2xl items-center justify-center border"
                      style={{
                        backgroundColor:
                          stats.unreadMessages > 0
                            ? `${colors.primary}25`
                            : isDark
                              ? 'rgba(255, 255, 255, 0.05)'
                              : '#F1F5F9',
                        borderColor:
                          stats.unreadMessages > 0
                            ? `${colors.primary}45`
                            : cardBorder,
                      }}
                    >
                      <MessageSquare
                        size={22}
                        color={
                          stats.unreadMessages > 0
                            ? colors.primary
                            : textSecondaryColor
                        }
                      />
                    </View>
                    <View className="flex-1 justify-center">
                      <Text
                        style={{
                          color: textColor,
                          fontSize: 28,
                          lineHeight: 32,
                        }}
                        className="font-black tracking-tight"
                      >
                        {stats.unreadMessages}
                      </Text>
                      <Text
                        style={{
                          color: textSecondaryColor,
                          lineHeight: 14,
                          marginTop: 2,
                        }}
                        className="text-xs font-bold uppercase tracking-wider"
                        numberOfLines={1}
                      >
                        Unread
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Upcoming Session Today (If scheduled) */}
              {upcomingSession && (
                <View className="mb-4">
                  <CoachUpcomingSessionCard
                    session={upcomingSession}
                    nowMs={nowMs}
                    onJoin={() => {
                      const link =
                        upcomingSession.meet_link ||
                        upcomingSession.meet_url ||
                        upcomingSession.external_meeting_url;
                      if (link) {
                        joinSession(link, upcomingSession.id, coach?.id);
                      } else {
                        router.push({
                          pathname: '/(coach)/chat/[id]',
                          params: { id: upcomingSession.client_id },
                        });
                      }
                    }}
                  />
                </View>
              )}

              {/* Client Meal Logs Slideshow / Reel (Only Unseen Meal Logs) */}
              {todayMeals.length > 0 && (
                <MealSlideshowCard
                  meals={todayMeals}
                  onPressMeal={(meal) => {
                    router.push({
                      pathname: '/meal-details/[id]',
                      params: {
                        id: String(meal.id),
                        clientId: meal.client_id ? String(meal.client_id) : '',
                        messageId: meal.message_id
                          ? String(meal.message_id)
                          : '',
                      },
                    });
                  }}
                />
              )}

              {/* Big & Clear Coach Analytics Card (Colored with brand primary color) */}
              <CoachAnalyticsCard />

              {/* Clients Performance (Big Visible Averages) */}
              <ClientsPerformanceCard pulse={teamPulse} />

              {/* Streak Champions Card */}
              <StreakChampionsStrip champions={streakChampions} />

              {/* 4 Core Metrics Grid (Total Clients, Active Now, Today's Calls, Challenges) */}
              <View className="mb-4">
                <View className="flex-row gap-3 mb-3">
                  {/* 1. Total Clients */}
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => router.push('/(coach)/(tabs)/clients')}
                    className="flex-1 rounded-[36px] p-6 border relative overflow-hidden"
                    style={cardStyle}
                  >
                    <View
                      style={{ backgroundColor: `${colors.primary}0D` }}
                      className="absolute -top-12 -right-12 w-32 h-32 rounded-full"
                    />
                    <View className="flex-row items-center justify-between mb-4">
                      <View
                        className="w-12 h-12 rounded-2xl items-center justify-center border"
                        style={{
                          backgroundColor: `${colors.primary}18`,
                          borderColor: `${colors.primary}35`,
                        }}
                      >
                        <Users size={22} color={colors.primary} />
                      </View>
                      <ArrowUpRight size={18} color={textSecondaryColor} />
                    </View>
                    <Text
                      style={{ color: textColor, fontSize: 32, lineHeight: 38 }}
                      className="font-black tracking-tight mb-1"
                    >
                      {stats.totalClients}
                    </Text>
                    <Text
                      style={{ color: textSecondaryColor }}
                      className="text-xs font-bold uppercase tracking-wider"
                    >
                      Total Clients
                    </Text>
                    <View className="flex-row items-center gap-1.5 mt-3">
                      <View
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: colors.primary }}
                      />
                      <Text
                        style={{ color: textSecondaryColor }}
                        className="text-xs font-semibold"
                      >
                        View All
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* 2. Daily Active (with live sparkline) */}
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => router.push('/(coach)/client-activity')}
                    className="flex-1 rounded-[36px] p-6 border overflow-hidden relative"
                    style={cardStyle}
                  >
                    <View
                      style={{ backgroundColor: `${colors.primary}0D` }}
                      className="absolute -top-12 -right-12 w-32 h-32 rounded-full"
                    />
                    <View className="flex-row items-center justify-between mb-4">
                      <View
                        className="w-12 h-12 rounded-2xl items-center justify-center border"
                        style={{
                          backgroundColor: `${colors.primary}18`,
                          borderColor: `${colors.primary}35`,
                        }}
                      >
                        <Activity size={22} color={colors.primary} />
                      </View>
                      <ArrowUpRight size={18} color={textSecondaryColor} />
                    </View>
                    <Text
                      style={{ color: textColor, fontSize: 32, lineHeight: 38 }}
                      className="font-black tracking-tight mb-1"
                    >
                      {displayActiveCount}
                    </Text>
                    <Text
                      style={{ color: textSecondaryColor }}
                      className="text-xs font-bold uppercase tracking-wider"
                    >
                      Daily Active
                    </Text>

                    <View className="h-7 mt-1.5 opacity-70">
                      <AnalyticsSparkline
                        data={analyticsData}
                        heroNumber={displayActiveCount}
                        label="Daily Active"
                        loading={loadingAnalytics}
                        dataKey="high_performers"
                      />
                    </View>

                    <View className="flex-row items-center gap-1.5 mt-2">
                      <View
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: colors.primary }}
                      />
                      <Text
                        style={{ color: colors.primary }}
                        className="text-xs font-bold"
                      >
                        {stats.compliantToday} logged today
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>

                <View className="flex-row gap-3">
                  {/* 3. Total Coaches */}
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => router.push('/(coach)/team')}
                    className="flex-1 rounded-[36px] p-6 border relative overflow-hidden"
                    style={cardStyle}
                  >
                    <View
                      style={{ backgroundColor: `${colors.primary}0D` }}
                      className="absolute -top-12 -right-12 w-32 h-32 rounded-full"
                    />
                    <View className="flex-row items-center justify-between mb-4">
                      <View
                        className="w-12 h-12 rounded-2xl items-center justify-center border"
                        style={{
                          backgroundColor: `${colors.primary}18`,
                          borderColor: `${colors.primary}35`,
                        }}
                      >
                        <Users size={22} color={colors.primary} />
                      </View>
                      <ArrowUpRight size={18} color={textSecondaryColor} />
                    </View>
                    <Text
                      style={{ color: textColor, fontSize: 32, lineHeight: 38 }}
                      className="font-black tracking-tight mb-1"
                    >
                      {stats.totalCoaches}
                    </Text>
                    <Text
                      style={{ color: textSecondaryColor }}
                      className="text-xs font-bold uppercase tracking-wider"
                    >
                      Total Coaches
                    </Text>
                    <View className="flex-row items-center gap-1.5 mt-3">
                      <View
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: colors.primary }}
                      />
                      <Text
                        style={{ color: textSecondaryColor }}
                        className="text-xs font-semibold"
                      >
                        Team management
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* 4. Active Challenges */}
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => router.push('/(coach)/challenges')}
                    className="flex-1 rounded-[36px] p-6 border relative overflow-hidden"
                    style={cardStyle}
                  >
                    <View
                      style={{ backgroundColor: `${colors.primary}0D` }}
                      className="absolute -top-12 -right-12 w-32 h-32 rounded-full"
                    />
                    <View className="flex-row items-center justify-between mb-4">
                      <View
                        className="w-12 h-12 rounded-2xl items-center justify-center border"
                        style={{
                          backgroundColor: `${colors.primary}18`,
                          borderColor: `${colors.primary}35`,
                        }}
                      >
                        <Trophy size={22} color={colors.primary} />
                      </View>
                      <ArrowUpRight size={18} color={textSecondaryColor} />
                    </View>
                    <Text
                      style={{ color: textColor, fontSize: 32, lineHeight: 38 }}
                      className="font-black tracking-tight mb-1"
                    >
                      {stats.activeChallenges}
                    </Text>
                    <Text
                      style={{ color: textSecondaryColor }}
                      className="text-xs font-bold uppercase tracking-wider"
                    >
                      Challenges
                    </Text>
                    <View className="flex-row items-center gap-1.5 mt-3">
                      <View
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: colors.primary }}
                      />
                      <Text
                        style={{ color: colors.primary }}
                        className="text-xs font-bold"
                      >
                        Client goals
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Quick Actions (All 4 preserved and redesigned) */}
              <View className="mb-4">
                <View className="flex-row justify-between items-center mb-3">
                  <Text
                    style={{ color: textColor }}
                    className="text-2xl font-black tracking-tight"
                  >
                    Quick Actions
                  </Text>
                  <TouchableOpacity
                    onPress={() => router.push('/(coach)/(tabs)/clients')}
                  >
                    <Text
                      style={{ color: colors.primary }}
                      className="font-bold text-xs uppercase tracking-wider"
                    >
                      View Team
                    </Text>
                  </TouchableOpacity>
                </View>

                <View className="flex-row flex-wrap gap-3">
                  <ActionCard
                    icon={<Trophy size={22} color={colors.primary} />}
                    title="Challenges"
                    desc="Client goals"
                    onPress={() => router.push('/(coach)/challenges')}
                    cardStyle={cardStyle}
                    textStyle={{ color: textColor }}
                    descColor={textSecondaryColor}
                    iconBg={`${colors.primary}18`}
                  />
                  <ActionCard
                    icon={<Zap size={22} color={colors.primary} />}
                    title="AI Scheduler"
                    desc="Plan sessions"
                    onPress={handleOpenAIScheduler}
                    cardStyle={cardStyle}
                    textStyle={{ color: textColor }}
                    descColor={textSecondaryColor}
                    iconBg={`${colors.primary}18`}
                  />
                  <ActionCard
                    icon={<Users size={22} color={colors.primary} />}
                    title="Team"
                    desc="Coaches & staff"
                    onPress={() => router.push('/(coach)/team')}
                    cardStyle={cardStyle}
                    textStyle={{ color: textColor }}
                    descColor={textSecondaryColor}
                    iconBg={`${colors.primary}18`}
                  />
                  <ActionCard
                    icon={<UserPlus size={22} color={colors.primary} />}
                    title="Invite Client"
                    desc="Send invite link"
                    onPress={() => router.push('/(coach)/invite-client')}
                    cardStyle={cardStyle}
                    textStyle={{ color: textColor }}
                    descColor={textSecondaryColor}
                    iconBg={`${colors.primary}18`}
                  />
                </View>
              </View>

              {/* Client Updates Header & Filters */}
              <View className="mb-3">
                <View className="flex-row justify-between items-center mb-2.5">
                  <Text
                    style={{ color: textColor }}
                    className="text-2xl font-black tracking-tight"
                  >
                    Client Updates
                  </Text>
                  <Text
                    style={{ color: textSecondaryColor }}
                    className="text-xs font-bold"
                  >
                    {filteredCheckins.length} recent
                  </Text>
                </View>

                {/* Filter Pills */}
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    onPress={() => setFeedFilter('all')}
                    className="px-4 py-2 rounded-full border"
                    style={{
                      backgroundColor:
                        feedFilter === 'all'
                          ? colors.primary
                          : isDark
                            ? 'rgba(255,255,255,0.05)'
                            : '#F1F5F9',
                      borderColor:
                        feedFilter === 'all' ? colors.primary : cardBorder,
                    }}
                  >
                    <Text
                      style={{
                        color:
                          feedFilter === 'all' ? 'white' : textSecondaryColor,
                      }}
                      className="text-xs font-bold"
                    >
                      All
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setFeedFilter('low_energy')}
                    className="px-4 py-2 rounded-full border"
                    style={{
                      backgroundColor:
                        feedFilter === 'low_energy'
                          ? colors.primary
                          : isDark
                            ? 'rgba(255,255,255,0.05)'
                            : '#F1F5F9',
                      borderColor:
                        feedFilter === 'low_energy'
                          ? colors.primary
                          : cardBorder,
                    }}
                  >
                    <Text
                      style={{
                        color:
                          feedFilter === 'low_energy'
                            ? 'white'
                            : textSecondaryColor,
                      }}
                      className="text-xs font-bold"
                    >
                      Low Energy
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setFeedFilter('good_mood')}
                    className="px-4 py-2 rounded-full border"
                    style={{
                      backgroundColor:
                        feedFilter === 'good_mood'
                          ? colors.primary
                          : isDark
                            ? 'rgba(255,255,255,0.05)'
                            : '#F1F5F9',
                      borderColor:
                        feedFilter === 'good_mood'
                          ? colors.primary
                          : cardBorder,
                    }}
                  >
                    <Text
                      style={{
                        color:
                          feedFilter === 'good_mood'
                            ? 'white'
                            : textSecondaryColor,
                      }}
                      className="text-xs font-bold"
                    >
                      Good Mood
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View className="px-3 py-4">
            <View
              className="p-8 rounded-[32px] border border-dashed items-center justify-center"
              style={{
                backgroundColor: isDark ? 'rgba(15, 23, 42, 0.4)' : '#F8FAFC',
                borderColor: cardBorder,
              }}
            >
              <View
                className="w-14 h-14 rounded-2xl items-center justify-center border mb-3"
                style={{
                  backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                  borderColor: cardBorder,
                }}
              >
                <TrendingUp size={24} color={textSecondaryColor} />
              </View>
              <Text
                style={{ color: textColor }}
                className="font-bold text-sm text-center"
              >
                {feedFilter === 'low_energy'
                  ? 'No low energy check-ins'
                  : feedFilter === 'good_mood'
                    ? 'No matching check-ins'
                    : 'No check-ins yet today'}
              </Text>
              <Text
                style={{ color: textSecondaryColor }}
                className="text-xs text-center mt-1 leading-5"
              >
                Recent client updates will show here automatically.
              </Text>
            </View>
          </View>
        }
        renderSectionHeader={({ section: { title } }) => (
          <View className="px-3 pt-2 pb-1.5">
            <Text
              style={{ color: textSecondaryColor }}
              className="font-black text-[10px] uppercase tracking-wider"
            >
              {title}
            </Text>
          </View>
        )}
        renderItem={({ item }) => (
          <View className="px-3 mb-3">
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() =>
                router.push(`/(coach)/clients/${item.client_id}?tab=checkins`)
              }
              className="rounded-[30px] p-5 flex-row items-center border"
              style={cardStyle}
            >
              <BrandedAvatar
                name={item.client_name}
                imageUrl={item.client_avatar}
                size={48}
              />
              <View className="flex-1 ml-4">
                <View className="flex-row items-center justify-between">
                  <Text
                    style={{ color: textColor }}
                    className="font-black text-base tracking-tight"
                  >
                    {item.client_name}
                  </Text>
                  <Text
                    style={{ color: textSecondaryColor }}
                    className="text-xs font-semibold"
                  >
                    {formatActivityDate(item.created_at)}
                  </Text>
                </View>

                <View className="flex-row items-center flex-wrap gap-2 mt-2.5">
                  {item.weight_kg != null && (
                    <View
                      className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-xl border"
                      style={{
                        backgroundColor: isDark
                          ? 'rgba(255,255,255,0.04)'
                          : '#F8FAFC',
                        borderColor: cardBorder,
                      }}
                    >
                      <TrendingUp size={12} color={textSecondaryColor} />
                      <Text
                        style={{ color: textColor }}
                        className="text-xs font-bold"
                      >
                        {item.weight_kg} kg
                      </Text>
                    </View>
                  )}

                  {item.energy_level != null && (
                    <View
                      className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-xl border"
                      style={{
                        backgroundColor:
                          item.energy_level <= 4
                            ? colors.primary + '15'
                            : item.energy_level >= 7
                              ? 'rgba(34, 197, 94, 0.12)'
                              : isDark
                                ? 'rgba(255,255,255,0.04)'
                                : '#F8FAFC',
                        borderColor:
                          item.energy_level <= 4
                            ? colors.primary + '30'
                            : item.energy_level >= 7
                              ? 'rgba(34, 197, 94, 0.25)'
                              : cardBorder,
                      }}
                    >
                      <Zap
                        size={12}
                        color={
                          item.energy_level <= 4
                            ? colors.primary
                            : item.energy_level >= 7
                              ? '#22C55E'
                              : textSecondaryColor
                        }
                      />
                      <Text
                        style={{
                          color:
                            item.energy_level <= 4
                              ? colors.primary
                              : item.energy_level >= 7
                                ? '#22C55E'
                                : textColor,
                        }}
                        className="text-xs font-bold"
                      >
                        Energy {item.energy_level}/10
                      </Text>
                    </View>
                  )}

                  {item.mood ? (
                    <View
                      className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-xl border"
                      style={{
                        backgroundColor: isDark
                          ? 'rgba(255,255,255,0.04)'
                          : '#F8FAFC',
                        borderColor: cardBorder,
                      }}
                    >
                      <Smile size={12} color={textSecondaryColor} />
                      <Text
                        style={{ color: textColor }}
                        className="text-xs font-bold"
                        numberOfLines={1}
                      >
                        {item.mood}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
              <ChevronRight
                size={16}
                color={textSecondaryColor}
                style={{ marginLeft: 8 }}
              />
            </TouchableOpacity>
          </View>
        )}
        ListFooterComponent={
          <View>
            {loadingMore ? (
              <View className="py-4 items-center justify-center">
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : null}

            {/* Brand Footer */}
            <View className="items-center pt-8 pb-4">
              <View
                style={{ backgroundColor: cardBg, borderColor: cardBorder }}
                className="flex-row items-center gap-2 px-4 py-2 rounded-full border"
              >
                {brand?.logo_url ? (
                  <Image
                    source={{ uri: brand.logo_url }}
                    style={{ width: 16, height: 16, borderRadius: 4 }}
                    contentFit="cover"
                  />
                ) : null}
                <Text
                  style={{ color: textSecondaryColor }}
                  className="text-xs font-semibold"
                >
                  Powered by {brand?.name || 'RawWeb'}
                </Text>
              </View>
            </View>
          </View>
        }
      />

      {/* Client Picker Modal */}
      <Modal
        visible={showClientPicker}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <View
            style={{ borderColor: cardBorder }}
            className="px-6 pt-6 pb-4 flex-row justify-between items-center border-b"
          >
            <View>
              <Text style={{ color: textColor }} className="text-xl font-bold">
                Select Client
              </Text>
              <Text
                style={{ color: textSecondaryColor }}
                className="text-xs uppercase tracking-wider font-bold"
              >
                AI Scheduler
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowClientPicker(false)}
              style={{ backgroundColor: cardBg }}
              className="p-2 rounded-full border border-white/5"
            >
              <X size={20} color={textSecondaryColor} />
            </TouchableOpacity>
          </View>

          <View className="px-6 py-4">
            <View
              style={{
                backgroundColor: cardBg,
                borderColor: cardBorder,
              }}
              className="border rounded-2xl px-4 py-3 flex-row items-center"
            >
              <Search size={18} color={textSecondaryColor} />
              <TextInput
                style={{ color: textColor }}
                className="flex-1 ml-3 font-bold"
                placeholder="Search clients..."
                placeholderTextColor={textSecondaryColor}
                value={clientSearch}
                onChangeText={setClientSearch}
              />
            </View>
          </View>

          {loadingClients ? (
            <View className="flex-1 justify-center items-center">
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <ScrollView className="flex-1 px-6 pt-2">
              {clients
                .filter((c) =>
                  c.name.toLowerCase().includes(clientSearch.toLowerCase()),
                )
                .map((client) => (
                  <TouchableOpacity
                    key={client.id}
                    onPress={() => startAIScheduler(client)}
                    style={cardStyle}
                    className="p-4 rounded-[26px] border mb-3 flex-row items-center"
                  >
                    <BrandedAvatar
                      name={client.name}
                      imageUrl={client.avatar}
                      size={44}
                    />
                    <View className="ml-4 flex-1">
                      <Text
                        style={{ color: textColor }}
                        className="font-bold text-base"
                      >
                        {client.name}
                      </Text>
                      <Text
                        style={{ color: textSecondaryColor }}
                        className="text-[10px] font-bold uppercase tracking-wider mt-0.5"
                      >
                        Active Client
                      </Text>
                    </View>
                    <View
                      style={{
                        backgroundColor: colors.primary + '15',
                        borderColor: colors.primary + '30',
                      }}
                      className="w-9 h-9 rounded-full items-center justify-center border"
                    >
                      <ChevronRight size={16} color={colors.primary} />
                    </View>
                  </TouchableOpacity>
                ))}
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* AI Scheduler Modal */}
      {selectedClientForAI && (
        <SchedulerModal
          visible={showAIScheduler}
          onClose={() => {
            setShowAIScheduler(false);
            setSelectedClientForAI(null);
          }}
          onConfirm={async (sessions) => {
            try {
              const { error } = await supabase.from('sessions').insert(
                sessions.map((s) => ({
                  coach_id: coach?.id,
                  client_id: selectedClientForAI.id,
                  scheduled_at: s.scheduled_at,
                  duration_minutes: s.duration_minutes,
                  session_type: s.session_type,
                  status: 'scheduled',
                })),
              );
              if (error) throw error;
              loadDashboardData();
            } catch (e) {
              console.error(e);
              throw e;
            }
          }}
          clientContext={{
            name: selectedClientForAI.name,
            timezone: selectedClientForAI.timezone,
            avatar_url: selectedClientForAI.avatar,
          }}
          targetClientId={selectedClientForAI.id}
          existingSessions={allSessions}
        />
      )}

      {/* Feedback Modal after Plan Sent */}
      <FeedbackModal
        visible={showPlanSentModal}
        onClose={() => setShowPlanSentModal(false)}
        variant="success"
        icon={
          <View style={{ position: 'relative' }}>
            <BrandedAvatar
              name={planSentClientName || 'Client'}
              imageUrl={planSentClientAvatar || null}
              size={80}
            />
            <View className="absolute -bottom-1 -right-1 w-7 h-7 bg-[#10B981] rounded-full border-[3px] border-[#0F172A] items-center justify-center">
              <Check size={14} color="white" strokeWidth={4} />
            </View>
          </View>
        }
        title="Plan Sent!"
        body={`Weekly plan sent to ${planSentClientName || 'your client'}.`}
        ctaLabel="Done"
      />
    </View>
  );
}

// ─── Hero Slipping Clients Card (Modeled after CheckInCTACard) ──────────────
const SlippingClientsHeroCard = ({
  clients,
  onMessageClient,
}: {
  clients: any[];
  onMessageClient: (clientId: string) => void;
}) => {
  const colors = useBrandColors();
  const primaryIsDark = isDarkColor(colors.primary);
  const primaryTextColor = primaryIsDark ? '#FFFFFF' : '#0F172A';
  const primaryTextMuted = primaryIsDark
    ? 'rgba(255, 255, 255, 0.85)'
    : 'rgba(15, 23, 42, 0.85)';
  const btnBg = primaryIsDark ? '#FFFFFF' : '#0F172A';
  const btnText = primaryIsDark ? colors.primary : '#FFFFFF';

  const [activeIndex, setActiveIndex] = useState(0);
  const [containerWidth, setContainerWidth] = useState(
    Dimensions.get('window').width - 24,
  );
  const scrollRef = useRef<any>(null);

  if (!clients || clients.length === 0) return null;

  const count = clients.length;

  return (
    <MotiView
      key="slipping-hero"
      from={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0) setContainerWidth(w);
      }}
      className="mb-4"
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={containerWidth}
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScroll={(e) => {
          if (containerWidth > 0) {
            const idx = Math.round(
              e.nativeEvent.contentOffset.x / containerWidth,
            );
            if (idx !== activeIndex && idx >= 0 && idx < count) {
              setActiveIndex(idx);
            }
          }
        }}
        onMomentumScrollEnd={(e) => {
          if (containerWidth > 0) {
            const idx = Math.round(
              e.nativeEvent.contentOffset.x / containerWidth,
            );
            setActiveIndex(idx);
          }
        }}
      >
        {clients.map((client, index) => (
          <View
            key={client.client_id || index}
            style={{
              width: containerWidth,
              borderRadius: 40,
              overflow: 'hidden',
              backgroundColor: colors.primary,
            }}
            className="border border-white/10 relative"
          >
            {/* Decorative ambient glow circles */}
            <View className="absolute -top-24 -right-12 w-64 h-64 bg-white/10 rounded-full" />
            <View className="absolute -bottom-24 -left-12 w-48 h-48 bg-black/10 rounded-full" />

            <View className="p-8 relative z-10">
              {/* Header row */}
              <View className="flex-row items-center justify-between mb-3">
                <View className="flex-row items-center gap-2">
                  <Zap size={14} color={primaryTextColor} />
                  <Text
                    style={{ color: primaryTextMuted }}
                    className="text-[10px] font-black uppercase tracking-[3px]"
                  >
                    Needs Attention
                  </Text>
                </View>

                {count > 1 && (
                  <View className="flex-row items-center gap-1.5">
                    {index > 0 && (
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => {
                          const prev = Math.max(0, index - 1);
                          scrollRef.current?.scrollTo({
                            x: prev * containerWidth,
                            animated: true,
                          });
                          setActiveIndex(prev);
                        }}
                        className="w-7 h-7 rounded-full bg-black/25 items-center justify-center"
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <ChevronLeft size={16} color={primaryTextColor} />
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => {
                        const next = (index + 1) % count;
                        scrollRef.current?.scrollTo({
                          x: next * containerWidth,
                          animated: true,
                        });
                        setActiveIndex(next);
                      }}
                      className="flex-row items-center gap-1 bg-black/25 px-2.5 py-1 rounded-full"
                    >
                      <Text
                        style={{ color: primaryTextColor }}
                        className="text-[11px] font-black uppercase tracking-wider"
                      >
                        See others who missed ({index + 1}/{count})
                      </Text>
                      <ChevronRight size={13} color={primaryTextColor} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Title & Description */}
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => onMessageClient(client.client_id)}
              >
                <Text
                  style={{ color: primaryTextColor }}
                  className="text-3xl font-black tracking-tight leading-8"
                >
                  {client.client_name} Missed Check-in
                </Text>

                <Text
                  style={{ color: primaryTextMuted }}
                  className="mt-3 font-medium text-sm leading-6"
                >
                  {client.daysSinceCheckin
                    ? `No check-in logged for ${client.daysSinceCheckin} days. Send a quick nudge to keep them on track.`
                    : 'No check-in recorded yet. Reach out to maintain daily momentum.'}
                </Text>
              </TouchableOpacity>

              {/* Client Row & Action Button */}
              <View className="mt-8 flex-row items-center justify-between">
                <View className="flex-row items-center gap-3">
                  <BrandedAvatar
                    name={client.client_name}
                    imageUrl={client.client_avatar}
                    size={42}
                  />
                  <View>
                    <Text
                      style={{ color: primaryTextColor }}
                      className="text-sm font-black"
                      numberOfLines={1}
                    >
                      {client.client_name}
                    </Text>
                    {count > 1 && (
                      <Text
                        style={{ color: primaryTextMuted }}
                        className="text-xs font-bold"
                      >
                        Swipe to see all {count}
                      </Text>
                    )}
                  </View>
                </View>

                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => onMessageClient(client.client_id)}
                  className="flex-row items-center gap-2.5"
                >
                  <View
                    style={{ backgroundColor: btnBg }}
                    className="px-5 py-2.5 rounded-full flex-row items-center gap-1.5"
                  >
                    <MessageSquare
                      size={13}
                      color={btnText}
                      strokeWidth={2.5}
                    />
                    <Text
                      style={{ color: btnText }}
                      className="font-black text-xs uppercase tracking-widest"
                    >
                      Message
                    </Text>
                  </View>
                  <ChevronRight
                    size={24}
                    color={primaryTextColor}
                    opacity={0.6}
                  />
                </TouchableOpacity>
              </View>

              {/* Pagination Dots */}
              {count > 1 && (
                <View className="flex-row items-center justify-center gap-1.5 mt-5">
                  {clients.map((_, dotIdx) => (
                    <TouchableOpacity
                      key={dotIdx}
                      onPress={() => {
                        scrollRef.current?.scrollTo({
                          x: dotIdx * containerWidth,
                          animated: true,
                        });
                        setActiveIndex(dotIdx);
                      }}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <View
                        style={{
                          backgroundColor:
                            dotIdx === activeIndex
                              ? primaryTextColor
                              : 'rgba(255, 255, 255, 0.3)',
                          width: dotIdx === activeIndex ? 18 : 6,
                          height: 6,
                          borderRadius: 3,
                        }}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </View>
        ))}
      </ScrollView>
    </MotiView>
  );
};

// ─── Big & Clear Coach Analytics Card (Brand Secondary Color) ───────────────
const CoachAnalyticsCard = () => {
  const colors = useBrandColors();
  const router = useRouter();
  const { isDarkMode } = useTheme();
  const isDark = isDarkMode || isDarkColor(colors.background || '#010417');

  const primaryColor = colors.primary || '#3B82F6';
  const isPrimaryDark = isDarkColor(primaryColor);
  const textColor = colors.text || (isDark ? '#FFFFFF' : '#0F172A');
  const textSecondaryColor =
    colors.textSecondary || (isDark ? '#94A3B8' : '#64748B');

  return (
    <View className="mb-4">
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() => router.push('/(coach)/client-analytics')}
        className="rounded-[36px] p-6 border relative overflow-hidden"
        style={{
          backgroundColor: isDark ? `${primaryColor}15` : `${primaryColor}10`,
          borderColor: `${primaryColor}40`,
        }}
      >
        {/* Glow ambient background circles */}
        <View
          style={{ backgroundColor: `${primaryColor}25` }}
          className="absolute -top-16 -right-16 w-56 h-56 rounded-full"
        />
        <View
          style={{ backgroundColor: `${primaryColor}15` }}
          className="absolute -bottom-12 -left-12 w-44 h-44 rounded-full"
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
                color={
                  colors.textOnPrimary ||
                  (isPrimaryDark ? '#FFFFFF' : '#0F172A')
                }
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
          Check client calories, macros, sleep, and daily habits with
          interactive charts.
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
  );
};

// ─── Clients Performance Card (Big Numbers & Averages) ──────────────────────
const ClientsPerformanceCard = ({
  pulse,
}: {
  pulse: {
    avgSleep: number | null;
    avgEnergy: number | null;
    habitRate: number | null;
    totalLogged: number;
  };
}) => {
  const colors = useBrandColors();
  const { isDarkMode } = useTheme();
  const isDark = isDarkMode || isDarkColor(colors.background || '#010417');
  const textColor = colors.text || (isDark ? '#FFFFFF' : '#0F172A');
  const textSecondaryColor =
    colors.textSecondary || (isDark ? '#94A3B8' : '#64748B');
  const cardBg = isDark ? 'rgba(15, 23, 42, 0.65)' : colors.surface;
  const cardBorder = isDark
    ? 'rgba(255, 255, 255, 0.08)'
    : colors.border || '#E2E8F0';

  return (
    <View className="mb-4">
      <View
        className="p-7 rounded-[40px] border relative overflow-hidden"
        style={{
          backgroundColor: cardBg,
          borderColor: cardBorder,
        }}
      >
        <View
          style={{ backgroundColor: `${colors.primary}10` }}
          className="absolute -top-16 -right-16 w-56 h-56 rounded-full"
        />

        <View className="flex-row items-center justify-between mb-5">
          <View className="flex-row items-center gap-3">
            <View
              className="w-12 h-12 rounded-2xl items-center justify-center border"
              style={{
                backgroundColor: `${colors.primary}18`,
                borderColor: `${colors.primary}35`,
              }}
            >
              <Activity size={22} color={colors.primary} />
            </View>
            <View>
              <Text
                style={{ color: textColor }}
                className="text-xl font-black tracking-tight"
              >
                Clients Performance
              </Text>
              <Text
                style={{ color: colors.primary }}
                className="text-xs font-black uppercase tracking-wider mt-0.5"
              >
                Today's Overview
              </Text>
            </View>
          </View>
          <View
            className="px-3 py-1 rounded-full border"
            style={{
              backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9',
              borderColor: cardBorder,
            }}
          >
            <Text
              style={{ color: textSecondaryColor }}
              className="text-xs font-bold"
            >
              Today
            </Text>
          </View>
        </View>

        {/* Big Visible Stat Tiles with Bold Numbers */}
        <View className="flex-row gap-3">
          {/* Average Sleep */}
          <View
            className="flex-1 p-4 rounded-3xl border items-center"
            style={{
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F8FAFC',
              borderColor: cardBorder,
            }}
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
              className="text-3xl font-black tracking-tight"
            >
              {pulse.avgSleep != null ? `${pulse.avgSleep}h` : '—'}
            </Text>
          </View>

          {/* Average Energy */}
          <View
            className="flex-1 p-4 rounded-3xl border items-center"
            style={{
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F8FAFC',
              borderColor: cardBorder,
            }}
          >
            <View className="flex-row items-center gap-1.5 mb-1.5">
              <Zap size={14} color={colors.primary} />
              <Text
                style={{ color: textSecondaryColor }}
                className="text-[10px] font-black uppercase tracking-wider"
              >
                Energy
              </Text>
            </View>
            <Text
              style={{ color: textColor }}
              className="text-3xl font-black tracking-tight"
            >
              {pulse.avgEnergy != null ? `${pulse.avgEnergy}/10` : '—'}
            </Text>
          </View>

          {/* Habit Completion */}
          <View
            className="flex-1 p-4 rounded-3xl border items-center"
            style={{
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F8FAFC',
              borderColor: cardBorder,
            }}
          >
            <View className="flex-row items-center gap-1.5 mb-1.5">
              <CheckCircle2 size={14} color={colors.primary} />
              <Text
                style={{ color: textSecondaryColor }}
                className="text-[10px] font-black uppercase tracking-wider"
              >
                Habits
              </Text>
            </View>
            <Text
              style={{ color: textColor }}
              className="text-3xl font-black tracking-tight"
            >
              {pulse.habitRate != null ? `${pulse.habitRate}%` : '—'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

// ─── Client Meal Logs Slideshow Card (Huge Photos & Deep Link) ──────────────────
const MealSlideshowCard = ({
  meals,
  onPressMeal,
}: {
  meals: any[];
  onPressMeal: (meal: any) => void;
}) => {
  const colors = useBrandColors();
  const { isDarkMode } = useTheme();
  const isDark = isDarkMode || isDarkColor(colors.background || '#010417');
  const textColor = colors.text || (isDark ? '#FFFFFF' : '#0F172A');
  const textSecondaryColor =
    colors.textSecondary || (isDark ? '#94A3B8' : '#64748B');
  const cardBorder = isDark
    ? 'rgba(255, 255, 255, 0.08)'
    : colors.border || '#E2E8F0';
  const [activeIndex, setActiveIndex] = useState(0);

  if (!meals || meals.length === 0) return null;

  return (
    <View className="mb-4">
      <View className="flex-row justify-between items-center mb-3">
        <View className="flex-row items-center gap-2">
          <View
            className="w-8 h-8 rounded-xl items-center justify-center border"
            style={{
              backgroundColor: colors.primary + '15',
              borderColor: colors.primary + '30',
            }}
          >
            <Utensils size={16} color={colors.primary} />
          </View>
          <Text
            style={{ color: textColor }}
            className="text-2xl font-black tracking-tight"
          >
            Meal Logs
          </Text>
        </View>
        <Text
          style={{ color: textSecondaryColor }}
          className="text-xs font-bold"
        >
          {meals.length} new
        </Text>
      </View>

      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={MEAL_CARD_WIDTH + 12}
        snapToAlignment="start"
        onScroll={(e) => {
          const x = e.nativeEvent.contentOffset.x;
          const idx = Math.round(x / (MEAL_CARD_WIDTH + 12));
          setActiveIndex(idx);
        }}
        scrollEventThrottle={16}
        contentContainerStyle={{ gap: 12 }}
      >
        {meals.map((meal) => {
          const timeStr = meal.created_at
            ? formatActivityDate(meal.created_at)
            : '';
          const mealTypeLabel = meal.meal_type
            ? meal.meal_type.charAt(0).toUpperCase() + meal.meal_type.slice(1)
            : 'Meal';
          const displayTitle = meal.meal_name || meal.name || mealTypeLabel;

          return (
            <TouchableOpacity
              key={meal.id}
              activeOpacity={0.9}
              onPress={() => onPressMeal(meal)}
              className="overflow-hidden rounded-[36px] border relative"
              style={{
                width: MEAL_CARD_WIDTH,
                height: 236,
                borderColor: cardBorder,
                backgroundColor: isDark ? '#0F172A' : '#F1F5F9',
              }}
            >
              <Image
                source={{ uri: meal.photo_url }}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
              />

              {/* Gradient Overlay for legibility */}
              <LinearGradient
                colors={[
                  'rgba(0,0,0,0.55)',
                  'rgba(0,0,0,0.1)',
                  'rgba(0,0,0,0.92)',
                ]}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                }}
              />

              {/* Top Bar: Client Profile & Name + Log Time */}
              <View className="absolute top-4 left-4 right-4 flex-row items-center justify-between">
                <View className="flex-row items-center gap-2.5 bg-black/55 px-3 py-1.5 rounded-full border border-white/15">
                  <BrandedAvatar
                    name={meal.client_name}
                    imageUrl={meal.client_avatar}
                    size={26}
                  />
                  <Text
                    className="text-white font-bold text-xs"
                    numberOfLines={1}
                  >
                    {meal.client_name}
                  </Text>
                </View>

                <View className="bg-black/55 px-3 py-1.5 rounded-full border border-white/15">
                  <Text className="text-white/90 font-bold text-xs">
                    {timeStr || mealTypeLabel}
                  </Text>
                </View>
              </View>

              {/* Bottom Content: Meal Name, Brief Detail & Macros */}
              <View className="absolute bottom-4 left-4 right-4 flex-row items-end justify-between">
                <View className="flex-1 mr-3">
                  <Text
                    className="text-white font-black text-xl tracking-tight leading-6"
                    numberOfLines={1}
                  >
                    {displayTitle}
                  </Text>
                  {meal.description ? (
                    <Text
                      className="text-white/80 font-medium text-xs mt-0.5"
                      numberOfLines={1}
                    >
                      {meal.description}
                    </Text>
                  ) : null}
                  <View className="flex-row items-center gap-2 mt-2">
                    {meal.calories != null && (
                      <View className="bg-white/20 px-3 py-1 rounded-full">
                        <Text className="text-white font-bold text-xs">
                          {Math.round(Number(meal.calories))} kcal
                        </Text>
                      </View>
                    )}
                    {meal.protein_g != null && (
                      <View className="bg-emerald-500/30 border border-emerald-400/30 px-3 py-1 rounded-full">
                        <Text className="text-emerald-300 font-bold text-xs">
                          {Math.round(Number(meal.protein_g))}g protein
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                <View className="bg-white/20 border border-white/25 px-3.5 py-2 rounded-full flex-row items-center gap-1.5">
                  <Text className="text-white font-bold text-xs">View</Text>
                  <ChevronRight size={14} color="white" />
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Pagination Dots */}
      {meals.length > 1 && (
        <View className="flex-row justify-center items-center gap-1.5 mt-3">
          {meals.map((_, i) => (
            <View
              key={i}
              className="rounded-full"
              style={{
                width: i === activeIndex ? 18 : 6,
                height: 6,
                backgroundColor:
                  i === activeIndex
                    ? colors.primary
                    : isDark
                      ? 'rgba(255, 255, 255, 0.2)'
                      : 'rgba(0, 0, 0, 0.15)',
              }}
            />
          ))}
        </View>
      )}
    </View>
  );
};

// ─── Streak Champions Card ───────────────────────────────────────────────────
const StreakChampionsStrip = ({ champions }: { champions: any[] }) => {
  const colors = useBrandColors();
  const { isDarkMode } = useTheme();
  const router = useRouter();
  const isDark = isDarkMode || isDarkColor(colors.background || '#010417');
  const textColor = colors.text || (isDark ? '#FFFFFF' : '#0F172A');
  const textSecondaryColor =
    colors.textSecondary || (isDark ? '#94A3B8' : '#64748B');
  const cardBg = isDark ? 'rgba(15, 23, 42, 0.65)' : colors.surface;
  const cardBorder = isDark
    ? 'rgba(255, 255, 255, 0.08)'
    : colors.border || '#E2E8F0';

  const hasChampions = champions && champions.length > 0;

  return (
    <View className="mb-4">
      <View
        className="p-7 rounded-[40px] border relative overflow-hidden"
        style={{
          backgroundColor: cardBg,
          borderColor: cardBorder,
        }}
      >
        {/* Glow ambient background circle */}
        <View
          style={{ backgroundColor: `${colors.primary}12` }}
          className="absolute -top-16 -right-16 w-56 h-56 rounded-full pointer-events-none"
        />

        {/* Top Header Row */}
        <View className="flex-row items-center justify-between mb-5">
          <View className="flex-row items-center gap-3">
            <View
              className="w-12 h-12 rounded-2xl items-center justify-center border overflow-hidden"
              style={{
                backgroundColor: hasChampions
                  ? `${colors.primary}18`
                  : isDark
                    ? 'rgba(255,255,255,0.04)'
                    : '#F1F5F9',
                borderColor: hasChampions ? `${colors.primary}35` : cardBorder,
              }}
            >
              <StreakFire
                variant={hasChampions ? 'active' : 'zero'}
                size={34}
              />
            </View>
            <View>
              <Text
                style={{ color: textColor }}
                className="text-xl font-black tracking-tight"
              >
                Active Streaks
              </Text>
              <Text
                style={{ color: colors.primary }}
                className="text-xs font-black uppercase tracking-wider mt-0.5"
              >
                Consistency Leaders
              </Text>
            </View>
          </View>

          <View
            className="px-3 py-1 rounded-full border"
            style={{
              backgroundColor: hasChampions
                ? `${colors.primary}15`
                : isDark
                  ? 'rgba(255,255,255,0.05)'
                  : '#F1F5F9',
              borderColor: hasChampions ? `${colors.primary}30` : cardBorder,
            }}
          >
            <Text
              style={{
                color: hasChampions ? colors.primary : textSecondaryColor,
              }}
              className="text-xs font-black uppercase tracking-wider"
            >
              {hasChampions
                ? `${champions.length} ${champions.length === 1 ? 'Leader' : 'Leaders'}`
                : '0 Active'}
            </Text>
          </View>
        </View>

        {/* Card Body */}
        {hasChampions ? (
          <View className="space-y-2.5">
            {champions.slice(0, 5).map((c, index) => (
              <TouchableOpacity
                key={c.client_id}
                activeOpacity={0.75}
                onPress={() => {
                  router.push({
                    pathname: '/(coach)/chat/[id]',
                    params: { id: c.client_id },
                  });
                }}
                className="p-4 rounded-[24px] border flex-row items-center justify-between"
                style={{
                  backgroundColor: isDark
                    ? 'rgba(255, 255, 255, 0.04)'
                    : '#F8FAFC',
                  borderColor: cardBorder,
                }}
              >
                <View className="flex-row items-center gap-3.5 flex-1 pr-2">
                  <View className="relative">
                    <BrandedAvatar
                      name={c.client_name}
                      imageUrl={c.client_avatar}
                      size={42}
                    />
                    {index === 0 && (
                      <View
                        className="absolute -top-1 -right-1 w-5 h-5 rounded-full items-center justify-center border"
                        style={{
                          backgroundColor: colors.primary,
                          borderColor: cardBg,
                        }}
                      >
                        <Text className="text-[10px] font-black text-white">
                          1
                        </Text>
                      </View>
                    )}
                  </View>
                  <View className="flex-1">
                    <Text
                      style={{ color: textColor }}
                      className="text-base font-black tracking-tight"
                      numberOfLines={1}
                    >
                      {c.client_name}
                    </Text>
                    <Text
                      style={{ color: textSecondaryColor }}
                      className="text-xs font-semibold mt-0.5"
                      numberOfLines={1}
                    >
                      {c.isCold
                        ? 'At risk — 1 day left to log'
                        : 'Daily goals on track'}
                    </Text>
                  </View>
                </View>

                {/* Streak Number Pill */}
                <View
                  className="flex-row items-center gap-1.5 px-3.5 py-2 rounded-2xl border"
                  style={{
                    backgroundColor: c.isCold
                      ? 'rgba(234, 179, 8, 0.15)'
                      : `${colors.primary}18`,
                    borderColor: c.isCold
                      ? 'rgba(234, 179, 8, 0.35)'
                      : `${colors.primary}40`,
                  }}
                >
                  <StreakFire
                    variant={c.isCold ? 'cold' : 'active'}
                    size={16}
                  />
                  <Text
                    style={{ color: c.isCold ? '#EAB308' : colors.primary }}
                    className="text-xs font-black"
                  >
                    {c.streak} {c.streak === 1 ? 'Day' : 'Days'}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View
            className="p-6 rounded-[28px] border border-dashed items-center justify-center"
            style={{
              backgroundColor: isDark
                ? 'rgba(255,255,255,0.02)'
                : 'rgba(0,0,0,0.01)',
              borderColor: cardBorder,
            }}
          >
            <View
              className="w-14 h-14 rounded-2xl items-center justify-center border mb-3 overflow-hidden"
              style={{
                backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F1F5F9',
                borderColor: cardBorder,
              }}
            >
              <StreakFire variant="zero" size={38} />
            </View>
            <Text
              style={{ color: textColor }}
              className="text-sm font-black text-center"
            >
              No Active Streaks Today
            </Text>
            <Text
              style={{ color: textSecondaryColor }}
              className="text-xs font-medium text-center mt-1 leading-5 px-4"
            >
              Keep clients motivated with daily check-ins to build their
              consistency streaks.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

// ─── Coach Upcoming Session Card ─────────────────────────────────────────────
const CoachUpcomingSessionCard = ({
  session,
  nowMs,
  onJoin,
}: {
  session: any;
  nowMs: number;
  onJoin: () => void;
}) => {
  const colors = useBrandColors();
  const { isDarkMode } = useTheme();
  const isDark = isDarkMode || isDarkColor(colors.background || '#010417');
  const textColor = colors.text || (isDark ? '#FFFFFF' : '#0F172A');
  const textSecondaryColor =
    colors.textSecondary || (isDark ? '#94A3B8' : '#64748B');
  const cardBg = isDark ? 'rgba(15, 23, 42, 0.7)' : colors.surface;
  const cardBorder = isDark
    ? 'rgba(255, 255, 255, 0.08)'
    : colors.border || '#E2E8F0';

  const sessionTime = new Date(session.scheduled_at).getTime();
  const minutesUntil = (sessionTime - nowMs) / 60_000;
  const canJoin = minutesUntil <= 10;
  const clientName = session.client?.profiles?.full_name || 'Client';
  const clientAvatar = session.client?.profiles?.avatar_url;

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
      className="overflow-hidden rounded-[32px] border"
      style={{
        backgroundColor: canJoin ? `${colors.primary}12` : cardBg,
        borderColor: canJoin ? `${colors.primary}50` : cardBorder,
      }}
    >
      <View className="p-6">
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center gap-2">
            <View
              className="w-8 h-8 rounded-xl items-center justify-center border"
              style={{
                backgroundColor: `${colors.primary}18`,
                borderColor: `${colors.primary}35`,
              }}
            >
              <Video size={16} color={colors.primary} />
            </View>
            <Text
              style={{ color: colors.primary }}
              className="text-xs font-black uppercase tracking-wider"
            >
              Upcoming Call
            </Text>
          </View>
          <View
            className="px-3 py-1 rounded-full border"
            style={{
              backgroundColor: canJoin
                ? '#22C55E20'
                : isDark
                  ? 'rgba(255, 255, 255, 0.05)'
                  : '#F1F5F9',
              borderColor: canJoin ? '#22C55E50' : cardBorder,
            }}
          >
            <Text
              style={{ color: canJoin ? '#22C55E' : textSecondaryColor }}
              className="text-xs font-black uppercase tracking-wider"
            >
              {countdownLabel()}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3.5 flex-1 mr-3">
            <BrandedAvatar
              name={clientName}
              imageUrl={clientAvatar}
              size={46}
            />
            <View className="flex-1">
              <Text
                style={{ color: textColor }}
                className="font-black text-base tracking-tight"
                numberOfLines={1}
              >
                {clientName}
              </Text>
              <Text
                style={{ color: textSecondaryColor }}
                className="text-xs font-semibold mt-0.5"
              >
                {formatTime(session.scheduled_at)} ·{' '}
                {session.duration_minutes || 30} min
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={onJoin}
            activeOpacity={0.8}
            className="px-4 py-2.5 rounded-full flex-row items-center gap-1.5"
            style={{
              backgroundColor: colors.primary,
            }}
          >
            <Video size={15} color="white" />
            <Text className="text-white font-black text-xs uppercase tracking-wider">
              {canJoin ? 'Join Call' : 'Details'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </MotiView>
  );
};

// ─── Action Card ─────────────────────────────────────────────────────────────
const ActionCard = ({
  icon,
  title,
  desc,
  onPress,
  cardStyle,
  textStyle,
  descColor,
  iconBg,
}: any) => (
  <TouchableOpacity
    activeOpacity={0.8}
    onPress={onPress}
    className="p-6 rounded-[34px] w-[48%] border items-center justify-center gap-3"
    style={cardStyle}
  >
    <View
      className="w-14 h-14 rounded-[22px] items-center justify-center border"
      style={{
        backgroundColor: iconBg || '#F8FAFC',
        borderColor: cardStyle?.borderColor,
      }}
    >
      {icon}
    </View>
    <View className="items-center">
      <Text
        style={textStyle}
        className="font-black text-base tracking-tight mb-0.5 text-center"
      >
        {title}
      </Text>
      <Text
        style={{ color: descColor }}
        className="text-[10px] font-black uppercase tracking-widest text-center"
      >
        {desc}
      </Text>
    </View>
  </TouchableOpacity>
);
