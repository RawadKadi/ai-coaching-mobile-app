import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Dimensions,
  StyleSheet,
  Animated,
  AccessibilityInfo,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Path,
  Rect,
  Line,
  Circle,
  Defs,
  LinearGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { ChevronLeft, Utensils } from 'lucide-react-native';
import { Image } from 'expo-image';
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
} from '@/lib/health-service';
import { BrandedAvatar } from '@/components/BrandedAvatar';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_HEIGHT = 200;

export type MetricTab = 'steps' | 'sleep' | 'weight' | 'energy' | 'nutrition';
export type TimeRange = 'Day' | 'Week' | 'Month' | '6M' | '1Y';

const TIME_RANGES: { key: TimeRange; label: string }[] = [
  { key: 'Day', label: 'D' },
  { key: 'Week', label: 'W' },
  { key: 'Month', label: 'M' },
  { key: '6M', label: '6M' },
  { key: '1Y', label: 'Y' },
];

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

/** Formats a date as YYYY-MM-DD in local time */
function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function AnalyticsDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ metric?: string; clientId?: string; name?: string; avatar?: string }>();
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

  const activeMetric: MetricTab = (
    params.metric && ['steps', 'sleep', 'weight', 'energy', 'nutrition'].includes(params.metric)
      ? params.metric
      : 'steps'
  ) as MetricTab;

  const [timeRange, setTimeRange] = useState<TimeRange>('Week');
  const [loading, setLoading] = useState(true);
  const [dailyLogs, setDailyLogs] = useState<DailyLogEntry[]>([]);
  const [checkIns, setCheckIns] = useState<CheckInEntry[]>([]);
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [targetCalories, setTargetCalories] = useState<number>(2000);
  const [targetProtein, setTargetProtein] = useState<number>(140);
  const [targetCarbs, setTargetCarbs] = useState<number>(200);
  const [targetFat, setTargetFat] = useState<number>(65);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // Dynamic measured width for the chart inside chartSurface
  const [chartInnerWidth, setChartInnerWidth] = useState<number>(() => Math.max(280, SCREEN_WIDTH - 80));

  const targetClientId = (params.clientId as string) || client?.id;

  const daysCount = useMemo(() => {
    switch (timeRange) {
      case 'Day':
        return 1;
      case 'Week':
        return 7;
      case 'Month':
        return 30;
      case '6M':
        return 180;
      case '1Y':
        return 365;
      default:
        return 7;
    }
  }, [timeRange]);

  useEffect(() => {
    if (targetClientId) {
      loadData();
    }
  }, [targetClientId, profile, timeRange]);

  const loadData = async () => {
    if (!targetClientId) return;
    setLoading(true);
    setSelectedIndex(null);

    const todayStr = getLocalDateString(new Date());
    const querySpan = Math.max(daysCount > 1 ? daysCount : 7, 30);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - querySpan);
    const startDateStr = getLocalDateString(startDate);

    try {
      const clientIds = [targetClientId];
      if (!isCoachView && profile?.id && profile.id !== targetClientId) {
        clientIds.push(profile.id);
      }

      const [
        logsRes,
        checkInsRes,
        mealsRes,
        planRes,
        liveSteps,
        liveSleep,
        liveWeight,
        localStepsStr,
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
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        isCoachView ? Promise.resolve(null) : getTodaySteps(),
        isCoachView ? Promise.resolve(null) : getLastNightSleep(),
        isCoachView ? Promise.resolve(null) : getLatestWeight(),
        isCoachView ? Promise.resolve(null) : AsyncStorage.getItem(`@steps_${todayStr}`),
      ]);

      const fetchedLogs: DailyLogEntry[] = [...(logsRes.data || [])];
      const fetchedCheckIns: CheckInEntry[] = [...(checkInsRes.data || [])];
      const fetchedMeals: MealEntry[] = [...(mealsRes.data || [])];

      if (planRes?.data) {
        if (planRes.data.daily_calories && planRes.data.daily_calories > 0) {
          setTargetCalories(planRes.data.daily_calories);
        }
        const mData = planRes.data.meals_data;
        if (mData?.target_protein) setTargetProtein(Number(mData.target_protein));
        if (mData?.target_carbs) setTargetCarbs(Number(mData.target_carbs));
        if (mData?.target_fat) setTargetFat(Number(mData.target_fat));
      }

      if (!isCoachView) {
        // Merge live steps for today so today is always fresh
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
      setMeals(fetchedMeals);
    } catch (e) {
      console.warn('Analytics detail load failed:', e);
    } finally {
      setLoading(false);
    }
  };

  const metricLabel = useMemo(() => {
    switch (activeMetric) {
      case 'steps':
        return 'Steps';
      case 'sleep':
        return 'Sleep';
      case 'weight':
        return 'Weight';
      case 'energy':
        return 'Energy';
      case 'nutrition':
        return 'Food';
    }
  }, [activeMetric]);

  const todayStr = useMemo(() => getLocalDateString(new Date()), []);

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

  // ─── Continuous Time Series for Selected Metric Graph ─────────────────────
  const chartPoints = useMemo(() => {
    const list: { label: string; date: string; value: number; secondary?: number }[] = [];

    // ── 1. DAY FILTER (6 Time Slots for Today) ──────────────────────────────
    if (timeRange === 'Day') {
      const intervals = [
        { label: '4 AM', hour: 4 },
        { label: '8 AM', hour: 8 },
        { label: '12 PM', hour: 12 },
        { label: '4 PM', hour: 16 },
        { label: '8 PM', hour: 20 },
        { label: '11 PM', hour: 23 },
      ];

      const currentHour = new Date().getHours();

      intervals.forEach((slot) => {
        let val = 0;
        let sec = 0;

        if (activeMetric === 'steps') {
          if (slot.hour <= currentHour) {
            const fraction = Math.min(1, slot.hour / Math.max(1, currentHour));
            val = Math.round(latestStepsVal * fraction);
          } else {
            val = 0;
          }
        } else if (activeMetric === 'sleep') {
          val = slot.hour <= 8 ? latestSleepVal : 0;
        } else if (activeMetric === 'weight') {
          val = latestWeightVal;
        } else if (activeMetric === 'energy') {
          val = latestEnergyVal;
          sec = 3;
        } else if (activeMetric === 'nutrition') {
          const todayMeals = meals.filter((m) => m.meal_date === todayStr);
          const totalDayCal = todayMeals.reduce((acc, m) => acc + (m.calories || 0), 0);
          if (slot.hour <= currentHour) {
            const fraction = Math.min(1, slot.hour / Math.max(1, currentHour));
            val = Math.round(totalDayCal * fraction);
          } else {
            val = 0;
          }
        }

        list.push({
          label: slot.label,
          date: todayStr,
          value: val,
          secondary: sec,
        });
      });

      return list;
    }

    // ── 2. WEEK FILTER (7 Days: Mon-Sun) ────────────────────────────────────
    if (timeRange === 'Week') {
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = getLocalDateString(d);
        const weekday = d.toLocaleDateString([], { weekday: 'short' });

        let val = 0;
        let sec = 0;

        if (activeMetric === 'steps') {
          const log = dailyLogs.find((l) => l.date === dateStr);
          if (log?.steps && log.steps > 0) {
            val = log.steps;
          } else if (i === 0) {
            val = latestStepsVal;
          } else {
            val = 0;
          }
        } else if (activeMetric === 'sleep') {
          const log = dailyLogs.find((l) => l.date === dateStr);
          if (log?.sleep_hours && log.sleep_hours > 0) {
            val = log.sleep_hours;
          } else if (i === 0) {
            val = latestSleepVal;
          } else {
            val = 0;
          }
        } else if (activeMetric === 'weight') {
          const ci = checkIns.find((c) => c.date === dateStr);
          if (ci?.weight_kg && ci.weight_kg > 0) {
            val = ci.weight_kg;
          } else {
            val = latestWeightVal;
          }
        } else if (activeMetric === 'energy') {
          const ci = checkIns.find((c) => c.date === dateStr);
          val = ci?.energy_level || 0;
          sec = ci?.stress_level || 0;
        } else if (activeMetric === 'nutrition') {
          const dayMeals = meals.filter((m) => m.meal_date === dateStr);
          val = dayMeals.reduce((acc, m) => acc + (m.calories || 0), 0);
        }

        list.push({
          label: weekday,
          date: dateStr,
          value: val,
          secondary: sec,
        });
      }

      return list;
    }

    // ── 3. MONTH FILTER (30 Days) ──────────────────────────────────────────
    if (timeRange === 'Month') {
      for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = getLocalDateString(d);
        const dayNumber = String(d.getDate());

        let val = 0;
        let sec = 0;

        if (activeMetric === 'steps') {
          const log = dailyLogs.find((l) => l.date === dateStr);
          if (log?.steps && log.steps > 0) {
            val = log.steps;
          } else if (i === 0) {
            val = latestStepsVal;
          } else {
            val = 0;
          }
        } else if (activeMetric === 'sleep') {
          const log = dailyLogs.find((l) => l.date === dateStr);
          if (log?.sleep_hours && log.sleep_hours > 0) {
            val = log.sleep_hours;
          } else if (i === 0) {
            val = latestSleepVal;
          } else {
            val = 0;
          }
        } else if (activeMetric === 'weight') {
          const ci = checkIns.find((c) => c.date === dateStr);
          if (ci?.weight_kg && ci.weight_kg > 0) {
            val = ci.weight_kg;
          } else {
            val = latestWeightVal;
          }
        } else if (activeMetric === 'energy') {
          const ci = checkIns.find((c) => c.date === dateStr);
          val = ci?.energy_level || 0;
          sec = ci?.stress_level || 0;
        } else if (activeMetric === 'nutrition') {
          const dayMeals = meals.filter((m) => m.meal_date === dateStr);
          val = dayMeals.reduce((acc, m) => acc + (m.calories || 0), 0);
        }

        list.push({
          label: dayNumber,
          date: dateStr,
          value: val,
          secondary: sec,
        });
      }

      return list;
    }

    // ── 4. 6M FILTER (24 Weekly Buckets) ───────────────────────────────────
    if (timeRange === '6M') {
      const weeksCount = 24;
      for (let i = weeksCount - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i * 7);
        const dateStr = getLocalDateString(d);
        const monthDay = d.toLocaleDateString([], { month: 'numeric', day: 'numeric' });

        const windowStart = new Date(d);
        windowStart.setDate(windowStart.getDate() - 6);
        const startStr = getLocalDateString(windowStart);

        let val = 0;
        let sec = 0;

        if (activeMetric === 'steps') {
          const matching = dailyLogs.filter((l) => l.date >= startStr && l.date <= dateStr && (l.steps || 0) > 0);
          if (matching.length > 0) {
            val = Math.round(matching.reduce((acc, l) => acc + (l.steps || 0), 0) / matching.length);
          } else if (i === 0) {
            val = latestStepsVal;
          } else {
            val = 0;
          }
        } else if (activeMetric === 'sleep') {
          const matching = dailyLogs.filter((l) => l.date >= startStr && l.date <= dateStr && (l.sleep_hours || 0) > 0);
          if (matching.length > 0) {
            val = Number((matching.reduce((acc, l) => acc + (l.sleep_hours || 0), 0) / matching.length).toFixed(1));
          } else if (i === 0) {
            val = latestSleepVal;
          } else {
            val = 0;
          }
        } else if (activeMetric === 'weight') {
          const matching = checkIns.filter((c) => c.date >= startStr && c.date <= dateStr && (c.weight_kg || 0) > 0);
          if (matching.length > 0) {
            val = matching[matching.length - 1].weight_kg || 0;
          } else {
            val = latestWeightVal;
          }
        } else if (activeMetric === 'energy') {
          const matching = checkIns.filter((c) => c.date >= startStr && c.date <= dateStr && (c.energy_level || 0) > 0);
          if (matching.length > 0) {
            val = Math.round(matching.reduce((acc, c) => acc + (c.energy_level || 0), 0) / matching.length);
            sec = Math.round(matching.reduce((acc, c) => acc + (c.stress_level || 0), 0) / matching.length);
          } else if (i === 0) {
            val = latestEnergyVal;
          }
        } else if (activeMetric === 'nutrition') {
          const matching = meals.filter((m) => m.meal_date >= startStr && m.meal_date <= dateStr && (m.calories || 0) > 0);
          const distinctDays = new Set(matching.map((m) => m.meal_date)).size;
          if (distinctDays > 0) {
            val = Math.round(matching.reduce((acc, m) => acc + (m.calories || 0), 0) / distinctDays);
          } else {
            val = 0;
          }
        }

        list.push({
          label: monthDay,
          date: dateStr,
          value: val,
          secondary: sec,
        });
      }

      return list;
    }

    // ── 5. 1Y FILTER (12 Monthly Buckets) ──────────────────────────────────
    if (timeRange === '1Y') {
      for (let i = 11; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const monthLabel = d.toLocaleDateString([], { month: 'short' });
        const yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

        let val = 0;
        let sec = 0;

        if (activeMetric === 'steps') {
          const matching = dailyLogs.filter((l) => l.date.startsWith(yearMonth) && (l.steps || 0) > 0);
          if (matching.length > 0) {
            val = Math.round(matching.reduce((acc, l) => acc + (l.steps || 0), 0) / matching.length);
          } else if (i === 0) {
            val = latestStepsVal;
          } else {
            val = 0;
          }
        } else if (activeMetric === 'sleep') {
          const matching = dailyLogs.filter((l) => l.date.startsWith(yearMonth) && (l.sleep_hours || 0) > 0);
          if (matching.length > 0) {
            val = Number((matching.reduce((acc, l) => acc + (l.sleep_hours || 0), 0) / matching.length).toFixed(1));
          } else if (i === 0) {
            val = latestSleepVal;
          } else {
            val = 0;
          }
        } else if (activeMetric === 'weight') {
          const matching = checkIns.filter((c) => c.date.startsWith(yearMonth) && (c.weight_kg || 0) > 0);
          if (matching.length > 0) {
            val = matching[matching.length - 1].weight_kg || 0;
          } else {
            val = latestWeightVal;
          }
        } else if (activeMetric === 'energy') {
          const matching = checkIns.filter((c) => c.date.startsWith(yearMonth) && (c.energy_level || 0) > 0);
          if (matching.length > 0) {
            val = Math.round(matching.reduce((acc, c) => acc + (c.energy_level || 0), 0) / matching.length);
            sec = Math.round(matching.reduce((acc, c) => acc + (c.stress_level || 0), 0) / matching.length);
          } else if (i === 0) {
            val = latestEnergyVal;
          }
        } else if (activeMetric === 'nutrition') {
          const matching = meals.filter((m) => m.meal_date.startsWith(yearMonth) && (m.calories || 0) > 0);
          const distinctDays = new Set(matching.map((m) => m.meal_date)).size;
          if (distinctDays > 0) {
            val = Math.round(matching.reduce((acc, m) => acc + (m.calories || 0), 0) / distinctDays);
          } else {
            val = 0;
          }
        }

        list.push({
          label: monthLabel,
          date: `${yearMonth}-01`,
          value: val,
          secondary: sec,
        });
      }

      return list;
    }

    return list;
  }, [
    timeRange,
    activeMetric,
    dailyLogs,
    checkIns,
    meals,
    latestStepsVal,
    latestSleepVal,
    latestWeightVal,
    latestEnergyVal,
    todayStr,
  ]);

  const activePoints = chartPoints.filter((p) => p.value > 0);

  // Key summary statistics
  const summary = useMemo(() => {
    const totalCount = chartPoints.length;
    const values = activePoints.map((p) => p.value);
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = values.length > 0 ? sum / values.length : 0;
    const max = values.length > 0 ? Math.max(...values) : 0;

    if (activeMetric === 'steps') {
      const metGoal = values.filter((v) => v >= 10000).length;
      return {
        stat1Label: 'Average',
        stat1Value: values.length > 0 ? `${Math.round(avg).toLocaleString()}` : '0',
        stat2Label: 'Peak',
        stat2Value: values.length > 0 ? `${max.toLocaleString()}` : '0',
        stat3Label: 'Goal Met',
        stat3Value: `${metGoal} / ${totalCount}`,
      };
    }

    if (activeMetric === 'sleep') {
      return {
        stat1Label: 'Average Sleep',
        stat1Value: values.length > 0 ? `${avg.toFixed(1)} hrs` : '0.0 hrs',
        stat2Label: 'Best Night',
        stat2Value: values.length > 0 ? `${max.toFixed(1)} hrs` : '0.0 hrs',
        stat3Label: 'Target',
        stat3Value: '8.0 hrs',
      };
    }

    if (activeMetric === 'weight') {
      const initial = values.length > 0 ? values[0] : latestWeightVal;
      const latest = values.length > 0 ? values[values.length - 1] : latestWeightVal;
      const diff = latest - initial;
      const diffStr = diff > 0 ? `+${diff.toFixed(1)} kg` : `${diff.toFixed(1)} kg`;
      return {
        stat1Label: 'Current Weight',
        stat1Value: latest > 0 ? `${latest.toFixed(1)} kg` : '--',
        stat2Label: 'Net Change',
        stat2Value: diffStr,
        stat3Label: 'Target',
        stat3Value: '75.0 kg',
      };
    }

    if (activeMetric === 'nutrition') {
      const activeMeals = meals.filter((m) => {
        return activePoints.some((p) => p.date === m.meal_date);
      });
      const loggedDays = values.filter((v) => v > 0);
      const totalLoggedDays = loggedDays.length;
      const metGoal = values.filter(
        (v) => targetCalories > 0 && v >= targetCalories * 0.9 && v <= targetCalories * 1.1,
      ).length;
      const totalProtein = activeMeals.reduce((acc, m) => acc + (m.protein_g || 0), 0);
      const avgProtein = totalLoggedDays > 0 ? Math.round(totalProtein / totalLoggedDays) : 0;

      return {
        stat1Label: 'Daily Avg',
        stat1Value: values.length > 0 ? `${Math.round(avg).toLocaleString()} kcal` : '0 kcal',
        stat2Label: 'Avg Protein',
        stat2Value: `${avgProtein} g`,
        stat3Label: 'Goal Met',
        stat3Value: `${metGoal} / ${totalCount}`,
      };
    }

    // Energy tab
    const stressVals = activePoints.map((p) => p.secondary || 0).filter((v) => v > 0);
    const stressAvg = stressVals.length > 0 ? stressVals.reduce((a, b) => a + b, 0) / stressVals.length : 0;
    return {
      stat1Label: 'Average Energy',
      stat1Value: values.length > 0 ? `${avg.toFixed(1)} / 10` : '0 / 10',
      stat2Label: 'Average Stress',
      stat2Value: stressVals.length > 0 ? `${stressAvg.toFixed(1)} / 10` : '0 / 10',
      stat3Label: 'Check-ins',
      stat3Value: `${values.length}`,
    };
  }, [activePoints, chartPoints, activeMetric, latestWeightVal, meals, targetCalories]);

  const benchmarkValue = useMemo(() => {
    switch (activeMetric) {
      case 'steps':
        return 10000;
      case 'sleep':
        return 8.0;
      case 'energy':
        return 7.0;
      case 'nutrition':
        return targetCalories;
      default:
        return 0;
    }
  }, [activeMetric, targetCalories]);

  const heroValue = useMemo(() => {
    const lastActive = [...chartPoints].reverse().find((p) => p.value > 0);
    if (lastActive) return lastActive.value;
    return chartPoints[chartPoints.length - 1]?.value || 0;
  }, [chartPoints]);

  const heroDateLabel = useMemo(() => {
    return 'Latest';
  }, []);

  // Category label for floating tooltip
  const tooltipCategory = useMemo(() => {
    switch (activeMetric) {
      case 'steps':
        return 'TOTAL';
      case 'sleep':
        return 'TOTAL';
      case 'nutrition':
        return 'TOTAL';
      case 'weight':
        return 'WEIGHT';
      case 'energy':
        return 'ENERGY';
      default:
        return 'TOTAL';
    }
  }, [activeMetric]);

  // Selected point data
  const selectedPoint = selectedIndex !== null ? chartPoints[selectedIndex] : null;

  // Formatted value & unit for tooltip
  const tooltipStat = useMemo(() => {
    if (!selectedPoint) return { valueStr: '', unitStr: '' };
    const val = selectedPoint.value;
    switch (activeMetric) {
      case 'steps':
        return {
          valueStr: Math.round(val).toLocaleString(),
          unitStr: 'steps',
        };
      case 'sleep':
        return {
          valueStr: val > 0 ? val.toFixed(1) : '0',
          unitStr: 'hrs',
        };
      case 'nutrition':
        return {
          valueStr: Math.round(val).toLocaleString(),
          unitStr: 'kcal',
        };
      case 'weight':
        return {
          valueStr: val > 0 ? val.toFixed(1) : '--',
          unitStr: val > 0 ? 'kg' : '',
        };
      case 'energy':
        return {
          valueStr: val > 0 ? val.toFixed(1) : '0',
          unitStr: '/ 10',
        };
      default:
        return { valueStr: `${val}`, unitStr: '' };
    }
  }, [selectedPoint, activeMetric]);

  // Formatted date string for tooltip
  const tooltipDateStr = useMemo(() => {
    if (!selectedPoint) return '';
    const dateStr = selectedPoint.date;
    if (!dateStr) return selectedPoint.label;
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      const monthName = d.toLocaleDateString('en-US', { month: 'short' });

      if (timeRange === 'Day' && selectedPoint.label) {
        return `${monthName} ${day}, ${year} · ${selectedPoint.label}`;
      }
      if (timeRange === '6M') {
        return `Week of ${monthName} ${day}, ${year}`;
      }
      return `${monthName} ${day}, ${year}`;
    }
    return dateStr;
  }, [selectedPoint, timeRange]);

  // Calculate selected bar X coordinate to horizontally align the tooltip
  const selectedBarCenterX = useMemo(() => {
    if (selectedIndex === null || chartPoints.length === 0) return 0;
    const isBar = activeMetric === 'steps' || activeMetric === 'sleep' || activeMetric === 'nutrition';
    if (isBar) {
      const paddingLeft = 14;
      const paddingRight = 36;
      const usableW = Math.max(100, chartInnerWidth - paddingLeft - paddingRight);
      const slotW = usableW / chartPoints.length;
      return paddingLeft + selectedIndex * slotW + slotW / 2;
    } else {
      const paddingLeft = 16;
      const paddingRight = 36;
      const usableW = Math.max(100, chartInnerWidth - paddingLeft - paddingRight);
      const slotW = usableW / Math.max(chartPoints.length - 1, 1);
      return paddingLeft + selectedIndex * slotW;
    }
  }, [selectedIndex, chartPoints.length, chartInnerWidth, activeMetric]);

  const tooltipWidth = 164;
  const tooltipLeft = useMemo(() => {
    return Math.max(
      0,
      Math.min(chartInnerWidth - tooltipWidth, selectedBarCenterX - tooltipWidth / 2)
    );
  }, [selectedBarCenterX, chartInnerWidth]);

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
                {metricLabel}
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
                {metricLabel}
              </Text>
              <Text style={[styles.headerSubtitle, { color: textSecondary }]}>
                Trends & Progress
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
        {/* Liquid Sliding Filter Bar: D | W | M | 6M | Y */}
        <LiquidTabBar
          tabs={TIME_RANGES}
          activeTab={timeRange}
          onSelectTab={setTimeRange}
          activeColor={colors.primary}
          cardBg={cardBg}
          cardBorder={cardBorder}
          textSecondary={textSecondary}
          textOnPrimary={colors.textOnPrimary || '#FFFFFF'}
        />

        {/* Chart Surface */}
        <View
          style={[
            styles.chartSurface,
            {
              backgroundColor: cardBg,
              borderColor: cardBorder,
            },
          ]}
          onLayout={(e) => {
            const w = e.nativeEvent.layout.width;
            if (w > 0) {
              const innerW = w - 40;
              if (Math.abs(innerW - chartInnerWidth) > 1) {
                setChartInnerWidth(innerW);
              }
            }
          }}
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <View>
              {/* Header Container: Value Display or Floating Tooltip */}
              <View style={styles.chartHeaderContainer}>
                {/* Default Stat (fades out when a bar is selected) */}
                <View
                  style={[
                    styles.valueRow,
                    {
                      opacity: selectedIndex !== null ? 0 : 1,
                      pointerEvents: selectedIndex !== null ? 'none' : 'auto',
                    },
                  ]}
                >
                  <View>
                    <Text style={[styles.valueLabel, { color: textSecondary }]}>
                      {heroDateLabel}
                    </Text>
                    <Text style={[styles.valueNumber, { color: textColor }]}>
                      {formatValue(heroValue, activeMetric)}
                    </Text>
                  </View>

                  {benchmarkValue > 0 && (
                    <View
                      style={[
                        styles.goalBadge,
                        {
                          backgroundColor: `${colors.primary}16`,
                          borderColor: `${colors.primary}33`,
                        },
                      ]}
                    >
                      <View style={[styles.goalDot, { backgroundColor: colors.primary }]} />
                      <Text style={[styles.goalText, { color: colors.primary }]}>
                        Goal: {formatValue(benchmarkValue, activeMetric)}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Floating iPhone-style Tooltip Card (shows when a bar/point is selected) */}
                {selectedIndex !== null && selectedPoint && (
                  <View
                    style={[
                      styles.tooltipCard,
                      {
                        left: tooltipLeft,
                        width: tooltipWidth,
                        backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(0, 0, 0, 0.08)',
                      },
                    ]}
                  >
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => setSelectedIndex(null)}
                      style={styles.tooltipInner}
                    >
                      <Text style={[styles.tooltipCategory, { color: isDark ? '#98989F' : '#8E8E93' }]}>
                        {tooltipCategory}
                      </Text>
                      <View style={styles.tooltipValueRow}>
                        <Text style={[styles.tooltipValueText, { color: textColor }]}>
                          {tooltipStat.valueStr}
                        </Text>
                        {tooltipStat.unitStr ? (
                          <Text style={[styles.tooltipUnitText, { color: textSecondary }]}>
                            {tooltipStat.unitStr}
                          </Text>
                        ) : null}
                      </View>
                      <Text style={[styles.tooltipDateText, { color: textSecondary }]} numberOfLines={1}>
                        {tooltipDateStr}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Render Chart (Bar for steps/sleep/nutrition, Smooth Line for weight/energy) */}
              {activeMetric === 'steps' || activeMetric === 'sleep' || activeMetric === 'nutrition' ? (
                <BarChartVisual
                  points={chartPoints}
                  height={CHART_HEIGHT}
                  width={chartInnerWidth}
                  benchmark={benchmarkValue}
                  primaryColor={colors.primary}
                  selectedIndex={selectedIndex}
                  onSelectIndex={(idx) => setSelectedIndex((prev) => (prev === idx ? null : idx))}
                  isDark={isDark}
                />
              ) : (
                <LineChartVisual
                  points={chartPoints}
                  height={CHART_HEIGHT}
                  width={chartInnerWidth}
                  benchmark={benchmarkValue}
                  primaryColor={colors.primary}
                  selectedIndex={selectedIndex}
                  onSelectIndex={(idx) => setSelectedIndex((prev) => (prev === idx ? null : idx))}
                  showSecondary={activeMetric === 'energy'}
                  isDark={isDark}
                />
              )}
            </View>
          )}
        </View>

        {/* Summary Metric Tiles */}
        <View style={styles.summaryRow}>
          <MetricSummaryTile
            label={summary.stat1Label}
            value={summary.stat1Value}
            cardBg={cardBg}
            cardBorder={cardBorder}
            textColor={textColor}
            textSecondary={textSecondary}
          />
          <MetricSummaryTile
            label={summary.stat2Label}
            value={summary.stat2Value}
            cardBg={cardBg}
            cardBorder={cardBorder}
            textColor={textColor}
            textSecondary={textSecondary}
          />
          <MetricSummaryTile
            label={summary.stat3Label}
            value={summary.stat3Value}
            cardBg={cardBg}
            cardBorder={cardBorder}
            textColor={textColor}
            textSecondary={textSecondary}
          />
        </View>

        {/* Nutrition Extra Details: Macro Breakdown & Recent Meals */}
        {activeMetric === 'nutrition' && (
          <View style={{ marginTop: 20 }}>
            {/* Macro Breakdown Card */}
            <View
              style={[
                styles.chartSurface,
                {
                  backgroundColor: cardBg,
                  borderColor: cardBorder,
                  marginBottom: 16,
                  padding: 16,
                },
              ]}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '700',
                  color: textColor,
                  marginBottom: 12,
                }}
              >
                Macros
              </Text>

              {(() => {
                const totalMeals = meals.length;
                const totalProt = meals.reduce((acc, m) => acc + (m.protein_g || 0), 0);
                const totalCarbs = meals.reduce((acc, m) => acc + (m.carbs_g || 0), 0);
                const totalFat = meals.reduce((acc, m) => acc + (m.fat_g || 0), 0);
                const distinctDays = Math.max(1, new Set(meals.map((m) => m.meal_date)).size);

                const avgP = Math.round(totalProt / distinctDays);
                const avgC = Math.round(totalCarbs / distinctDays);
                const avgF = Math.round(totalFat / distinctDays);

                return (
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View
                      style={{
                        flex: 1,
                        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC',
                        borderRadius: 12,
                        padding: 12,
                        borderWidth: 1,
                        borderColor: cardBorder,
                      }}
                    >
                      <Text style={{ fontSize: 12, color: textSecondary, fontWeight: '600' }}>
                        Protein
                      </Text>
                      <Text style={{ fontSize: 18, color: textColor, fontWeight: '800', marginTop: 4 }}>
                        {avgP} g
                      </Text>
                      <Text style={{ fontSize: 11, color: textSecondary, marginTop: 2 }}>
                        Goal: {targetProtein} g
                      </Text>
                    </View>

                    <View
                      style={{
                        flex: 1,
                        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC',
                        borderRadius: 12,
                        padding: 12,
                        borderWidth: 1,
                        borderColor: cardBorder,
                      }}
                    >
                      <Text style={{ fontSize: 12, color: textSecondary, fontWeight: '600' }}>
                        Carbs
                      </Text>
                      <Text style={{ fontSize: 18, color: textColor, fontWeight: '800', marginTop: 4 }}>
                        {avgC} g
                      </Text>
                      <Text style={{ fontSize: 11, color: textSecondary, marginTop: 2 }}>
                        Goal: {targetCarbs} g
                      </Text>
                    </View>

                    <View
                      style={{
                        flex: 1,
                        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC',
                        borderRadius: 12,
                        padding: 12,
                        borderWidth: 1,
                        borderColor: cardBorder,
                      }}
                    >
                      <Text style={{ fontSize: 12, color: textSecondary, fontWeight: '600' }}>
                        Fat
                      </Text>
                      <Text style={{ fontSize: 18, color: textColor, fontWeight: '800', marginTop: 4 }}>
                        {avgF} g
                      </Text>
                      <Text style={{ fontSize: 11, color: textSecondary, marginTop: 2 }}>
                        Goal: {targetFat} g
                      </Text>
                    </View>
                  </View>
                );
              })()}
            </View>

            {/* Recent Meals Section */}
            <View
              style={[
                styles.chartSurface,
                {
                  backgroundColor: cardBg,
                  borderColor: cardBorder,
                  padding: 16,
                },
              ]}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '700',
                  color: textColor,
                  marginBottom: 12,
                }}
              >
                Logged Meals
              </Text>

              {meals.length === 0 ? (
                <Text style={{ color: textSecondary, fontSize: 14 }}>
                  No meals logged for this period.
                </Text>
              ) : (
                <View style={{ gap: 10 }}>
                  {[...meals]
                    .reverse()
                    .slice(0, 5)
                    .map((meal) => (
                      <TouchableOpacity
                        key={meal.id}
                        activeOpacity={0.75}
                        onPress={() => {
                          router.push({
                            pathname: '/meal-details/[id]',
                            params: { id: meal.id },
                          });
                        }}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          padding: 10,
                          borderRadius: 12,
                          backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC',
                          borderWidth: 1,
                          borderColor: cardBorder,
                        }}
                      >
                        <View
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 8,
                            overflow: 'hidden',
                            backgroundColor: isDark ? '#1E293B' : '#E2E8F0',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginRight: 12,
                          }}
                        >
                          {meal.photo_url ? (
                            <Image
                              source={{ uri: meal.photo_url }}
                              style={{ width: '100%', height: '100%' }}
                              contentFit="cover"
                            />
                          ) : (
                            <Utensils size={18} color={colors.primary} />
                          )}
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text
                            style={{
                              fontSize: 14,
                              fontWeight: '700',
                              color: textColor,
                            }}
                            numberOfLines={1}
                          >
                            {meal.meal_name || 'Meal'}
                          </Text>
                          <Text style={{ fontSize: 12, color: textSecondary, marginTop: 2 }}>
                            {meal.meal_date} · {meal.calories || 0} kcal · {meal.protein_g || 0}g protein
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                </View>
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Liquid Animated Tab Bar ────────────────────────────────────────────────
function LiquidTabBar({
  tabs,
  activeTab,
  onSelectTab,
  activeColor,
  cardBg,
  cardBorder,
  textSecondary,
  textOnPrimary,
}: {
  tabs: { key: TimeRange; label: string }[];
  activeTab: TimeRange;
  onSelectTab: (tab: TimeRange) => void;
  activeColor: string;
  cardBg: string;
  cardBorder: string;
  textSecondary: string;
  textOnPrimary: string;
}) {
  const [containerWidth, setContainerWidth] = useState(0);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const stretchAnim = useRef(new Animated.Value(1)).current;
  const hasMounted = useRef(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

  const activeIndex = useMemo(() => {
    const idx = tabs.findIndex((t) => t.key === activeTab);
    return idx >= 0 ? idx : 0;
  }, [tabs, activeTab]);

  const padding = 4;
  const availableWidth = containerWidth > 0 ? containerWidth - padding * 2 : 0;
  const tabWidth = availableWidth > 0 ? availableWidth / tabs.length : 0;

  useEffect(() => {
    if (tabWidth <= 0) return;
    const targetX = padding + activeIndex * tabWidth;

    if (!hasMounted.current || reduceMotion) {
      slideAnim.setValue(targetX);
      hasMounted.current = true;
      return;
    }

    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: targetX,
        damping: 17,
        mass: 0.8,
        stiffness: 190,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(stretchAnim, {
          toValue: 1.14,
          duration: 90,
          useNativeDriver: true,
        }),
        Animated.spring(stretchAnim, {
          toValue: 1,
          damping: 12,
          stiffness: 220,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [activeIndex, tabWidth, reduceMotion]);

  return (
    <View
      style={[
        styles.liquidTabBarContainer,
        {
          backgroundColor: cardBg,
          borderColor: cardBorder,
        },
      ]}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0 && Math.abs(w - containerWidth) > 1) {
          setContainerWidth(w);
        }
      }}
    >
      {containerWidth > 0 && tabWidth > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.liquidPill,
            {
              width: tabWidth,
              backgroundColor: activeColor,
              transform: [
                { translateX: slideAnim },
                { scaleX: stretchAnim },
              ],
            },
          ]}
        />
      )}

      {tabs.map((tab) => {
        const isSelected = tab.key === activeTab;
        return (
          <TouchableOpacity
            key={tab.key}
            activeOpacity={0.75}
            onPress={() => {
              if (tab.key !== activeTab) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onSelectTab(tab.key);
              }
            }}
            style={styles.liquidTabButton}
          >
            <Text
              style={[
                styles.liquidTabButtonText,
                {
                  color: isSelected ? textOnPrimary : textSecondary,
                },
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function formatValue(val: number, tab: MetricTab): string {
  if (tab === 'steps') return `${Math.round(val).toLocaleString()} steps`;
  if (tab === 'sleep') return `${val.toFixed(1)} hrs`;
  if (tab === 'weight') return val > 0 ? `${val.toFixed(1)} kg` : '--';
  if (tab === 'nutrition') return val > 0 ? `${Math.round(val).toLocaleString()} kcal` : '--';
  return val > 0 ? `${val.toFixed(1)} / 10` : '--';
}

function MetricSummaryTile({
  label,
  value,
  cardBg,
  cardBorder,
  textColor,
  textSecondary,
}: {
  label: string;
  value: string;
  cardBg: string;
  cardBorder: string;
  textColor: string;
  textSecondary: string;
}) {
  return (
    <View
      style={[
        styles.summaryTile,
        {
          backgroundColor: cardBg,
          borderColor: cardBorder,
        },
      ]}
    >
      <Text style={[styles.summaryTileLabel, { color: textSecondary }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.summaryTileValue, { color: textColor }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function BarChartVisual({
  points,
  height,
  width,
  benchmark,
  primaryColor,
  selectedIndex,
  onSelectIndex,
  isDark,
}: {
  points: { label: string; date: string; value: number }[];
  height: number;
  width: number;
  benchmark: number;
  primaryColor: string;
  selectedIndex: number | null;
  onSelectIndex: (idx: number) => void;
  isDark: boolean;
}) {
  const paddingLeft = 14;
  const paddingRight = 36;
  const paddingBottom = 32;
  const paddingTop = 14;
  const usableWidth = Math.max(100, width - paddingLeft - paddingRight);
  const graphH = height - paddingBottom;
  const slotWidth = points.length > 0 ? usableWidth / points.length : usableWidth;
  const barWidth = Math.max(5, Math.min(26, slotWidth * 0.52));

  const highestValue = Math.max(...points.map((p) => p.value), 0);
  const maxVal = Math.max(highestValue, benchmark || 1, 1);
  const displayMaxVal = maxVal * 1.15;

  const benchmarkY = benchmark > 0 ? graphH - (benchmark / displayMaxVal) * (graphH - paddingTop) : null;
  const emptyBarColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';

  // Selected bar geometry
  const selectedBar = selectedIndex !== null && points[selectedIndex] ? points[selectedIndex] : null;
  const selectedBarX = selectedIndex !== null ? paddingLeft + selectedIndex * slotWidth + (slotWidth - barWidth) / 2 : 0;
  const selectedBarCenterX = selectedBarX + barWidth / 2;
  const selectedBarH = selectedBar
    ? selectedBar.value === 0
      ? 2
      : Math.max(8, (selectedBar.value / displayMaxVal) * (graphH - paddingTop))
    : 0;
  const selectedBarTopY = graphH - selectedBarH;

  // Grid steps (0, 33%, 66%, 100%)
  const gridSteps = useMemo(() => {
    const top = Math.ceil(maxVal);
    if (top <= 0) return [0];
    const s1 = Math.round(top * 0.33);
    const s2 = Math.round(top * 0.66);
    return [0, s1, s2, top];
  }, [maxVal]);

  return (
    <View style={{ width, height, overflow: 'hidden' }}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={primaryColor} stopOpacity="0.9" />
            <Stop offset="100%" stopColor={primaryColor} stopOpacity="0.4" />
          </LinearGradient>
          <LinearGradient id="barGradientActive" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={primaryColor} stopOpacity="1" />
            <Stop offset="100%" stopColor={primaryColor} stopOpacity="0.85" />
          </LinearGradient>
        </Defs>

        {/* Subtle Horizontal Grid Lines & Y-axis labels */}
        {gridSteps.map((stepVal, idx) => {
          const y = graphH - (stepVal / displayMaxVal) * (graphH - paddingTop);
          const isBaseline = idx === 0;
          return (
            <React.Fragment key={`grid-${idx}`}>
              <Line
                x1={paddingLeft}
                y1={y}
                x2={width - paddingRight}
                y2={y}
                stroke={
                  isBaseline
                    ? (isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)')
                    : (isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)')
                }
                strokeWidth={isBaseline ? 1 : 0.8}
              />
              <SvgText
                x={width - paddingRight + 6}
                y={y + 3.5}
                fontSize="9"
                fontWeight="600"
                fill={isDark ? 'rgba(148, 163, 184, 0.65)' : 'rgba(100, 116, 139, 0.65)'}
                textAnchor="start"
              >
                {stepVal >= 1000 ? `${(stepVal / 1000).toFixed(stepVal % 1000 === 0 ? 0 : 1)}k` : stepVal}
              </SvgText>
            </React.Fragment>
          );
        })}

        {/* Subtle Vertical Dashed Divider Lines between bars */}
        {points.map((_, i) => {
          if (i === 0) return null;
          const dividerX = paddingLeft + i * slotWidth;
          return (
            <Line
              key={`vdiv-${i}`}
              x1={dividerX}
              y1={paddingTop}
              x2={dividerX}
              y2={graphH}
              stroke={isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)'}
              strokeDasharray="2 3"
              strokeWidth="1"
            />
          );
        })}

        {/* Benchmark Dashed Line */}
        {benchmarkY !== null && (
          <Line
            x1={paddingLeft}
            y1={benchmarkY}
            x2={width - paddingRight}
            y2={benchmarkY}
            stroke={`${primaryColor}88`}
            strokeDasharray="4 4"
            strokeWidth="1.5"
          />
        )}

        {/* Bars */}
        {points.map((p, i) => {
          const isSelected = selectedIndex === i;
          const isZero = p.value === 0;
          const barH = isZero ? 2 : Math.max(8, (p.value / displayMaxVal) * (graphH - paddingTop));
          const x = paddingLeft + i * slotWidth + (slotWidth - barWidth) / 2;
          const y = graphH - barH;

          const fillColor = isSelected
            ? 'url(#barGradientActive)'
            : isZero
            ? emptyBarColor
            : 'url(#barGradient)';

          // Dim other bars when one is selected
          const barOpacity = selectedIndex !== null ? (isSelected ? 1 : 0.4) : 1;

          const shouldShowLabel =
            points.length <= 10 ||
            i % Math.ceil(points.length / 6) === 0 ||
            i === points.length - 1;

          return (
            <React.Fragment key={p.date + i}>
              <Rect
                x={x}
                y={y}
                width={barWidth}
                height={barH}
                rx={Math.min(barWidth / 2, 8)}
                fill={fillColor}
                opacity={barOpacity}
              />
              {shouldShowLabel && (
                <SvgText
                  x={x + barWidth / 2}
                  y={height - 10}
                  fontSize="10"
                  fontWeight={isSelected ? '800' : '700'}
                  fill={
                    isSelected
                      ? (isDark ? '#FFFFFF' : '#0F172A')
                      : 'rgba(148, 163, 184, 0.8)'
                  }
                  textAnchor="middle"
                >
                  {p.label}
                </SvgText>
              )}
            </React.Fragment>
          );
        })}

        {/* Selected Bar Indicator Overlay: Vertical line to tooltip + Horizontal line on bar + Guideline */}
        {selectedIndex !== null && selectedBar && (
          <React.Fragment>
            {/* Subtle horizontal guideline across the chart at selected bar value */}
            <Line
              x1={paddingLeft}
              y1={selectedBarTopY}
              x2={width - paddingRight}
              y2={selectedBarTopY}
              stroke={isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(0, 0, 0, 0.15)'}
              strokeDasharray="3 3"
              strokeWidth="1"
            />

            {/* Vertical stem line connecting from top edge of chart (flush with tooltip) to top of bar */}
            <Line
              x1={selectedBarCenterX}
              y1={0}
              x2={selectedBarCenterX}
              y2={selectedBarTopY}
              stroke={isDark ? 'rgba(255, 255, 255, 0.55)' : 'rgba(0, 0, 0, 0.4)'}
              strokeWidth="1.5"
            />

            {/* Horizontal line capping the top of the selected bar */}
            <Line
              x1={selectedBarX}
              y1={selectedBarTopY}
              x2={selectedBarX + barWidth}
              y2={selectedBarTopY}
              stroke="#FFFFFF"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </React.Fragment>
        )}
      </Svg>

      {/* Invisible Touch Layer for interactive tapping */}
      <View
        style={[
          styles.touchOverlay,
          {
            left: paddingLeft,
            width: usableWidth,
            height: graphH,
          },
        ]}
      >
        {points.map((_, i) => (
          <TouchableOpacity
            key={`touch-${i}`}
            style={styles.touchCell}
            activeOpacity={1}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onSelectIndex(i);
            }}
          />
        ))}
      </View>
    </View>
  );
}

function LineChartVisual({
  points,
  height,
  width,
  benchmark,
  primaryColor,
  selectedIndex,
  onSelectIndex,
  isDark,
}: {
  points: { label: string; date: string; value: number; secondary?: number }[];
  height: number;
  width: number;
  benchmark: number;
  primaryColor: string;
  selectedIndex: number | null;
  onSelectIndex: (idx: number) => void;
  showSecondary?: boolean;
  isDark: boolean;
}) {
  const paddingLeft = 16;
  const paddingRight = 36;
  const paddingBottom = 32;
  const paddingTop = 16;
  const usableWidth = Math.max(100, width - paddingLeft - paddingRight);
  const graphH = height - paddingBottom;
  const slotWidth = usableWidth / Math.max(points.length - 1, 1);

  let lastVal = 0;
  const processedPoints = points.map((p) => {
    let v = p.value;
    if (v > 0) {
      lastVal = v;
    } else if (lastVal > 0) {
      v = lastVal;
    }
    return { ...p, value: v };
  });

  const activeVals = processedPoints.map((p) => p.value).filter((v) => v > 0);
  const minVal = activeVals.length > 0 ? Math.min(...activeVals) * 0.98 : 0;
  const maxVal = activeVals.length > 0 ? Math.max(...activeVals, benchmark || 1) * 1.04 : 10;
  const range = Math.max(maxVal - minVal, 1);

  const coords = processedPoints.map((p, i) => {
    const x = paddingLeft + i * slotWidth;
    const y = p.value > 0 ? graphH - ((p.value - minVal) / range) * (graphH - paddingTop) : graphH - 4;
    return { x, y, value: p.value };
  });

  let pathD = '';
  coords.forEach((pt, i) => {
    if (i === 0) pathD += `M ${pt.x} ${pt.y}`;
    else {
      const prev = coords[i - 1];
      const cx = (prev.x + pt.x) / 2;
      pathD += ` C ${cx} ${prev.y}, ${cx} ${pt.y}, ${pt.x} ${pt.y}`;
    }
  });

  const areaD = `${pathD} L ${coords[coords.length - 1].x} ${graphH} L ${coords[0].x} ${graphH} Z`;

  // Grid steps (0, 50%, 100%)
  const gridSteps = useMemo(() => {
    return [minVal, minVal + range * 0.5, maxVal];
  }, [minVal, maxVal, range]);

  const selectedPt = selectedIndex !== null && coords[selectedIndex] ? coords[selectedIndex] : null;

  return (
    <View style={{ width, height, overflow: 'hidden' }}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="lineAreaGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={primaryColor} stopOpacity="0.25" />
            <Stop offset="100%" stopColor={primaryColor} stopOpacity="0.0" />
          </LinearGradient>
        </Defs>

        {/* Subtle Horizontal Grid Lines & Y-axis labels */}
        {gridSteps.map((stepVal, idx) => {
          const y = graphH - ((stepVal - minVal) / range) * (graphH - paddingTop);
          const isBaseline = idx === 0;
          return (
            <React.Fragment key={`grid-${idx}`}>
              <Line
                x1={paddingLeft}
                y1={y}
                x2={width - paddingRight}
                y2={y}
                stroke={
                  isBaseline
                    ? (isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)')
                    : (isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)')
                }
                strokeWidth={isBaseline ? 1 : 0.8}
              />
              <SvgText
                x={width - paddingRight + 6}
                y={y + 3.5}
                fontSize="9"
                fontWeight="600"
                fill={isDark ? 'rgba(148, 163, 184, 0.65)' : 'rgba(100, 116, 139, 0.65)'}
                textAnchor="start"
              >
                {stepVal.toFixed(stepVal % 1 === 0 ? 0 : 1)}
              </SvgText>
            </React.Fragment>
          );
        })}

        {/* Benchmark Dashed Line */}
        {benchmark > 0 && (
          <Line
            x1={paddingLeft}
            y1={graphH - ((benchmark - minVal) / range) * (graphH - paddingTop)}
            x2={width - paddingRight}
            y2={graphH - ((benchmark - minVal) / range) * (graphH - paddingTop)}
            stroke={`${primaryColor}66`}
            strokeDasharray="4 4"
            strokeWidth="1.5"
          />
        )}

        {/* Filled Area */}
        {activeVals.length > 0 && <Path d={areaD} fill="url(#lineAreaGradient)" />}

        {/* Primary Line */}
        <Path
          d={pathD}
          stroke={activeVals.length > 0 ? primaryColor : (isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)')}
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />

        {/* Data points */}
        {coords.map((pt, i) => {
          const isSelected = selectedIndex === i;
          const shouldShowLabel =
            processedPoints.length <= 10 ||
            i % Math.ceil(processedPoints.length / 6) === 0 ||
            i === processedPoints.length - 1;

          return (
            <React.Fragment key={`point-${i}`}>
              <Circle
                cx={pt.x}
                cy={pt.y}
                r={isSelected ? 6 : pt.value > 0 ? 4 : 2}
                fill={isSelected ? '#FFFFFF' : pt.value > 0 ? primaryColor : (isDark ? '#334155' : '#CBD5E1')}
                stroke={primaryColor}
                strokeWidth={isSelected ? 3 : pt.value > 0 ? 1.5 : 0}
              />
              {shouldShowLabel && (
                <SvgText
                  x={pt.x}
                  y={height - 10}
                  fontSize="10"
                  fontWeight={isSelected ? '800' : '700'}
                  fill={
                    isSelected
                      ? (isDark ? '#FFFFFF' : '#0F172A')
                      : 'rgba(148, 163, 184, 0.8)'
                  }
                  textAnchor="middle"
                >
                  {processedPoints[i].label}
                </SvgText>
              )}
            </React.Fragment>
          );
        })}

        {/* Selected Point Indicator: Vertical Line to tooltip & Horizontal Guideline */}
        {selectedIndex !== null && selectedPt && (
          <React.Fragment>
            <Line
              x1={paddingLeft}
              y1={selectedPt.y}
              x2={width - paddingRight}
              y2={selectedPt.y}
              stroke={isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(0, 0, 0, 0.15)'}
              strokeDasharray="3 3"
              strokeWidth="1"
            />
            <Line
              x1={selectedPt.x}
              y1={0}
              x2={selectedPt.x}
              y2={selectedPt.y}
              stroke={isDark ? 'rgba(255, 255, 255, 0.55)' : 'rgba(0, 0, 0, 0.4)'}
              strokeWidth="1.5"
            />
          </React.Fragment>
        )}
      </Svg>

      {/* Invisible Touch Layer */}
      <View
        style={[
          styles.touchOverlay,
          {
            left: paddingLeft,
            width: usableWidth,
            height: graphH,
          },
        ]}
      >
        {processedPoints.map((_, i) => (
          <TouchableOpacity
            key={`touch-${i}`}
            style={styles.touchCell}
            activeOpacity={1}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onSelectIndex(i);
            }}
          />
        ))}
      </View>
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
  liquidTabBarContainer: {
    flexDirection: 'row',
    borderRadius: 18,
    padding: 4,
    borderWidth: 1,
    marginBottom: 20,
    position: 'relative',
  },
  liquidPill: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    borderRadius: 14,
    zIndex: 1,
  },
  liquidTabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  liquidTabButtonText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  chartSurface: {
    borderRadius: 32,
    padding: 20,
    borderWidth: 1,
    marginBottom: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  loadingContainer: {
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartHeaderContainer: {
    minHeight: 76,
    marginBottom: 8,
    position: 'relative',
    justifyContent: 'center',
  },
  tooltipCard: {
    position: 'absolute',
    bottom: 0,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 10,
  },
  tooltipInner: {
    justifyContent: 'center',
  },
  tooltipCategory: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  tooltipValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  tooltipValueText: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  tooltipUnitText: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  tooltipDateText: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  valueLabel: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  valueNumber: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginTop: 2,
  },
  goalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  goalDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  goalText: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  summaryTile: {
    flex: 1,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
  },
  summaryTileLabel: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  summaryTileValue: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  touchOverlay: {
    position: 'absolute',
    top: 0,
    flexDirection: 'row',
  },
  touchCell: {
    flex: 1,
  },
});
