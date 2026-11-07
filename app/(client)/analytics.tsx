import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  StyleSheet,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import {
  ChevronLeft,
  ChevronRight,
  Flame,
  Moon,
  Scale,
  Zap,
  Dumbbell,
  Clock,
  Utensils,
  MessageSquare,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/BrandContext';
import { isDarkColor } from '@/lib/theme-utils';
import { supabase } from '@/lib/supabase';
import {
  getTodaySteps,
  getLastNightSleep,
  getLatestWeight,
  getTodayActiveEnergy,
} from '@/lib/health-service';
import { BrandedAvatar } from '@/components/BrandedAvatar';

interface DailyLogEntry {
  date: string;
  steps?: number;
  sleep_hours?: number;
  active_minutes?: number;
  client_id?: string;
}

interface CheckInEntry {
  date: string;
  weight_kg?: number;
  energy_level?: number;
  stress_level?: number;
  hunger_level?: number;
  client_id?: string;
}

interface MealEntry {
  id: string;
  meal_date: string;
  meal_name?: string;
  calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  photo_url?: string;
}

/** Formats a date as YYYY-MM-DD in local time */
function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function AnalyticsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ clientId?: string; name?: string; avatar?: string }>();
  const isCoachView = Boolean(params.clientId);
  const { client, profile } = useAuth();
  const theme = useTheme();
  const colors = theme.colors;
  const isDark = isDarkColor(colors.background || '#020617');

  const [clientInfo, setClientInfo] = useState<{ name?: string; avatar?: string }>({
    name: params.name,
    avatar: params.avatar,
  });

  useEffect(() => {
    if (params.clientId && (!params.name || !params.avatar)) {
      supabase
        .from('clients')
        .select('profiles(full_name, avatar_url)')
        .eq('id', params.clientId)
        .maybeSingle()
        .then(({ data }) => {
          if (data && (data as any).profiles) {
            setClientInfo({
              name: (data as any).profiles.full_name || 'Athlete',
              avatar: (data as any).profiles.avatar_url || '',
            });
          }
        });
    }
  }, [params.clientId, params.name, params.avatar]);

  const textColor = colors.text || (isDark ? '#FFFFFF' : '#0F172A');
  const textSecondary = colors.textSecondary || (isDark ? '#94A3B8' : '#64748B');
  const cardBg = colors.surface || (isDark ? '#0F172A' : '#FFFFFF');
  const cardBorder = colors.border || (isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0');

  const [dailyLogs, setDailyLogs] = useState<DailyLogEntry[]>([]);
  const [checkIns, setCheckIns] = useState<CheckInEntry[]>([]);
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [targetCalories, setTargetCalories] = useState<number>(2000);
  const [todayActiveBurn, setTodayActiveBurn] = useState<number | null>(null);
  const [messageFabPressed, setMessageFabPressed] = useState(false);

  const targetClientId = (params.clientId as string) || client?.id;

  useEffect(() => {
    if (targetClientId) {
      loadData();
    }
  }, [targetClientId, profile]);

  const loadData = async () => {
    if (!targetClientId) return;

    const todayStr = getLocalDateString(new Date());
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    const startDateStr = getLocalDateString(startDate);

    try {
      const clientIds = [targetClientId];
      if (!isCoachView && profile?.id && profile.id !== targetClientId) {
        clientIds.push(profile.id);
      }

      const [
        logsRes,
        checkInsRes,
        liveSteps,
        liveSleep,
        liveWeight,
        liveActiveEnergy,
        localStepsStr,
        mealsRes,
        mealPlanRes,
      ] = await Promise.all([
        supabase
          .from('daily_logs')
          .select('date, steps, sleep_hours, active_minutes, client_id')
          .in('client_id', clientIds)
          .gte('date', startDateStr)
          .order('date', { ascending: true }),
        supabase
          .from('check_ins')
          .select('date, weight_kg, energy_level, stress_level, hunger_level, client_id')
          .in('client_id', clientIds)
          .gte('date', startDateStr)
          .order('date', { ascending: true }),
        isCoachView ? Promise.resolve(null) : getTodaySteps(),
        isCoachView ? Promise.resolve(null) : getLastNightSleep(),
        isCoachView ? Promise.resolve(null) : getLatestWeight(),
        isCoachView ? Promise.resolve(null) : getTodayActiveEnergy(),
        isCoachView ? Promise.resolve(null) : AsyncStorage.getItem(`@steps_${todayStr}`),
        supabase
          .from('meals')
          .select('id, meal_date, meal_name, calories, protein_g, carbs_g, fat_g, photo_url')
          .in('client_id', clientIds)
          .gte('meal_date', startDateStr)
          .order('meal_date', { ascending: true }),
        supabase
          .from('meal_plans')
          .select('daily_calories, meals_data')
          .in('client_id', clientIds)
          .eq('status', 'active')
          .maybeSingle(),
      ]);

      if (liveActiveEnergy !== null) {
        setTodayActiveBurn(liveActiveEnergy);
      }

      if (mealsRes.data) {
        setMeals(mealsRes.data as MealEntry[]);
      }
      if (mealPlanRes.data?.daily_calories) {
        setTargetCalories(Number(mealPlanRes.data.daily_calories));
      }

      const fetchedLogs: DailyLogEntry[] = [...(logsRes.data || [])];
      const fetchedCheckIns: CheckInEntry[] = [...(checkInsRes.data || [])];

      if (!isCoachView) {
        // Merge live steps for today so today is always fresh for the client
        const currentTodaySteps = Math.max(
          liveSteps || 0,
          localStepsStr ? parseInt(localStepsStr, 10) : 0
        );

        const todayLogIdx = fetchedLogs.findIndex((l) => l.date === todayStr);
        if (todayLogIdx >= 0) {
          if (currentTodaySteps > (fetchedLogs[todayLogIdx].steps || 0)) {
            fetchedLogs[todayLogIdx].steps = currentTodaySteps;
          }
          if (liveSleep && !fetchedLogs[todayLogIdx].sleep_hours) {
            fetchedLogs[todayLogIdx].sleep_hours = liveSleep;
          }
        } else if (currentTodaySteps > 0 || liveSleep) {
          fetchedLogs.push({
            date: todayStr,
            steps: currentTodaySteps,
            sleep_hours: liveSleep || undefined,
          });
        }

        // Merge live weight if present
        if (liveWeight) {
          const todayCiIdx = fetchedCheckIns.findIndex((c) => c.date === todayStr);
          if (todayCiIdx >= 0) {
            if (!fetchedCheckIns[todayCiIdx].weight_kg) {
              fetchedCheckIns[todayCiIdx].weight_kg = liveWeight;
            }
          } else {
            fetchedCheckIns.push({
              date: todayStr,
              weight_kg: liveWeight,
            });
          }
        }
      }

      setDailyLogs(fetchedLogs);
      setCheckIns(fetchedCheckIns);
    } catch (e) {
      console.warn('Analytics overview load failed:', e);
    }
  };

  const todayStr = useMemo(() => getLocalDateString(new Date()), []);

  const todayMeals = useMemo(() => {
    return meals.filter((m) => m.meal_date === todayStr);
  }, [meals, todayStr]);

  const todayCaloriesEaten = useMemo(() => {
    return todayMeals.reduce((sum, m) => sum + (m.calories || 0), 0);
  }, [todayMeals]);

  const hasMealsLogged = todayMeals.length > 0;

  const latestStepsVal = useMemo(() => {
    const todayLog = dailyLogs.find((l) => l.date === todayStr);
    if (todayLog?.steps && todayLog.steps > 0) return todayLog.steps;
    const latest = [...dailyLogs].reverse().find((l) => (l.steps || 0) > 0);
    return latest?.steps || 0;
  }, [dailyLogs, todayStr]);

  const latestSleepVal = useMemo(() => {
    const todayLog = dailyLogs.find((l) => l.date === todayStr);
    if (todayLog?.sleep_hours && todayLog.sleep_hours > 0) return todayLog.sleep_hours;
    const latest = [...dailyLogs].reverse().find((l) => (l.sleep_hours || 0) > 0);
    return latest?.sleep_hours || 0;
  }, [dailyLogs, todayStr]);

  const latestWeightVal = useMemo(() => {
    const todayCi = checkIns.find((c) => c.date === todayStr);
    if (todayCi?.weight_kg && todayCi.weight_kg > 0) return todayCi.weight_kg;
    const latest = [...checkIns].reverse().find((c) => (c.weight_kg || 0) > 0);
    return latest?.weight_kg || 0;
  }, [checkIns, todayStr]);

  const latestEnergyVal = useMemo(() => {
    const todayCi = checkIns.find((c) => c.date === todayStr);
    if (todayCi?.energy_level && todayCi.energy_level > 0) return todayCi.energy_level;
    const latest = [...checkIns].reverse().find((c) => (c.energy_level || 0) > 0);
    return latest?.energy_level || 0;
  }, [checkIns, todayStr]);

  const recent7Days = useMemo(() => {
    const dates: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(getLocalDateString(d));
    }
    return dates;
  }, []);

  const nowTimeStr = useMemo(() => {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }, []);

  const stepsCardData = useMemo(() => {
    const values = recent7Days.map((dateStr, idx) => {
      const log = dailyLogs.find((l) => l.date === dateStr);
      if (log?.steps && log.steps > 0) return log.steps;
      if (idx === 6) return latestStepsVal;
      return 0;
    });

    const latestLog = [...dailyLogs].reverse().find((l) => (l.steps || 0) > 0);
    const timeStr = latestLog?.date === todayStr ? nowTimeStr : (latestLog ? new Date(latestLog.date).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'Today');

    return {
      val: latestStepsVal,
      timeStr,
      chartData: values,
    };
  }, [recent7Days, dailyLogs, latestStepsVal, todayStr, nowTimeStr]);

  const sleepCardData = useMemo(() => {
    const values = recent7Days.map((dateStr, idx) => {
      const log = dailyLogs.find((l) => l.date === dateStr);
      if (log?.sleep_hours && log.sleep_hours > 0) return log.sleep_hours;
      if (idx === 6) return latestSleepVal;
      return 0;
    });

    const latestLog = [...dailyLogs].reverse().find((l) => (l.sleep_hours || 0) > 0);
    const timeStr = latestLog
      ? new Date(latestLog.date).toLocaleDateString([], { month: 'short', day: 'numeric' })
      : 'Last Night';

    return {
      val: latestSleepVal,
      timeStr,
      chartData: values,
    };
  }, [recent7Days, dailyLogs, latestSleepVal]);

  const weightCardData = useMemo(() => {
    const values = recent7Days.map((dateStr, idx) => {
      const ci = checkIns.find((c) => c.date === dateStr);
      if (ci?.weight_kg && ci.weight_kg > 0) return ci.weight_kg;
      if (idx === 6) return latestWeightVal;
      return 0;
    });

    const latestCi = [...checkIns].reverse().find((c) => (c.weight_kg || 0) > 0);
    const timeStr = latestCi
      ? new Date(latestCi.date).toLocaleDateString([], { month: 'short', day: 'numeric' })
      : 'Latest';

    return {
      val: latestWeightVal,
      timeStr,
      chartData: values,
    };
  }, [recent7Days, checkIns, latestWeightVal]);

  const energyCardData = useMemo(() => {
    const values = recent7Days.map((dateStr, idx) => {
      const ci = checkIns.find((c) => c.date === dateStr);
      if (ci?.energy_level && ci.energy_level > 0) return ci.energy_level;
      if (idx === 6) return latestEnergyVal;
      return 0;
    });

    const latestCi = [...checkIns].reverse().find((c) => (c.energy_level || 0) > 0);
    const timeStr = latestCi
      ? new Date(latestCi.date).toLocaleDateString([], { month: 'short', day: 'numeric' })
      : 'Today';

    return {
      val: latestEnergyVal,
      timeStr,
      chartData: values,
    };
  }, [recent7Days, checkIns, latestEnergyVal]);

  const foodCardData = useMemo(() => {
    const values = recent7Days.map((dateStr) => {
      const dayMeals = meals.filter((m) => m.meal_date === dateStr);
      return dayMeals.reduce((sum, m) => sum + (m.calories || 0), 0);
    });

    const todayMeals = meals.filter((m) => m.meal_date === todayStr);
    const todayCal = todayMeals.reduce((sum, m) => sum + (m.calories || 0), 0);

    const latestLoggedDay = [...recent7Days].reverse().find((d) => {
      return meals.some((m) => m.meal_date === d && (m.calories || 0) > 0);
    });

    const displayVal =
      todayCal > 0
        ? todayCal
        : latestLoggedDay
          ? values[recent7Days.indexOf(latestLoggedDay)]
          : 0;

    const loggedDays = values.filter((v) => v > 0).length || 1;
    const totalProtein = recent7Days.reduce((acc, d) => {
      const dayMeals = meals.filter((m) => m.meal_date === d);
      return acc + dayMeals.reduce((sum, m) => sum + (m.protein_g || 0), 0);
    }, 0);
    const avgProtein = Math.round(totalProtein / loggedDays);

    const timeStr =
      todayCal > 0
        ? nowTimeStr
        : latestLoggedDay
          ? new Date(latestLoggedDay).toLocaleDateString([], {
              month: 'short',
              day: 'numeric',
            })
          : 'Today';

    return {
      val: displayVal,
      targetCal: targetCalories,
      avgProtein,
      timeStr,
      chartData: values,
    };
  }, [recent7Days, meals, todayStr, nowTimeStr, targetCalories]);

  const navigateToMetric = (
    metric: 'steps' | 'sleep' | 'weight' | 'energy' | 'nutrition',
  ) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const clientParam = params.clientId 
      ? `&clientId=${params.clientId}&name=${encodeURIComponent(clientInfo.name || params.name || '')}&avatar=${encodeURIComponent(clientInfo.avatar || params.avatar || '')}` 
      : '';
    router.push(
      `/(client)/analytics-detail?metric=${metric}${clientParam}` as any,
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Top Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 12,
            borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
          },
        ]}
      >
        {isCoachView ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 }}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Go back"
              activeOpacity={0.7}
              onPress={() => router.back()}
              style={[
                styles.backButton,
                {
                  backgroundColor: cardBg,
                  borderColor: cardBorder,
                },
              ]}
            >
              <ChevronLeft size={22} color={textColor} />
            </TouchableOpacity>

            <BrandedAvatar
              name={clientInfo.name || params.name || 'Athlete'}
              size={40}
              imageUrl={clientInfo.avatar || params.avatar || undefined}
            />

            <View style={{ flex: 1 }}>
              <Text style={[styles.headerTitle, { color: textColor, textAlign: 'left' }]}>
                Analytics
              </Text>
              <Text style={[styles.headerSubtitle, { color: textSecondary, textAlign: 'left' }]}>
                {clientInfo.name || params.name || 'Athlete'}
              </Text>
            </View>
          </View>
        ) : (
          <>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.back()}
              style={[
                styles.backButton,
                {
                  backgroundColor: cardBg,
                  borderColor: cardBorder,
                },
              ]}
            >
              <ChevronLeft size={22} color={textColor} />
            </TouchableOpacity>

            <View style={styles.headerTitleContainer}>
              <Text style={[styles.headerTitle, { color: textColor }]}>
                Analytics
              </Text>
              <Text style={[styles.headerSubtitle, { color: textSecondary }]}>
                Overview
              </Text>
            </View>

            <View style={styles.headerRightSpacer} />
          </>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Today's Summary Grid */}
        <View style={styles.statsGrid}>
          {/* Active Burn */}
          <View
            style={[
              styles.statBox,
              {
                backgroundColor: cardBg,
                borderColor: cardBorder,
              },
            ]}
          >
            <View style={[styles.statIconWrap, { backgroundColor: `${colors.accent || '#F97316'}16` }]}>
              <Flame size={18} color={colors.accent || '#F97316'} />
            </View>
            <Text style={[styles.statBoxValue, { color: textColor }]}>
              {todayActiveBurn && todayActiveBurn > 0 ? `${todayActiveBurn.toLocaleString()} kcal` : '0 kcal'}
            </Text>
            <Text style={[styles.statBoxLabel, { color: textSecondary }]}>
              Active Burn
            </Text>
          </View>

          {/* Calories Eaten */}
          <View
            style={[
              styles.statBox,
              {
                backgroundColor: cardBg,
                borderColor: cardBorder,
              },
            ]}
          >
            <View style={[styles.statIconWrap, { backgroundColor: `${colors.primary}16` }]}>
              <Utensils size={18} color={colors.primary} />
            </View>
            <Text
              style={[
                styles.statBoxValue,
                { color: textColor },
                !hasMealsLogged && { fontSize: 13, fontWeight: '700' },
              ]}
              numberOfLines={1}
            >
              {hasMealsLogged ? `${Math.round(todayCaloriesEaten).toLocaleString()} kcal` : 'Not logged yet'}
            </Text>
            <Text style={[styles.statBoxLabel, { color: textSecondary }]}>
              Food Eaten
            </Text>
          </View>
        </View>

        {/* 4 Clickable Metric Cards (All harmonized to coach's brand colors) */}
        <View style={styles.cardsStack}>
          {/* Steps Card */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigateToMetric('steps')}
            style={[
              styles.metricCard,
              {
                backgroundColor: cardBg,
                borderColor: cardBorder,
              },
            ]}
          >
            <View style={styles.metricCardHeader}>
              <View style={styles.metricCardTitleRow}>
                <View style={[styles.cardIconBadge, { backgroundColor: `${colors.primary}16` }]}>
                  <Flame size={18} color={colors.primary} />
                </View>
                <Text style={[styles.metricCardTitle, { color: textColor }]}>
                  Steps
                </Text>
              </View>
              <View style={styles.metricCardRightRow}>
                <Text style={[styles.metricCardTime, { color: textSecondary }]}>
                  {stepsCardData.timeStr}
                </Text>
                <ChevronRight size={18} color={textSecondary} />
              </View>
            </View>

            <View style={styles.metricCardContent}>
              <View style={styles.metricCardValueRow}>
                <Text style={[styles.metricCardValue, { color: textColor }]}>
                  {stepsCardData.val.toLocaleString()}
                </Text>
                <Text style={[styles.metricCardUnit, { color: textSecondary }]}>
                  steps
                </Text>
              </View>

              <MiniBarChart data={stepsCardData.chartData} color={colors.primary} isDark={isDark} />
            </View>
          </TouchableOpacity>

          {/* Sleep Card */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigateToMetric('sleep')}
            style={[
              styles.metricCard,
              {
                backgroundColor: cardBg,
                borderColor: cardBorder,
              },
            ]}
          >
            <View style={styles.metricCardHeader}>
              <View style={styles.metricCardTitleRow}>
                <View style={[styles.cardIconBadge, { backgroundColor: `${colors.primary}16` }]}>
                  <Moon size={18} color={colors.primary} />
                </View>
                <Text style={[styles.metricCardTitle, { color: textColor }]}>
                  Sleep
                </Text>
              </View>
              <View style={styles.metricCardRightRow}>
                <Text style={[styles.metricCardTime, { color: textSecondary }]}>
                  {sleepCardData.timeStr}
                </Text>
                <ChevronRight size={18} color={textSecondary} />
              </View>
            </View>

            <View style={styles.metricCardContent}>
              <View style={styles.metricCardValueRow}>
                <Text style={[styles.metricCardValue, { color: textColor }]}>
                  {typeof sleepCardData.val === 'number' ? sleepCardData.val.toFixed(1) : sleepCardData.val}
                </Text>
                <Text style={[styles.metricCardUnit, { color: textSecondary }]}>
                  hrs
                </Text>
              </View>

              <MiniBarChart data={sleepCardData.chartData} color={colors.primary} isDark={isDark} />
            </View>
          </TouchableOpacity>

          {/* Weight Card */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigateToMetric('weight')}
            style={[
              styles.metricCard,
              {
                backgroundColor: cardBg,
                borderColor: cardBorder,
              },
            ]}
          >
            <View style={styles.metricCardHeader}>
              <View style={styles.metricCardTitleRow}>
                <View style={[styles.cardIconBadge, { backgroundColor: `${colors.primary}16` }]}>
                  <Scale size={18} color={colors.primary} />
                </View>
                <Text style={[styles.metricCardTitle, { color: textColor }]}>
                  Weight
                </Text>
              </View>
              <View style={styles.metricCardRightRow}>
                <Text style={[styles.metricCardTime, { color: textSecondary }]}>
                  {weightCardData.timeStr}
                </Text>
                <ChevronRight size={18} color={textSecondary} />
              </View>
            </View>

            <View style={styles.metricCardContent}>
              <View style={styles.metricCardValueRow}>
                <Text style={[styles.metricCardValue, { color: textColor }]}>
                  {typeof weightCardData.val === 'number' && weightCardData.val > 0
                    ? weightCardData.val.toFixed(1)
                    : '--'}
                </Text>
                <Text style={[styles.metricCardUnit, { color: textSecondary }]}>
                  kg
                </Text>
              </View>

              <MiniBarChart data={weightCardData.chartData} color={colors.primary} isDark={isDark} />
            </View>
          </TouchableOpacity>

          {/* Energy Card */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigateToMetric('energy')}
            style={[
              styles.metricCard,
              {
                backgroundColor: cardBg,
                borderColor: cardBorder,
              },
            ]}
          >
            <View style={styles.metricCardHeader}>
              <View style={styles.metricCardTitleRow}>
                <View style={[styles.cardIconBadge, { backgroundColor: `${colors.primary}16` }]}>
                  <Zap size={18} color={colors.primary} />
                </View>
                <Text style={[styles.metricCardTitle, { color: textColor }]}>
                  Energy
                </Text>
              </View>
              <View style={styles.metricCardRightRow}>
                <Text style={[styles.metricCardTime, { color: textSecondary }]}>
                  {energyCardData.timeStr}
                </Text>
                <ChevronRight size={18} color={textSecondary} />
              </View>
            </View>

            <View style={styles.metricCardContent}>
              <View style={styles.metricCardValueRow}>
                <Text style={[styles.metricCardValue, { color: textColor }]}>
                  {energyCardData.val > 0 ? energyCardData.val : '--'}
                </Text>
                <Text style={[styles.metricCardUnit, { color: textSecondary }]}>
                  / 10
                </Text>
              </View>

              <MiniBarChart data={energyCardData.chartData} color={colors.primary} isDark={isDark} />
            </View>
          </TouchableOpacity>

          {/* Food Card */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigateToMetric('nutrition')}
            style={[
              styles.metricCard,
              {
                backgroundColor: cardBg,
                borderColor: cardBorder,
              },
            ]}
          >
            <View style={styles.metricCardHeader}>
              <View style={styles.metricCardTitleRow}>
                <View style={[styles.cardIconBadge, { backgroundColor: `${colors.primary}16` }]}>
                  <Utensils size={18} color={colors.primary} />
                </View>
                <Text style={[styles.metricCardTitle, { color: textColor }]}>
                  Food
                </Text>
              </View>
              <View style={styles.metricCardRightRow}>
                <Text style={[styles.metricCardTime, { color: textSecondary }]}>
                  {foodCardData.timeStr}
                </Text>
                <ChevronRight size={18} color={textSecondary} />
              </View>
            </View>

            <View style={styles.metricCardContent}>
              <View style={styles.metricCardValueRow}>
                <Text style={[styles.metricCardValue, { color: textColor }]}>
                  {foodCardData.val > 0 ? foodCardData.val.toLocaleString() : '--'}
                </Text>
                <Text style={[styles.metricCardUnit, { color: textSecondary }]}>
                  kcal
                </Text>
              </View>

              <MiniBarChart data={foodCardData.chartData} color={colors.primary} isDark={isDark} />
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Floating Message Button for Coach */}
      {isCoachView && Boolean(params.clientId) && (
        <MotiView
          animate={{ scale: messageFabPressed ? 0.82 : 1 }}
          transition={{ type: 'spring', damping: 14, stiffness: 320 } as any}
          style={{
            position: 'absolute',
            bottom: insets.bottom + 24,
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
                params: { id: params.clientId as string },
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
  );
}

// ─── Mini Bar Chart for Metric Overview Cards ──────────────────────────────
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
    <View style={styles.miniBarContainer}>
      {points.map((val, idx) => {
        const isLast = idx === points.length - 1;
        const barHeight = val > 0 ? Math.max(8, (val / max) * 36) : 6;
        return (
          <View
            key={idx}
            style={[
              styles.miniBar,
              {
                height: barHeight,
                backgroundColor: isLast ? color : inactiveColor,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  headerTitleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginTop: 2,
  },
  headerRightSpacer: {
    width: 44,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 60,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 18,
  },
  statBox: {
    flex: 1,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  statBoxValue: {
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  statBoxLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 3,
  },
  cardsStack: {
    gap: 14,
  },
  metricCard: {
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingVertical: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  metricCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metricCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricCardTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  metricCardRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricCardTime: {
    fontSize: 13,
    fontWeight: '600',
  },
  metricCardContent: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 18,
  },
  metricCardValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  metricCardValue: {
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  metricCardUnit: {
    fontSize: 16,
    fontWeight: '700',
  },
  miniBarContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 40,
    gap: 4,
  },
  miniBar: {
    width: 6,
    borderRadius: 3,
  },
});
