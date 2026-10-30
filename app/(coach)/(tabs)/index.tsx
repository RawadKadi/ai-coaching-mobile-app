import { useBrand, useBrandColors, useTheme } from '@/contexts/BrandContext';
import { isDarkColor } from '@/lib/theme-utils';
import React, { useState, useEffect, useMemo } from 'react';
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
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from '@/components/BrandedText';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MotiView } from 'moti';
import { useAuth } from '@/contexts/AuthContext';
import { useUnread } from '@/contexts/UnreadContext';
import { supabase } from '@/lib/supabase';
import {
  Users,
  MessageSquare,
  ClipboardCheck,
  Trophy,
  UserPlus,
  ChevronRight,
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
} from 'lucide-react-native';
import { BrandedAvatar } from '@/components/BrandedAvatar';
import FeedbackModal from '@/components/FeedbackModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePresence } from '@/contexts/PresenceContext';
import SchedulerModal from '@/components/SchedulerModal';
import { AnalyticsSparkline } from '@/components/AnalyticsSparkline';
import { AnalyticsDetailedModal } from '@/components/AnalyticsDetailedModal';
import { useTabBarScroll } from '@/contexts/TabBarScrollContext';
import { useGreeting } from '@/hooks/useGreeting';
import { joinSession } from '@/utils/session';

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
  const { onlineUserIds } = usePresence();
  const [clientUserIds, setClientUserIds] = useState<string[]>([]);
  const [stats, setStats] = useState({
    totalClients: 0,
    activeClients: 0,
    compliantToday: 0,
    pendingCheckIns: 0,
    unreadMessages: 0,
    activeChallenges: 0,
    todaysSessions: 0,
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
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
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
        .subscribe();

      return () => {
        supabase.removeChannel(checkinSubscription);
      };
    } else {
      setLoading(false);
    }
  }, [coach, unreadCount]);

  const loadDashboardData = async () => {
    if (!coach) return;
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const [
        statsResult,
        checkinsResult,
        clientsResult,
        challengesResult,
        sessionResult,
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
      ]);

      const activeChallengesCount = (challengesResult?.data || []).filter(
        (c: any) => c.status === 'active',
      ).length;

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
        });
      }

      const allClients = clientsResult.data || [];
      const clientMap = new Map<string, { name: string; avatar: string }>();

      if (clientsResult.data) {
        const ids = allClients
          .filter((c: any) => c.status === 'active')
          .map((c: any) => c.user_id || c.client_user_id)
          .filter(Boolean);

        setClientUserIds(ids);

        allClients.forEach((c: any) => {
          clientMap.set(c.client_id, {
            name: c.client_name,
            avatar: c.client_avatar,
          });
        });

        // Set streak leaders from active clients
        const activeStreakList = allClients.filter(
          (c: any) => c.status === 'active',
        );
        setStreakChampions(activeStreakList);
      }

      setRecentCheckins(checkinsResult.data || []);
      setHasMoreCheckins((checkinsResult.data || []).length === 15);
      setUpcomingSession(sessionResult?.data || null);

      // Fetch Today's Meals with photos for coach's clients
      const allClientIds = allClients.map((c: any) => c.client_id);
      if (allClientIds.length > 0) {
        const { data: mealsData } = await supabase
          .from('meals')
          .select(
            'id, client_id, name, meal_date, meal_type, calories, protein_g, carbs_g, fat_g, photo_url, created_at',
          )
          .in('client_id', allClientIds)
          .eq('meal_date', todayStr)
          .not('photo_url', 'is', null)
          .order('created_at', { ascending: false })
          .limit(10);

        if (mealsData) {
          const enriched = mealsData.map((m: any) => ({
            ...m,
            client_name: clientMap.get(m.client_id)?.name || 'Client',
            client_avatar: clientMap.get(m.client_id)?.avatar,
          }));
          setTodayMeals(enriched);
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

        setSlippingClients(slipping.slice(0, 3));
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

  const rawFirstName = profile?.full_name?.split(' ')[0] || '';
  const firstName = rawFirstName
    ? rawFirstName.charAt(0).toUpperCase() + rawFirstName.slice(1)
    : '';

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
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <SectionList
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: 130,
        }}
        sections={groupedCheckins}
        keyExtractor={(item, index) => item.checkin_id + index}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              refreshBrand();
              loadDashboardData();
            }}
            tintColor={colors.primary}
            progressViewOffset={insets.top + 10}
          />
        }
        onEndReached={loadMoreCheckins}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          <View>
            {/* Top Brand Bar */}
            <MotiView
              from={{ opacity: 0, translateY: -8 }}
              animate={{ opacity: 1, translateY: 0 }}
              className="px-6 pb-4 flex-row items-center justify-between"
            >
              <View className="flex-row items-center gap-3">
                {brand?.logo_url ? (
                  <Image
                    source={{ uri: brand.logo_url }}
                    style={{
                      width: 48,
                      height: 48,
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
                      width: 48,
                      height: 48,
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

              <TouchableOpacity
                onPress={() => router.push('/(coach)/(tabs)/profile')}
                className="p-1 rounded-full relative"
                style={{
                  backgroundColor: colors.surface,
                  borderColor: cardBorder,
                  borderWidth: 1,
                }}
              >
                <BrandedAvatar
                  name={profile?.full_name || 'Coach'}
                  imageUrl={profile?.avatar_url}
                  size={44}
                />
                <View
                  style={{ backgroundColor: colors.primary }}
                  className="absolute bottom-0.5 right-0.5 w-3 h-3 rounded-full border-2 border-slate-900"
                />
              </TouchableOpacity>
            </MotiView>

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
                              ? '#1E293B'
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
                    <View className="flex-1">
                      <Text
                        style={{ color: textColor }}
                        className="text-4xl font-black tracking-tighter leading-none mb-1"
                      >
                        {stats.pendingCheckIns}
                      </Text>
                      <Text
                        style={{ color: textSecondaryColor }}
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
                          ? 'rgba(59, 130, 246, 0.12)'
                          : cardBg,
                      borderColor:
                        stats.unreadMessages > 0
                          ? 'rgba(59, 130, 246, 0.35)'
                          : cardBorder,
                    }}
                  >
                    <View
                      className="w-12 h-12 rounded-2xl items-center justify-center border"
                      style={{
                        backgroundColor:
                          stats.unreadMessages > 0
                            ? 'rgba(59, 130, 246, 0.25)'
                            : isDark
                              ? '#1E293B'
                              : '#F1F5F9',
                        borderColor:
                          stats.unreadMessages > 0
                            ? 'rgba(59, 130, 246, 0.45)'
                            : cardBorder,
                      }}
                    >
                      <MessageSquare
                        size={22}
                        color={
                          stats.unreadMessages > 0
                            ? '#3B82F6'
                            : textSecondaryColor
                        }
                      />
                    </View>
                    <View className="flex-1">
                      <Text
                        style={{ color: textColor }}
                        className="text-4xl font-black tracking-tighter leading-none mb-1"
                      >
                        {stats.unreadMessages}
                      </Text>
                      <Text
                        style={{ color: textSecondaryColor }}
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
                      if (
                        upcomingSession.meet_url ||
                        upcomingSession.external_meeting_url
                      ) {
                        joinSession(
                          upcomingSession.meet_url ||
                            upcomingSession.external_meeting_url,
                        );
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

              {/* Today's Meals Slideshow / Reel (With Real Photos) */}
              {todayMeals.length > 0 && (
                <MealSlideshowCard
                  meals={todayMeals}
                  onPressMeal={(mealId) => {
                    router.push(`/meal-details/${mealId}` as any);
                  }}
                />
              )}

              {/* Clients Performance (Big Visible Averages) */}
              <ClientsPerformanceCard pulse={teamPulse} />

              {/* Streak Champions Mini-Strip (If any active streaks) */}
              {streakChampions.length > 0 && (
                <StreakChampionsStrip champions={streakChampions} />
              )}

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
                          backgroundColor: 'rgba(59, 130, 246, 0.12)',
                          borderColor: 'rgba(59, 130, 246, 0.25)',
                        }}
                      >
                        <Users size={22} color="#3B82F6" />
                      </View>
                      <ArrowUpRight size={18} color={textSecondaryColor} />
                    </View>
                    <Text
                      style={{ color: textColor }}
                      className="text-4xl font-black tracking-tighter leading-none mb-1"
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
                      <View className="w-2 h-2 rounded-full bg-blue-500" />
                      <Text
                        style={{ color: textSecondaryColor }}
                        className="text-xs font-semibold"
                      >
                        Active roster
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* 2. Active Now (with live sparkline) */}
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setShowAnalyticsModal(true)}
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
                          backgroundColor: 'rgba(168, 85, 247, 0.12)',
                          borderColor: 'rgba(168, 85, 247, 0.25)',
                        }}
                      >
                        <Activity size={22} color="#A855F7" />
                      </View>
                      <ArrowUpRight size={18} color={textSecondaryColor} />
                    </View>
                    <Text
                      style={{ color: textColor }}
                      className="text-4xl font-black tracking-tighter leading-none mb-1"
                    >
                      {displayActiveCount}
                    </Text>
                    <Text
                      style={{ color: textSecondaryColor }}
                      className="text-xs font-bold uppercase tracking-wider"
                    >
                      Active Now
                    </Text>

                    <View className="h-7 mt-1.5 opacity-70">
                      <AnalyticsSparkline
                        data={analyticsData}
                        heroNumber={displayActiveCount}
                        label="Active Now"
                        loading={loadingAnalytics}
                        dataKey="high_performers"
                      />
                    </View>

                    <View className="flex-row items-center gap-1.5 mt-2">
                      <View className="w-2 h-2 rounded-full bg-emerald-500" />
                      <Text className="text-emerald-500 text-xs font-bold">
                        {stats.compliantToday} logged today
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>

                <View className="flex-row gap-3">
                  {/* 3. Today's Calls */}
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() =>
                      router.push({
                        pathname: '/(coach)/(tabs)/calendar',
                        params: { resetToToday: 'true' },
                      })
                    }
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
                          backgroundColor: 'rgba(245, 158, 11, 0.12)',
                          borderColor: 'rgba(245, 158, 11, 0.25)',
                        }}
                      >
                        <Zap size={22} color="#F59E0B" />
                      </View>
                      <ArrowUpRight size={18} color={textSecondaryColor} />
                    </View>
                    <Text
                      style={{ color: textColor }}
                      className="text-4xl font-black tracking-tighter leading-none mb-1"
                    >
                      {stats.todaysSessions}
                    </Text>
                    <Text
                      style={{ color: textSecondaryColor }}
                      className="text-xs font-bold uppercase tracking-wider"
                    >
                      Today's Calls
                    </Text>
                    <View className="flex-row items-center gap-1.5 mt-3">
                      <View
                        className="w-2 h-2 rounded-full"
                        style={{
                          backgroundColor:
                            stats.todaysSessions > 0 ? '#F59E0B' : '#94A3B8',
                        }}
                      />
                      <Text
                        style={{ color: textSecondaryColor }}
                        className="text-xs font-semibold"
                      >
                        {stats.todaysSessions === 0
                          ? 'Clear schedule'
                          : 'Tap for schedule'}
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
                          backgroundColor: 'rgba(16, 185, 129, 0.12)',
                          borderColor: 'rgba(16, 185, 129, 0.25)',
                        }}
                      >
                        <Trophy size={22} color="#10B981" />
                      </View>
                      <ArrowUpRight size={18} color={textSecondaryColor} />
                    </View>
                    <Text
                      style={{ color: textColor }}
                      className="text-4xl font-black tracking-tighter leading-none mb-1"
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
                      <View className="w-2 h-2 rounded-full bg-emerald-500" />
                      <Text className="text-emerald-500 text-xs font-bold">
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
                      View Roster
                    </Text>
                  </TouchableOpacity>
                </View>

                <View className="flex-row flex-wrap gap-3">
                  <ActionCard
                    icon={<Trophy size={22} color="#F59E0B" />}
                    title="Challenges"
                    desc="Client goals"
                    onPress={() => router.push('/(coach)/challenges')}
                    cardStyle={cardStyle}
                    textStyle={{ color: textColor }}
                    descColor={textSecondaryColor}
                    iconBg="rgba(245, 158, 11, 0.12)"
                  />
                  <ActionCard
                    icon={<Zap size={22} color="#A855F7" />}
                    title="AI Scheduler"
                    desc="Plan sessions"
                    onPress={handleOpenAIScheduler}
                    cardStyle={cardStyle}
                    textStyle={{ color: textColor }}
                    descColor={textSecondaryColor}
                    iconBg="rgba(168, 85, 247, 0.12)"
                  />
                  <ActionCard
                    icon={<Users size={22} color="#3B82F6" />}
                    title="Team"
                    desc="Coaches & staff"
                    onPress={() => router.push('/(coach)/team')}
                    cardStyle={cardStyle}
                    textStyle={{ color: textColor }}
                    descColor={textSecondaryColor}
                    iconBg="rgba(59, 130, 246, 0.12)"
                  />
                  <ActionCard
                    icon={<UserPlus size={22} color={colors.primary} />}
                    title="Invite Client"
                    desc="Send invite link"
                    onPress={() => router.push('/(coach)/invite-client')}
                    cardStyle={cardStyle}
                    textStyle={{ color: textColor }}
                    descColor={textSecondaryColor}
                    iconBg={colors.primary + '18'}
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

      {/* Analytics Detailed Modal */}
      <AnalyticsDetailedModal
        visible={showAnalyticsModal}
        onClose={() => setShowAnalyticsModal(false)}
        data={analyticsData}
        currentActive={displayActiveCount}
      />

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

  if (!clients || clients.length === 0) return null;

  const firstClient = clients[0];
  const count = clients.length;

  return (
    <MotiView
      key="slipping-hero"
      from={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        borderRadius: 40,
        overflow: 'hidden',
        backgroundColor: colors.primary,
      }}
      className="border border-white/10 relative mb-4"
    >
      {/* Decorative ambient glow circles exactly matching CheckInCTACard */}
      <View className="absolute -top-24 -right-12 w-64 h-64 bg-white/10 rounded-full" />
      <View className="absolute -bottom-24 -left-12 w-48 h-48 bg-black/10 rounded-full" />

      <TouchableOpacity
        className="p-8 relative z-10"
        activeOpacity={0.85}
        onPress={() => onMessageClient(firstClient.client_id)}
      >
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
            <View className="bg-black/20 px-3 py-1 rounded-full">
              <Text
                style={{ color: primaryTextColor }}
                className="text-xs font-black uppercase tracking-wider"
              >
                {count} Clients
              </Text>
            </View>
          )}
        </View>

        <Text
          style={{ color: primaryTextColor }}
          className="text-3xl font-black tracking-tight leading-8"
        >
          {count === 1
            ? `${firstClient.client_name} Missed Check-in`
            : `${count} Clients Missed Check-in`}
        </Text>

        <Text
          style={{ color: primaryTextMuted }}
          className="mt-3 font-medium text-sm leading-6"
        >
          {firstClient.daysSinceCheckin
            ? `No check-in logged for ${firstClient.daysSinceCheckin} days. Send a quick nudge to keep them on track.`
            : 'No check-in recorded yet. Reach out to maintain daily momentum.'}
        </Text>

        {/* Client Row & Action Button matching CheckInCTACard footer */}
        <View className="mt-8 flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <BrandedAvatar
              name={firstClient.client_name}
              imageUrl={firstClient.client_avatar}
              size={42}
            />
            <View>
              <Text
                style={{ color: primaryTextColor }}
                className="text-sm font-black"
                numberOfLines={1}
              >
                {firstClient.client_name}
              </Text>
              {count > 1 && (
                <Text
                  style={{ color: primaryTextMuted }}
                  className="text-xs font-bold"
                >
                  +{count - 1} more
                </Text>
              )}
            </View>
          </View>

          <View className="flex-row items-center gap-2.5">
            <View
              style={{ backgroundColor: btnBg }}
              className="px-5 py-2.5 rounded-full flex-row items-center gap-1.5"
            >
              <MessageSquare size={13} color={btnText} strokeWidth={2.5} />
              <Text
                style={{ color: btnText }}
                className="font-black text-xs uppercase tracking-widest"
              >
                Message
              </Text>
            </View>
            <ChevronRight size={24} color={primaryTextColor} opacity={0.6} />
          </View>
        </View>
      </TouchableOpacity>
    </MotiView>
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
              <Moon size={14} color="#818CF8" />
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
              <Zap size={14} color="#F59E0B" />
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
              <CheckCircle2 size={14} color="#10B981" />
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

// ─── Today's Meals Slideshow Card (Huge Photos & Deep Link) ──────────────────
const MealSlideshowCard = ({
  meals,
  onPressMeal,
}: {
  meals: any[];
  onPressMeal: (mealId: string) => void;
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
            Today's Meals
          </Text>
        </View>
        <Text
          style={{ color: textSecondaryColor }}
          className="text-xs font-bold"
        >
          {meals.length} {meals.length === 1 ? 'logged' : 'logged'}
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
            ? new Date(meal.created_at).toLocaleTimeString([], {
                hour: 'numeric',
                minute: '2-digit',
              })
            : '';
          const mealTypeLabel = meal.meal_type
            ? meal.meal_type.charAt(0).toUpperCase() + meal.meal_type.slice(1)
            : 'Meal';

          return (
            <TouchableOpacity
              key={meal.id}
              activeOpacity={0.9}
              onPress={() => onPressMeal(meal.id)}
              className="overflow-hidden rounded-[36px] border relative"
              style={{
                width: MEAL_CARD_WIDTH,
                height: 220,
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
                colors={['rgba(0,0,0,0.45)', 'transparent', 'rgba(0,0,0,0.88)']}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                }}
              />

              {/* Top Bar: Client info & Meal time */}
              <View className="absolute top-4 left-4 right-4 flex-row items-center justify-between">
                <View className="flex-row items-center gap-2 bg-black/50 px-3 py-1.5 rounded-full border border-white/10">
                  <BrandedAvatar
                    name={meal.client_name}
                    imageUrl={meal.client_avatar}
                    size={24}
                  />
                  <Text
                    className="text-white font-bold text-xs"
                    numberOfLines={1}
                  >
                    {meal.client_name}
                  </Text>
                </View>

                <View className="bg-black/50 px-3 py-1.5 rounded-full border border-white/10">
                  <Text className="text-white/90 font-bold text-xs">
                    {mealTypeLabel} {timeStr ? `· ${timeStr}` : ''}
                  </Text>
                </View>
              </View>

              {/* Bottom Content: Meal Title & Calories/Protein badge */}
              <View className="absolute bottom-4 left-4 right-4 flex-row items-end justify-between">
                <View className="flex-1 mr-3">
                  <Text
                    className="text-white font-black text-xl tracking-tight leading-6"
                    numberOfLines={1}
                  >
                    {meal.name || mealTypeLabel}
                  </Text>
                  <View className="flex-row items-center gap-2 mt-1.5">
                    {meal.calories != null && (
                      <View className="bg-white/20 px-3 py-1 rounded-full">
                        <Text className="text-white font-bold text-xs">
                          {meal.calories} kcal
                        </Text>
                      </View>
                    )}
                    {meal.protein_g != null && (
                      <View className="bg-emerald-500/30 border border-emerald-400/30 px-3 py-1 rounded-full">
                        <Text className="text-emerald-300 font-bold text-xs">
                          {meal.protein_g}g protein
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                <View className="bg-white/20 border border-white/20 px-3.5 py-2 rounded-full flex-row items-center gap-1.5">
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

// ─── Streak Champions Mini-Strip ─────────────────────────────────────────────
const StreakChampionsStrip = ({ champions }: { champions: any[] }) => {
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

  if (!champions || champions.length === 0) return null;

  return (
    <View className="mb-4">
      <View
        className="p-5 rounded-[30px] border flex-row items-center justify-between"
        style={{
          backgroundColor: cardBg,
          borderColor: cardBorder,
        }}
      >
        <View className="flex-row items-center gap-2.5">
          <View className="w-9 h-9 rounded-full bg-amber-500/15 items-center justify-center">
            <Flame size={18} color="#F59E0B" />
          </View>
          <View>
            <Text
              style={{ color: textColor }}
              className="font-black text-base tracking-tight"
            >
              Active Streaks
            </Text>
            <Text
              style={{ color: textSecondaryColor }}
              className="text-[10px] font-bold uppercase tracking-wider"
            >
              Consistency leaders
            </Text>
          </View>
        </View>

        <View className="flex-row items-center gap-2">
          {champions.slice(0, 3).map((c) => (
            <View
              key={c.client_id}
              className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full border"
              style={{
                backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F8FAFC',
                borderColor: cardBorder,
              }}
            >
              <BrandedAvatar
                name={c.client_name}
                imageUrl={c.client_avatar}
                size={20}
              />
              <Text
                style={{ color: textColor }}
                className="text-xs font-bold"
                numberOfLines={1}
              >
                {c.client_name.split(' ')[0]}
              </Text>
            </View>
          ))}
        </View>
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
        backgroundColor: canJoin
          ? isDark
            ? 'rgba(30, 58, 138, 0.4)'
            : '#EFF6FF'
          : cardBg,
        borderColor: canJoin ? '#3B82F6' : cardBorder,
      }}
    >
      <View className="p-6">
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center gap-2">
            <View
              className="w-8 h-8 rounded-xl items-center justify-center border"
              style={{
                backgroundColor: canJoin
                  ? 'rgba(59, 130, 246, 0.2)'
                  : `${colors.primary}18`,
                borderColor: canJoin
                  ? 'rgba(59, 130, 246, 0.4)'
                  : `${colors.primary}35`,
              }}
            >
              <Video size={16} color={canJoin ? '#60A5FA' : colors.primary} />
            </View>
            <Text
              style={{ color: canJoin ? '#60A5FA' : colors.primary }}
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
                  ? '#1E293B'
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
              backgroundColor: canJoin ? '#2563EB' : colors.primary,
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
