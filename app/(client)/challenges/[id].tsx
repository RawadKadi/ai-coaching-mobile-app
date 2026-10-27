import { useBrandColors } from '@/contexts/BrandContext';
import { isDarkColor } from '@/lib/theme-utils';
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MotiView } from 'moti';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import {
  ArrowLeft,
  Calendar,
  ChevronRight,
  CheckCircle,
  X,
} from 'lucide-react-native';
import { NestedTaskCard } from '@/components/NestedTaskCard';
import { ChallengeDetailsSkeleton } from '@/components/ChallengeDetailsSkeleton';

export default function ChallengeDetailScreen() {
  const insets = useSafeAreaInsets();
  const colors = useBrandColors();
  const isDark = isDarkColor(colors.background || '#020617');
  const textColor = colors.text || (isDark ? '#FFFFFF' : '#0F172A');
  const textSecondaryColor = colors.textSecondary || (isDark ? '#94A3B8' : '#64748B');
  const cardBg = colors.surface || (isDark ? '#0F172A' : '#FFFFFF');
  const cardBorder = colors.border || (isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0');
  const innerBg = colors.background || (isDark ? '#020617' : '#F8FAFC');

  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [challenge, setChallenge] = useState<any>(null);

  // Bottom Sheet Drawer Animation state for Day Breakdown
  const SCREEN_HEIGHT = Dimensions.get('window').height;
  const daySheetAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const dayFadeAnim = useRef(new Animated.Value(0)).current;
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [selectedDayMeta, setSelectedDayMeta] = useState<{
    dayNumber: number;
    formattedDate: string;
  } | null>(null);
  const [showDayDrawer, setShowDayDrawer] = useState(false);

  const timeoutRefs = useRef<{ [key: string]: any }>({});

  useEffect(() => {
    return () => {
      Object.values(timeoutRefs.current).forEach((timeout) => clearTimeout(timeout));
    };
  }, []);

  useEffect(() => {
    loadChallengeDetails();
    if (!id) return;
    const subscription = supabase
      .channel(`challenge-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sub_challenges',
          filter: `mother_challenge_id=eq.${id}`,
        },
        (payload) => {
          setChallenge((current: any) => {
            if (!current) return current;
            const updatedSubChallenges = current.sub_challenges.map((sub: any) =>
              sub.id === payload.new.id
                ? { ...sub, completed: payload.new.completed, completed_at: payload.new.completed_at }
                : sub
            );
            return { ...current, sub_challenges: updatedSubChallenges };
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(subscription);
    };
  }, [id]);

  const loadChallengeDetails = async () => {
    if (!id || !user) return;
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_mother_challenge_details', {
        p_mother_challenge_id: id,
      });
      if (error) throw error;
      if (!data || data.length === 0) {
        router.back();
        return;
      }

      setChallenge(data[0]);
    } catch (error) {
      console.error('Error loading challenge:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendCompletionMessage = async (task: any) => {
    try {
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('id, user_id')
        .eq('user_id', user!.id)
        .single();

      if (clientError || !clientData) return;

      const { data: linkData, error: linkError } = await supabase
        .from('coach_client_links')
        .select('coach_id')
        .eq('client_id', clientData.id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();

      if (linkError || !linkData) return;

      const { data: coachData, error: coachError } = await supabase
        .from('coaches')
        .select('user_id')
        .eq('id', linkData.coach_id)
        .single();

      if (coachError || !coachData) return;

      const payload = {
        sender_id: clientData.user_id,
        recipient_id: coachData.user_id,
        content: JSON.stringify({
          type: 'challenge_completed',
          title: 'Client finished this task',
          taskName: task.name || 'Task',
          completedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          taskDescription: task.description || '',
          focusType: task.focus_type || '',
          intensity: task.intensity || '',
        }),
        read: false,
        ai_generated: false,
      };

      await supabase.from('messages').insert(payload);
    } catch (error) {
      console.error('[sendCompletionMessage] Exception:', error);
    }
  };

  const toggleSubChallenge = async (sub: any) => {
    try {
      const newCompleted = !sub.completed;

      if (timeoutRefs.current[sub.id]) {
        clearTimeout(timeoutRefs.current[sub.id]);
        delete timeoutRefs.current[sub.id];
      }

      setChallenge((prev: any) => {
        if (!prev) return prev;
        const updatedSubChallenges = prev.sub_challenges.map((s: any) =>
          s.id === sub.id ? { ...s, completed: newCompleted } : s
        );
        return { ...prev, sub_challenges: updatedSubChallenges };
      });

      const { data: cData } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', user!.id)
        .single();
      if (!cData) return;

      await supabase.rpc('mark_sub_challenge', {
        p_sub_challenge_id: sub.id,
        p_client_id: cData.id,
        p_completed: newCompleted,
      });

      if (newCompleted) {
        sendCompletionMessage(sub);
      }
    } catch (e) {
      loadChallengeDetails();
    }
  };

  const openDayDrawer = (dateStr: string, dayNumber: number, formattedDate: string) => {
    setSelectedDateKey(dateStr);
    setSelectedDayMeta({ dayNumber, formattedDate });
    setShowDayDrawer(true);
    daySheetAnim.setValue(SCREEN_HEIGHT);
    dayFadeAnim.setValue(0);

    Animated.parallel([
      Animated.timing(dayFadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.spring(daySheetAnim, {
        toValue: 0,
        damping: 24,
        stiffness: 180,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeDayDrawer = () => {
    Animated.parallel([
      Animated.timing(dayFadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(daySheetAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowDayDrawer(false);
      setSelectedDateKey(null);
      setSelectedDayMeta(null);
    });
  };

  if (loading) {
    return <ChallengeDetailsSkeleton />;
  }

  if (!challenge) return null;

  const completedCount =
    challenge.sub_challenges?.filter((s: any) => s.completed).length || 0;
  const totalCount = challenge.sub_challenges?.length || 0;
  const completionRate =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const missedCount =
    challenge.sub_challenges?.filter(
      (s: any) => !s.completed && new Date(s.assigned_date) < now
    ).length || 0;
  const remainingCount = Math.max(0, totalCount - completedCount - missedCount);

  const isEnded =
    challenge.status !== 'active' ||
    new Date(challenge.end_date) < new Date(new Date().setHours(0, 0, 0, 0));
  const isFailed = isEnded && completedCount === 0;
  const isCompleted = isEnded && completedCount > 0;

  // Group tasks by date
  const groupedTasks: Record<string, any[]> = {};
  if (challenge?.sub_challenges) {
    challenge.sub_challenges.forEach((task: any) => {
      const dateKey = new Date(task.assigned_date).toISOString().split('T')[0];
      if (!groupedTasks[dateKey]) groupedTasks[dateKey] = [];
      groupedTasks[dateKey].push(task);
    });
  }

  const sortedDates = Object.keys(groupedTasks).sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  );

  const todayKeyGlobal = new Date().toISOString().split('T')[0];
  const todayDates = sortedDates.filter((d) => d === todayKeyGlobal);
  const upcomingDates = sortedDates.filter((d) => d > todayKeyGlobal);
  const previousDates = sortedDates.filter((d) => d < todayKeyGlobal);

  // Active drawer tasks derived live from challenge.sub_challenges
  const activeDrawerTasks = selectedDateKey
    ? (challenge?.sub_challenges || []).filter((t: any) => {
        const dateKey = new Date(t.assigned_date).toISOString().split('T')[0];
        return dateKey === selectedDateKey;
      })
    : [];
  const drawerCompletedCount = activeDrawerTasks.filter((t: any) => t.completed).length;
  const drawerTotalCount = activeDrawerTasks.length;
  const drawerProgressPercent =
    drawerTotalCount > 0 ? (drawerCompletedCount / drawerTotalCount) * 100 : 0;
  const drawerIsAllDone =
    drawerTotalCount > 0 && drawerCompletedCount === drawerTotalCount;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header with Title - matches Dashboard/Plan styling with no 'failed' tag to the right */}
      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: insets.top ? insets.top + 8 : 52,
          paddingBottom: 16,
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.background,
          borderBottomWidth: 1,
          borderBottomColor: cardBorder,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            width: 40,
            height: 40,
            backgroundColor: cardBg,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: cardBorder,
            marginRight: 14,
          }}
        >
          <ArrowLeft size={20} color={textColor} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: textSecondaryColor,
              fontSize: 11,
              fontWeight: '900',
              textTransform: 'uppercase',
              letterSpacing: 1.5,
            }}
          >
            {challenge.category ? challenge.category.toUpperCase() : 'DAILY TASKS'}
          </Text>
          <Text
            style={{ color: textColor, fontSize: 18, fontWeight: '900' }}
            numberOfLines={1}
          >
            {challenge.name}
          </Text>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      >
        {challenge.description ? (
          <View style={{ paddingHorizontal: 4, marginTop: 14 }}>
            <Text
              style={{
                color: textSecondaryColor,
                fontSize: 14,
                fontWeight: '500',
                lineHeight: 20,
              }}
            >
              {challenge.description}
            </Text>
          </View>
        ) : null}

        {/* Performance Overview Card - Consistent 12px padding like Dashboard/Plan cards */}
        <MotiView
          key={`stats-${challenge.id}`}
          from={{ opacity: 0, translateY: 30 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 140 } as any}
          style={{
            marginTop: 16,
            backgroundColor: cardBg,
            padding: 22,
            borderRadius: 28,
            borderWidth: 1,
            borderColor: cardBorder,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 18,
            }}
          >
            {/* Improved Failed Phase / Active Phase tag */}
            <View
              style={{
                paddingHorizontal: 12,
                paddingVertical: 5,
                borderRadius: 999,
                backgroundColor: isFailed
                  ? isDark
                    ? 'rgba(239, 68, 68, 0.16)'
                    : '#FEE2E2'
                  : isDark
                  ? `${colors.primary}20`
                  : `${colors.primary}12`,
                borderWidth: 1,
                borderColor: isFailed
                  ? isDark
                    ? 'rgba(239, 68, 68, 0.35)'
                    : '#FECACA'
                  : isDark
                  ? `${colors.primary}40`
                  : `${colors.primary}30`,
              }}
            >
              <Text
                style={{
                  color: isFailed
                    ? isDark
                      ? '#FCA5A5'
                      : '#DC2626'
                    : colors.primary,
                  fontSize: 10,
                  fontWeight: '900',
                  textTransform: 'uppercase',
                  letterSpacing: 1.2,
                }}
              >
                {isFailed ? 'Failed Phase' : 'Active Phase'}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Calendar size={14} color={textSecondaryColor} />
              <Text
                style={{
                  color: textSecondaryColor,
                  fontSize: 12,
                  fontWeight: '600',
                }}
              >
                Until {new Date(challenge.end_date).toLocaleDateString()}
              </Text>
            </View>
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'baseline',
              gap: 8,
              marginBottom: 6,
            }}
          >
            <Text
              style={{
                fontSize: 36,
                fontWeight: '900',
                color: isFailed ? '#EF4444' : textColor,
              }}
            >
              {completionRate}%
            </Text>
            <Text style={{ color: textSecondaryColor, fontWeight: '600' }}>
              {isFailed ? 'Total Compliance' : 'Compliance'}
            </Text>
          </View>

          <View
            style={{
              height: 10,
              borderRadius: 999,
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: cardBorder,
              marginBottom: 20,
              backgroundColor: isDark ? '#1E293B' : '#E2E8F0',
            }}
          >
            <View
              style={{
                height: '100%',
                borderRadius: 999,
                backgroundColor: isFailed ? '#EF4444' : colors.primary,
                width: isFailed ? '100%' : `${completionRate}%`,
              }}
            />
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: innerBg,
              padding: 16,
              borderRadius: 22,
              borderWidth: 1,
              borderColor: cardBorder,
            }}
          >
            <View
              style={{
                alignItems: 'center',
                flex: 1,
                borderRightWidth: 1,
                borderRightColor: cardBorder,
              }}
            >
              <Text
                style={{
                  color: textSecondaryColor,
                  fontSize: 10,
                  fontWeight: '900',
                  textTransform: 'uppercase',
                  letterSpacing: 1.5,
                  marginBottom: 4,
                }}
              >
                Done
              </Text>
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: '900',
                  color: completedCount > 0 ? (isFailed ? '#EF4444' : colors.primary) : textColor,
                }}
              >
                {completedCount}
              </Text>
            </View>
            <View
              style={{
                alignItems: 'center',
                flex: 1,
                borderRightWidth: 1,
                borderRightColor: cardBorder,
              }}
            >
              <Text
                style={{
                  color: textSecondaryColor,
                  fontSize: 10,
                  fontWeight: '900',
                  textTransform: 'uppercase',
                  letterSpacing: 1.5,
                  marginBottom: 4,
                }}
              >
                Missed
              </Text>
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: '900',
                  color: missedCount > 0 ? '#EF4444' : textColor,
                }}
              >
                {missedCount}
              </Text>
            </View>
            <View style={{ alignItems: 'center', flex: 1 }}>
              <Text
                style={{
                  color: textSecondaryColor,
                  fontSize: 10,
                  fontWeight: '900',
                  textTransform: 'uppercase',
                  letterSpacing: 1.5,
                  marginBottom: 4,
                }}
              >
                Left
              </Text>
              <Text style={{ fontSize: 20, fontWeight: '900', color: textColor }}>
                {remainingCount}
              </Text>
            </View>
          </View>
        </MotiView>

        {/* Daily Breakdown Section - Replaced dropdown accordion with chunky cards */}
        <View style={{ marginTop: 28 }}>
          <Text
            style={{
              color: textColor,
              fontSize: 22,
              fontWeight: '900',
              letterSpacing: -0.4,
              marginBottom: 16,
              marginLeft: 4,
            }}
          >
            Daily Breakdown
          </Text>

          {/* Today Group */}
          {todayDates.length > 0 && (
            <View style={{ marginBottom: 18 }}>
              <Text
                style={{
                  color: colors.primary,
                  fontSize: 11,
                  fontWeight: '900',
                  textTransform: 'uppercase',
                  letterSpacing: 1.5,
                  marginBottom: 10,
                  marginLeft: 6,
                }}
              >
                Today
              </Text>
              {todayDates.map((dateStr: string) => {
                const dayNumber = sortedDates.indexOf(dateStr) + 1;
                const dayTasks = (challenge.sub_challenges || []).filter(
                  (t: any) =>
                    new Date(t.assigned_date).toISOString().split('T')[0] === dateStr
                );
                return (
                  <DayCard
                    key={dateStr}
                    dayNumber={dayNumber}
                    dateStr={dateStr}
                    tasks={dayTasks}
                    challengeName={challenge.name}
                    category={challenge.category}
                    onPress={() => {
                      const dateObj = new Date(dateStr);
                      const userTimezoneOffset = dateObj.getTimezoneOffset() * 60000;
                      const localDate = new Date(dateObj.getTime() + userTimezoneOffset);
                      const formattedDate = localDate.toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      });
                      openDayDrawer(dateStr, dayNumber, formattedDate);
                    }}
                  />
                );
              })}
            </View>
          )}

          {/* Upcoming Group */}
          {upcomingDates.length > 0 && (
            <View style={{ marginBottom: 18 }}>
              <Text
                style={{
                  color: textSecondaryColor,
                  fontSize: 11,
                  fontWeight: '900',
                  textTransform: 'uppercase',
                  letterSpacing: 1.5,
                  marginBottom: 10,
                  marginLeft: 6,
                }}
              >
                Upcoming
              </Text>
              {upcomingDates.map((dateStr: string) => {
                const dayNumber = sortedDates.indexOf(dateStr) + 1;
                const dayTasks = (challenge.sub_challenges || []).filter(
                  (t: any) =>
                    new Date(t.assigned_date).toISOString().split('T')[0] === dateStr
                );
                return (
                  <DayCard
                    key={dateStr}
                    dayNumber={dayNumber}
                    dateStr={dateStr}
                    tasks={dayTasks}
                    challengeName={challenge.name}
                    category={challenge.category}
                    onPress={() => {
                      const dateObj = new Date(dateStr);
                      const userTimezoneOffset = dateObj.getTimezoneOffset() * 60000;
                      const localDate = new Date(dateObj.getTime() + userTimezoneOffset);
                      const formattedDate = localDate.toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      });
                      openDayDrawer(dateStr, dayNumber, formattedDate);
                    }}
                  />
                );
              })}
            </View>
          )}

          {/* Previous Group */}
          {previousDates.length > 0 && (
            <View style={{ marginBottom: 18 }}>
              <Text
                style={{
                  color: textSecondaryColor,
                  fontSize: 11,
                  fontWeight: '900',
                  textTransform: 'uppercase',
                  letterSpacing: 1.5,
                  marginBottom: 10,
                  marginLeft: 6,
                }}
              >
                Previous
              </Text>
              {previousDates.map((dateStr: string) => {
                const dayNumber = sortedDates.indexOf(dateStr) + 1;
                const dayTasks = (challenge.sub_challenges || []).filter(
                  (t: any) =>
                    new Date(t.assigned_date).toISOString().split('T')[0] === dateStr
                );
                return (
                  <DayCard
                    key={dateStr}
                    dayNumber={dayNumber}
                    dateStr={dateStr}
                    tasks={dayTasks}
                    challengeName={challenge.name}
                    category={challenge.category}
                    onPress={() => {
                      const dateObj = new Date(dateStr);
                      const userTimezoneOffset = dateObj.getTimezoneOffset() * 60000;
                      const localDate = new Date(dateObj.getTime() + userTimezoneOffset);
                      const formattedDate = localDate.toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      });
                      openDayDrawer(dateStr, dayNumber, formattedDate);
                    }}
                  />
                );
              })}
            </View>
          )}

          {sortedDates.length === 0 && (
            <View
              style={{
                padding: 28,
                backgroundColor: cardBg,
                borderWidth: 1,
                borderColor: cardBorder,
                borderRadius: 24,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: textSecondaryColor, fontWeight: '600' }}>
                No daily breakdown established.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Day Tasks Bottom Sheet Drawer - Slides up from down smoothly */}
      <Modal
        visible={showDayDrawer}
        transparent
        statusBarTranslucent
        animationType="none"
        onRequestClose={closeDayDrawer}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          {/* Dimmed backdrop */}
          <Animated.View
            style={{
              ...(StyleSheet.absoluteFill as any),
              backgroundColor: isDark
                ? 'rgba(0,0,0,0.72)'
                : 'rgba(15, 23, 42, 0.55)',
              opacity: dayFadeAnim,
            }}
          >
            <TouchableWithoutFeedback onPress={closeDayDrawer}>
              <View style={{ flex: 1 }} />
            </TouchableWithoutFeedback>
          </Animated.View>

          {/* Drawer container sliding up */}
          <Animated.View
            style={{
              backgroundColor: cardBg,
              borderTopLeftRadius: 36,
              borderTopRightRadius: 36,
              paddingTop: 18,
              paddingHorizontal: 20,
              paddingBottom: insets.bottom + 24,
              maxHeight: '85%',
              borderTopWidth: 1,
              borderTopColor: isDark
                ? 'rgba(255, 255, 255, 0.08)'
                : '#E2E8F0',
              transform: [{ translateY: daySheetAnim }],
            }}
          >
            {/* Handle bar */}
            <View
              style={{
                width: 44,
                height: 5,
                borderRadius: 3,
                backgroundColor: isDark
                  ? 'rgba(255, 255, 255, 0.2)'
                  : '#CBD5E1',
                alignSelf: 'center',
                marginBottom: 16,
              }}
            />

            {/* Modal Header */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 14,
              }}
            >
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text
                  style={{
                    color: colors.primary,
                    fontSize: 11,
                    fontWeight: '900',
                    textTransform: 'uppercase',
                    letterSpacing: 1.4,
                  }}
                >
                  {selectedDayMeta
                    ? `DAY ${selectedDayMeta.dayNumber}`
                    : 'DAILY TASKS'}{' '}
                  • {challenge.category ? challenge.category.toUpperCase() : 'CHALLENGE'}
                </Text>
                <Text
                  style={{
                    color: textColor,
                    fontSize: 22,
                    fontWeight: '900',
                    letterSpacing: -0.4,
                    marginTop: 2,
                  }}
                  numberOfLines={1}
                >
                  {selectedDayMeta?.formattedDate || 'Tasks'}
                </Text>
                <Text
                  style={{
                    color: textSecondaryColor,
                    fontSize: 13,
                    fontWeight: '600',
                    marginTop: 2,
                  }}
                >
                  {drawerTotalCount === 0
                    ? 'No tasks assigned'
                    : `${drawerCompletedCount} of ${drawerTotalCount} completed`}
                </Text>
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

            {/* Progress Bar in Drawer */}
            {drawerTotalCount > 0 && (
              <View style={{ marginBottom: 16 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    width: '100%',
                  }}
                >
                  <View
                    style={{
                      flex: 1,
                      height: 8,
                      backgroundColor: isDark
                        ? 'rgba(255, 255, 255, 0.08)'
                        : '#F1F5F9',
                      borderRadius: 4,
                      overflow: 'hidden',
                    }}
                  >
                    <View
                      style={{
                        height: '100%',
                        width: `${Math.min(100, Math.max(0, drawerProgressPercent))}%`,
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
                    {Math.round(drawerProgressPercent)}%
                  </Text>
                </View>
              </View>
            )}

            {/* Celebration Badge if all done */}
            {drawerIsAllDone && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  backgroundColor: isDark
                    ? `${colors.primary}25`
                    : `${colors.primary}12`,
                  borderWidth: 1,
                  borderColor: `${colors.primary}40`,
                  borderRadius: 14,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  marginBottom: 16,
                }}
              >
                <CheckCircle size={18} color={colors.primary} />
                <Text
                  style={{
                    color: isDark ? '#FFFFFF' : colors.primary,
                    fontSize: 13,
                    fontWeight: '800',
                  }}
                >
                  All tasks completed for this day!
                </Text>
              </View>
            )}

            {/* Scrollable list of interactive tasks */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 24, gap: 10 }}
            >
              {activeDrawerTasks.length === 0 ? (
                <View
                  style={{
                    padding: 24,
                    alignItems: 'center',
                    backgroundColor: innerBg,
                    borderRadius: 18,
                  }}
                >
                  <Text style={{ color: textSecondaryColor, fontWeight: '500' }}>
                    No tasks found for this date.
                  </Text>
                </View>
              ) : (
                activeDrawerTasks.map((task: any, idx: number) => (
                  <NestedTaskCard
                    key={task.id}
                    task={task}
                    index={idx}
                    isFailed={isFailed}
                    isCompleted={isCompleted}
                    onToggleParent={toggleSubChallenge}
                    layoutType="detail"
                  />
                ))
              )}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Day Card Component (Chunky Apple Style, matches DailyTasksHeroCard) ──────
interface DayCardProps {
  dayNumber: number;
  dateStr: string;
  tasks: any[];
  challengeName: string;
  category?: string;
  onPress: () => void;
}

const DayCard = ({
  dayNumber,
  dateStr,
  tasks,
  challengeName,
  category,
  onPress,
}: DayCardProps) => {
  const colors = useBrandColors();
  const isDark = isDarkColor(colors.background || '#020617');
  const textColor = colors.text || (isDark ? '#FFFFFF' : '#0F172A');
  const textSecondaryColor = colors.textSecondary || (isDark ? '#94A3B8' : '#64748B');
  const cardBg = colors.surface || (isDark ? '#0F172A' : '#FFFFFF');
  const cardBorder = colors.border || (isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0');

  const dateObj = new Date(dateStr);
  const userTimezoneOffset = dateObj.getTimezoneOffset() * 60000;
  const localDate = new Date(dateObj.getTime() + userTimezoneOffset);
  const formattedDate = localDate.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  const todayKey = new Date().toISOString().split('T')[0];
  const isToday = dateStr === todayKey;

  const totalCount = tasks.length;
  const completedCount = tasks.filter((t: any) => t.completed).length;
  const isAllDone = totalCount > 0 && completedCount === totalCount;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const primaryIsDark = isDarkColor(colors.primary);
  const completedText = primaryIsDark ? '#FFFFFF' : '#0F172A';
  const completedMuted = primaryIsDark ? 'rgba(255, 255, 255, 0.75)' : 'rgba(15, 23, 42, 0.75)';
  const completedBadgeBg = primaryIsDark ? '#FFFFFF' : '#0F172A';
  const completedBadgeContent = colors.primary;

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      style={{
        backgroundColor: isAllDone ? colors.primary : cardBg,
        borderColor: isAllDone ? colors.primary : cardBorder,
        borderWidth: 1,
        borderRadius: 24,
        padding: 20,
        marginBottom: 12,
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
            : `${colors.primary}10`,
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
                : isToday
                ? `${colors.primary}20`
                : isDark
                ? 'rgba(255, 255, 255, 0.06)'
                : '#F1F5F9',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isAllDone ? (
              <CheckCircle size={16} color={completedBadgeContent} />
            ) : (
              <Calendar
                size={16}
                color={isToday ? colors.primary : textSecondaryColor}
              />
            )}
          </View>
          <Text
            style={{
              color: isAllDone
                ? completedMuted
                : isToday
                ? colors.primary
                : textSecondaryColor,
              fontSize: 11,
              fontWeight: '900',
              textTransform: 'uppercase',
              letterSpacing: 1.3,
            }}
          >
            DAY {dayNumber} • {category ? category.toUpperCase() : 'CHALLENGE'}
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
              {totalCount === 0
                ? 'No tasks'
                : isAllDone
                ? 'All Done 🎉'
                : `${completedCount}/${totalCount} Done`}
            </Text>
          </View>
          <ChevronRight
            size={18}
            color={isAllDone ? completedMuted : textSecondaryColor}
          />
        </View>
      </View>

      {/* Main Headline: Day & Date */}
      <Text
        style={{
          color: isAllDone ? completedText : textColor,
          fontSize: 22,
          fontWeight: '900',
          letterSpacing: -0.4,
          marginBottom: 4,
        }}
      >
        {isToday ? 'Today, ' : ''}
        {formattedDate}
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
        {totalCount === 0
          ? 'No tasks assigned'
          : isAllDone
          ? 'All tasks completed!'
          : `${totalCount - completedCount} tasks left`}
      </Text>

      {/* Progress Bar + Percentage */}
      {totalCount > 0 && (
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
                width: `${Math.min(100, Math.max(0, progressPercent))}%`,
                backgroundColor: isAllDone ? '#FFFFFF' : colors.primary,
                borderRadius: 4,
              }}
            />
          </View>
          <Text
            style={{
              color: isAllDone ? completedText : textColor,
              fontSize: 12,
              fontWeight: '900',
              minWidth: 36,
              textAlign: 'right',
            }}
          >
            {Math.round(progressPercent)}%
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};
