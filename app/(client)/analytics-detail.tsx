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
import { ChevronLeft } from 'lucide-react-native';
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_HEIGHT = 200;

export type MetricTab = 'steps' | 'sleep' | 'weight' | 'energy';
export type TimeRange = 'Day' | 'Week' | 'Month' | '6M' | '1Y';

const TIME_RANGES: { key: TimeRange; label: string }[] = [
  { key: 'Day', label: 'D' },
  { key: 'Week', label: 'W' },
  { key: 'Month', label: 'M' },
  { key: '6M', label: '6M' },
  { key: '1Y', label: 'Y' },
];

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
  const params = useLocalSearchParams<{ metric?: string; clientId?: string }>();
  const isCoachView = Boolean(params.clientId);
  const { client, profile } = useAuth();
  const theme = useTheme();
  const colors = theme.colors;
  const isDark = isDarkColor(colors.background || '#020617');

  const textColor = colors.text || (isDark ? '#FFFFFF' : '#0F172A');
  const textSecondary = colors.textSecondary || (isDark ? '#94A3B8' : '#64748B');
  const cardBg = isDark ? '#0F172A' : '#FFFFFF';
  const cardBorder = isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0';

  const activeMetric: MetricTab = (
    params.metric && ['steps', 'sleep', 'weight', 'energy'].includes(params.metric)
      ? params.metric
      : 'steps'
  ) as MetricTab;

  const [timeRange, setTimeRange] = useState<TimeRange>('Week');
  const [loading, setLoading] = useState(true);
  const [dailyLogs, setDailyLogs] = useState<DailyLogEntry[]>([]);
  const [checkIns, setCheckIns] = useState<CheckInEntry[]>([]);
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
        isCoachView ? Promise.resolve(null) : getTodaySteps(),
        isCoachView ? Promise.resolve(null) : getLastNightSleep(),
        isCoachView ? Promise.resolve(null) : getLatestWeight(),
        isCoachView ? Promise.resolve(null) : AsyncStorage.getItem(`@steps_${todayStr}`),
      ]);

      const fetchedLogs: DailyLogEntry[] = [...(logsRes.data || [])];
      const fetchedCheckIns: CheckInEntry[] = [...(checkInsRes.data || [])];

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
  }, [activePoints, chartPoints, activeMetric, latestWeightVal]);

  const benchmarkValue = useMemo(() => {
    switch (activeMetric) {
      case 'steps':
        return 10000;
      case 'sleep':
        return 8.0;
      case 'energy':
        return 7.0;
      default:
        return 0;
    }
  }, [activeMetric]);

  const heroValue = useMemo(() => {
    if (selectedIndex !== null) {
      return chartPoints[selectedIndex]?.value || 0;
    }
    const lastActive = [...chartPoints].reverse().find((p) => p.value > 0);
    if (lastActive) return lastActive.value;
    return chartPoints[chartPoints.length - 1]?.value || 0;
  }, [selectedIndex, chartPoints]);

  const heroDateLabel = useMemo(() => {
    if (selectedIndex !== null) {
      return chartPoints[selectedIndex]?.label || 'Selected';
    }
    return 'Latest';
  }, [selectedIndex, chartPoints]);

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
              {/* Chart Value Display */}
              <View style={styles.valueRow}>
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

              {/* Render Chart (Bar for steps/sleep, Smooth Line for weight/energy) */}
              {activeMetric === 'steps' || activeMetric === 'sleep' ? (
                <BarChartVisual
                  points={chartPoints}
                  height={CHART_HEIGHT}
                  width={chartInnerWidth}
                  benchmark={benchmarkValue}
                  primaryColor={colors.primary}
                  selectedIndex={selectedIndex}
                  onSelectIndex={setSelectedIndex}
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
                  onSelectIndex={setSelectedIndex}
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
  const paddingX = 14;
  const paddingBottom = 32;
  const paddingTop = 12;
  const usableWidth = Math.max(100, width - paddingX * 2);
  const graphH = height - paddingBottom;
  const slotWidth = usableWidth / points.length;
  const barWidth = Math.max(6, Math.min(26, slotWidth * 0.52));

  const highestValue = Math.max(...points.map((p) => p.value), 0);
  const maxVal = Math.max(highestValue, benchmark || 1, 1) * 1.08;

  const benchmarkY = benchmark > 0 ? graphH - (benchmark / maxVal) * (graphH - paddingTop) : null;
  const emptyBarColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';

  return (
    <View style={{ width, height, overflow: 'hidden' }}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={primaryColor} stopOpacity="0.9" />
            <Stop offset="100%" stopColor={primaryColor} stopOpacity="0.32" />
          </LinearGradient>
          <LinearGradient id="barGradientActive" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={primaryColor} stopOpacity="1" />
            <Stop offset="100%" stopColor={primaryColor} stopOpacity="0.75" />
          </LinearGradient>
        </Defs>

        {/* Clean Baseline Rule */}
        <Line
          x1={paddingX}
          y1={graphH}
          x2={width - paddingX}
          y2={graphH}
          stroke={isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}
          strokeWidth="1"
        />

        {/* Benchmark Dashed Line */}
        {benchmarkY !== null && (
          <Line
            x1={paddingX}
            y1={benchmarkY}
            x2={width - paddingX}
            y2={benchmarkY}
            stroke={`${primaryColor}66`}
            strokeDasharray="4 4"
            strokeWidth="1.5"
          />
        )}

        {/* Bars */}
        {points.map((p, i) => {
          const isSelected = selectedIndex === i;
          const isZero = p.value === 0;
          const barH = isZero ? 2 : Math.max(8, (p.value / maxVal) * (graphH - paddingTop));
          const x = paddingX + i * slotWidth + (slotWidth - barWidth) / 2;
          const y = graphH - barH;

          const fillColor = isSelected
            ? 'url(#barGradientActive)'
            : isZero
            ? emptyBarColor
            : 'url(#barGradient)';

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
              />
              {shouldShowLabel && (
                <SvgText
                  x={x + barWidth / 2}
                  y={height - 10}
                  fontSize="10"
                  fontWeight="700"
                  fill="rgba(148, 163, 184, 0.8)"
                  textAnchor="middle"
                >
                  {p.label}
                </SvgText>
              )}
            </React.Fragment>
          );
        })}
      </Svg>

      {/* Invisible Touch Layer for interactive tapping */}
      <View style={[styles.touchOverlay, { left: paddingX, right: paddingX, height: graphH }]}>
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
  const paddingX = 16;
  const paddingBottom = 32;
  const paddingTop = 16;
  const usableWidth = Math.max(100, width - paddingX * 2);
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
    const x = paddingX + i * slotWidth;
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

  return (
    <View style={{ width, height, overflow: 'hidden' }}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="lineAreaGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={primaryColor} stopOpacity="0.25" />
            <Stop offset="100%" stopColor={primaryColor} stopOpacity="0.0" />
          </LinearGradient>
        </Defs>

        {/* Clean Baseline Rule */}
        <Line
          x1={paddingX}
          y1={graphH}
          x2={width - paddingX}
          y2={graphH}
          stroke={isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}
          strokeWidth="1"
        />

        {/* Benchmark Dashed Line */}
        {benchmark > 0 && (
          <Line
            x1={paddingX}
            y1={graphH - ((benchmark - minVal) / range) * (graphH - paddingTop)}
            x2={width - paddingX}
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
                  fontWeight="700"
                  fill="rgba(148, 163, 184, 0.8)"
                  textAnchor="middle"
                >
                  {processedPoints[i].label}
                </SvgText>
              )}
            </React.Fragment>
          );
        })}
      </Svg>

      {/* Invisible Touch Layer */}
      <View style={[styles.touchOverlay, { left: paddingX, right: paddingX, height: graphH }]}>
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
